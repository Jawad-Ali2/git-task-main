import { Injectable, Logger, HttpException, HttpStatus, NotFoundException, Inject, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository, DataSource } from 'typeorm';
import { Integration } from '../entities/integration.entity';
import { Task } from '../../tasks/entities/tasks.entity';
import { Repository } from '../../repositories/entities/repository.entity';
import { TrelloApiService } from './trello-api.service';
import { TrelloWebhookSecurityService } from './trello-webhook-security.service';
import { CreateIntegrationDto, UpdateIntegrationDto, SyncTasksDto } from '../dto/integration.dto';
import { NotificationsService, NotificationType } from '../../notifications/notifications.service';
import Redis from 'ioredis';

export interface WebhookContext {
  userId: string;
  integrationId: string;
  taskId?: string;
  cardId: string;
  actionType: string;
  timestamp: Date;
  webhookId?: string;
}

@Injectable()
export class IntegrationsService implements OnModuleInit {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    @InjectRepository(Integration)
    private integrationRepository: TypeOrmRepository<Integration>,
    @InjectRepository(Task)
    private taskRepository: TypeOrmRepository<Task>,
    @InjectRepository(Repository)
    private repositoryRepository: TypeOrmRepository<Repository>,
    private trelloApiService: TrelloApiService,
    private webhookSecurityService: TrelloWebhookSecurityService,
    private notificationsService: NotificationsService,
    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
    private dataSource: DataSource,
  ) {}

  /**
   * Initialize retry processor subscription
   */
  async onModuleInit() {
    // Subscribe to retry events
    const subscriber = this.redis.duplicate();
    await subscriber.subscribe('trello:webhook:retry');
    
    subscriber.on('message', async (channel, message) => {
      if (channel === 'trello:webhook:retry') {
        try {
          const { payload, retryCount } = JSON.parse(message);
          await this.processWebhookWithRetry(payload, retryCount);
        } catch (error) {
          this.logger.error(`Failed to process retry: ${error.message}`);
        }
      }
    });

    this.logger.log('Webhook retry processor initialized');
  }

  /**
   * Create a new integration
   */
  async create(userId: string, dto: CreateIntegrationDto): Promise<Integration> {
    try {
      // Validate Trello credentials if provider is trello
      if (dto.provider === 'trello') {
        const apiKey = process.env.TRELLO_API_KEY;
        if (!apiKey) {
          throw new HttpException('TRELLO_API_KEY not configured', HttpStatus.INTERNAL_SERVER_ERROR);
        }
        await this.trelloApiService.getMemberInfo(apiKey, dto.accessToken);
      }

      const integration = this.integrationRepository.create({
        ...dto,
        user: { id: userId } as any,
        repository: dto.repositoryId ? { id: dto.repositoryId } as any : null,
      });

      return await this.integrationRepository.save(integration);
    } catch (error) {
      this.logger.error('Failed to create integration', error);
      throw new HttpException(
        error.message || 'Failed to create integration',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Get all integrations for a user
   */
  async findAll(userId: string, provider?: string): Promise<Integration[]> {
    const query = this.integrationRepository
      .createQueryBuilder('integration')
      .addSelect('integration.accessToken') // ✅ Select encrypted token field
      .addSelect('integration.refreshToken') // ✅ Select refresh token if exists
      .leftJoinAndSelect('integration.user', 'user')
      .leftJoinAndSelect('integration.repository', 'repository')
      .where('integration.userId = :userId', { userId });

    if (provider) {
      query.andWhere('integration.provider = :provider', { provider });
    }

    return await query.getMany();
  }

  /**
   * Get integration by ID
   */
  async findOne(id: string, userId: string): Promise<Integration> {
    const integration = await this.integrationRepository
      .createQueryBuilder('integration')
      .addSelect('integration.accessToken') // ✅ Select encrypted token field
      .addSelect('integration.refreshToken') // ✅ Select refresh token if exists
      .leftJoinAndSelect('integration.user', 'user')
      .leftJoinAndSelect('integration.repository', 'repository')
      .where('integration.id = :id', { id })
      .andWhere('integration.userId = :userId', { userId })
      .getOne();

    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    return integration;
  }

  /**
   * Update integration configuration
   */
  async update(
    id: string,
    userId: string,
    dto: UpdateIntegrationDto,
  ): Promise<Integration> {
    const integration = await this.findOne(id, userId);

    if (dto.config) {
      integration.config = { ...integration.config, ...dto.config };
    }

    if (dto.status) {
      integration.status = dto.status;
    }

    return await this.integrationRepository.save(integration);
  }

  /**
   * Create Trello webhook for board
   */
  async createWebhook(integrationId: string, userId: string): Promise<void> {
    const integration = await this.findOne(integrationId, userId);

    if (integration.provider !== 'trello') {
      throw new HttpException('Integration is not Trello', HttpStatus.BAD_REQUEST);
    }

    if (!integration.config?.boardId) {
      throw new HttpException('Board not configured', HttpStatus.BAD_REQUEST);
    }

    if (integration.config?.webhookId) {
      this.logger.log(`Webhook already exists: ${integration.config.webhookId}`);
      return; // Already has webhook
    }

    const apiKey = process.env.TRELLO_API_KEY;
    if (!apiKey) {
      throw new HttpException('TRELLO_API_KEY not configured', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    
    const token = integration.decryptAccessToken();
    if (!token) {
      throw new HttpException('Invalid Trello access token', HttpStatus.BAD_REQUEST);
    }

    try {
      const callbackUrl = `${process.env.BACKEND_URL || 'http://localhost:3000'}/integrations/webhook/trello`;
      
      const webhook = await this.trelloApiService.createWebhook(
        apiKey,
        token,
        integration.config.boardId,
        callbackUrl,
      );

      // Save webhook ID to integration config
      integration.config = {
        ...integration.config,
        webhookId: webhook.id,
      };

      await this.integrationRepository.save(integration);

      this.logger.log(`Created Trello webhook: ${webhook.id} for board ${integration.config.boardId}`);
    } catch (error) {
      this.logger.error('Failed to create Trello webhook', error);
      throw new HttpException(
        'Failed to create webhook',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Delete an integration
   */
  async remove(id: string, userId: string): Promise<void> {
    const integration = await this.findOne(id, userId);

    // Delete Trello webhook if exists
    if (integration.provider === 'trello' && integration.config?.webhookId) {
      try {
        const apiKey = process.env.TRELLO_API_KEY;
        const token = integration.decryptAccessToken();
        if (apiKey && token) {
          await this.trelloApiService.deleteWebhook(apiKey, token, integration.config.webhookId);
        }
      } catch (error) {
        this.logger.warn('Failed to delete Trello webhook', error);
      }
    }

    await this.integrationRepository.remove(integration);
  }

  /**
   * Sync a single task to Trello
   */
  async syncTaskToTrello(taskId: string, userId: string): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['repository', 'repository.user'],
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Find active Trello integration for this repository
    const integration = await this.integrationRepository
      .createQueryBuilder('integration')
      .addSelect('integration.accessToken')
      .where('integration.userId = :userId', { userId })
      .andWhere('integration.provider = :provider', { provider: 'trello' })
      .andWhere('integration.status = :status', { status: 'active' })
      .andWhere(
        '(integration.repositoryId = :repoId OR integration.repositoryId IS NULL)',
        { repoId: task.repository.id },
      )
      .getOne();

    if (!integration || !integration.config?.syncEnabled) {
      throw new HttpException(
        'No active Trello integration found',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const apiKey = process.env.TRELLO_API_KEY;
      if (!apiKey) {
        throw new HttpException('TRELLO_API_KEY not configured', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      
      const token = integration.decryptAccessToken();
      if (!token) {
        throw new HttpException('Invalid Trello access token', HttpStatus.BAD_REQUEST);
      }

      // Determine target list based on task status
      const targetListId = this.getTargetListId(task.status, integration.config);

      if (!targetListId) {
        throw new HttpException(
          `Trello list not configured for status: ${task.status}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      if (task.trelloCardId) {
        // Update existing card
        const updatedCard = await this.trelloApiService.updateCard(
          apiKey,
          token,
          task.trelloCardId,
          {
            name: `${task.type}: ${task.description}`,
            desc: this.buildCardDescription(task),
            idList: targetListId as string,
          },
        );

        task.trelloCardUrl = updatedCard.url;
        task.trelloSyncStatus = 'synced';
        task.trelloLastSyncedAt = new Date();
        delete task.trelloSyncError;
      } else {
        // Create new card
        const card = await this.trelloApiService.createCard(apiKey, token, {
          name: `${task.type}: ${task.description}`,
          desc: this.buildCardDescription(task),
          idList: targetListId as string,
          pos: 'top',
        });

        task.trelloCardId = card.id;
        task.trelloCardUrl = card.url;
        task.trelloSyncStatus = 'synced';
        task.trelloLastSyncedAt = new Date();
        delete task.trelloSyncError;
      }

      return await this.taskRepository.save(task);
    } catch (error) {
      this.logger.error('Failed to sync task to Trello', error);
      
      task.trelloSyncStatus = 'error';
      task.trelloSyncError = error.message;
      await this.taskRepository.save(task);

      throw new HttpException(
        'Failed to sync task to Trello',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Sync all tasks in a repository to Trello
   */
  async syncRepositoryTasks(
    userId: string,
    dto: SyncTasksDto,
  ): Promise<{ synced: number; failed: number; total: number; errors: string[] }> {
    const integration = await this.integrationRepository
      .createQueryBuilder('integration')
      .addSelect('integration.accessToken')
      .where('integration.userId = :userId', { userId })
      .andWhere('integration.provider = :provider', { provider: 'trello' })
      .andWhere('integration.status = :status', { status: 'active' })
      .andWhere(
        dto.repositoryId
          ? 'integration.repositoryId = :repoId'
          : 'integration.repositoryId IS NULL',
        { repoId: dto.repositoryId },
      )
      .getOne();

    if (!integration || !integration.config?.syncEnabled) {
      throw new HttpException(
        'No active Trello integration found',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Get tasks to sync
    const query = this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.repository', 'repository')
      .leftJoinAndSelect('repository.user', 'user')
      .where('user.id = :userId', { userId });

    if (dto.repositoryId) {
      query.andWhere('repository.id = :repoId', { repoId: dto.repositoryId });
    }

    if (!dto.force) {
      query.andWhere(
        '(task.trelloSyncStatus IS NULL OR task.trelloSyncStatus = :status)',
        { status: 'pending' },
      );
    }

    const tasks = await query.getMany();
    
    const total = tasks.length;
    let synced = 0;
    let failed = 0;
    const errors: string[] = [];

    const apiKey = process.env.TRELLO_API_KEY;
    if (!apiKey) {
      throw new HttpException('TRELLO_API_KEY not configured', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    
    const token = integration.decryptAccessToken();
    if (!token) {
      throw new HttpException('Invalid Trello access token', HttpStatus.BAD_REQUEST);
    }

    for (const task of tasks) {
      try {
        const targetListId = this.getTargetListId(task.status, integration.config);

        if (!targetListId) {
          throw new Error(`Trello list not configured for status: ${task.status}`);
        }

        if (task.trelloCardId && !dto.force) {
          // Update existing card
          await this.trelloApiService.updateCard(apiKey, token, task.trelloCardId, {
            name: `${task.type}: ${task.description}`,
            desc: this.buildCardDescription(task),
            idList: targetListId,
          });
        } else {
          // Create new card
          const card = await this.trelloApiService.createCard(apiKey, token, {
            name: `${task.type}: ${task.description}`,
            desc: this.buildCardDescription(task),
            idList: targetListId,
            pos: 'top',
          });

          task.trelloCardId = card.id;
          task.trelloCardUrl = card.url;
        }

        task.trelloSyncStatus = 'synced';
        task.trelloLastSyncedAt = new Date();
        delete task.trelloSyncError;
        await this.taskRepository.save(task);

        synced++;

        // Rate limiting - Trello allows 100 requests per 10 seconds
        if (synced % 50 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      } catch (error) {
        failed++;
        errors.push(`Task ${task.id}: ${error.message}`);
        
        task.trelloSyncStatus = 'error';
        task.trelloSyncError = error.message;
        await this.taskRepository.save(task);
      }
    }

    // Update last sync time
    integration.lastSyncAt = new Date();
    await this.integrationRepository.save(integration);

    this.logger.log(`Sync complete: ${synced} synced, ${failed} failed out of ${total} total`);

    return { synced, failed, total, errors };
  }

  /**
   * Auto-sync a newly created task to Trello (called by TasksService)
   */
  async autoSyncNewTask(taskId: string, userId: string): Promise<void> {
    try {
      const task = await this.taskRepository.findOne({
        where: { id: taskId },
        relations: ['repository', 'repository.user'],
      });

      if (!task) {
        return;
      }

      // Find active Trello integration with auto-create enabled
      const integration = await this.integrationRepository
        .createQueryBuilder('integration')
        .addSelect('integration.accessToken')
        .where('integration.userId = :userId', { userId })
        .andWhere('integration.provider = :provider', { provider: 'trello' })
        .andWhere('integration.status = :status', { status: 'active' })
        .andWhere(
          '(integration.repositoryId = :repoId OR integration.repositoryId IS NULL)',
          { repoId: task.repository.id },
        )
        .getOne();

      if (!integration?.config?.autoCreateCards || !integration.config?.syncEnabled) {
        return; // Auto-sync not enabled
      }

      // Sync the task to Trello
      await this.syncTaskToTrello(taskId, userId);
    } catch (error) {
      this.logger.warn(`Auto-sync failed for task ${taskId}: ${error.message}`);
      // Don't throw - this is best-effort
    }
  }

  /**
   * Handle Trello webhook events with full security and reliability
   */
  async handleTrelloWebhook(
    webhookData: any,
    rawBody?: string,
    signatureHeader?: string,
    callbackUrl?: string,
  ): Promise<{ success: boolean; message: string }> {
    const startTime = Date.now();
    let context: Partial<WebhookContext> = {
      actionType: webhookData.action?.type,
      cardId: webhookData.action?.data?.card?.id,
      timestamp: new Date(),
    };

    try {
      // 1. Security validation (if raw body provided)
      if (rawBody && callbackUrl) {
        const validation = await this.webhookSecurityService.validateWebhook(
          rawBody,
          signatureHeader,
          callbackUrl,
          webhookData,
        );

        if (!validation.isValid) {
          this.logWebhook('rejected', context, validation.error || 'Validation failed');
          
          if (validation.isDuplicate) {
            return { success: true, message: 'Duplicate webhook (already processed)' };
          }
          if (validation.isStale) {
            return { success: false, message: 'Stale webhook rejected' };
          }
          return { success: false, message: validation.error || 'Validation failed' };
        }

        context.webhookId = validation.webhookId;
      }

      const action = webhookData.action;
      
      if (!action) {
        this.logWebhook('skipped', context, 'Missing action data');
        return { success: true, message: 'No action to process' };
      }

      const actionType = action.type;
      const card = action.data?.card;
      const boardId = webhookData.model?.id || action.data?.board?.id;
      
      if (!card?.id) {
        this.logWebhook('skipped', context, 'No card data');
        return { success: true, message: 'No card to process' };
      }

      context.cardId = card.id;
      context.actionType = actionType;

      // 2. Find integration by board ID
      const integration = await this.findIntegrationByBoardId(boardId);
      
      if (!integration) {
        this.logWebhook('skipped', context, 'No integration for board');
        return { success: false, message: 'No integration found for this board' };
      }

      // 3. Check if integration is still active
      if (integration.status !== 'active') {
        this.logWebhook('skipped', context, `Integration status: ${integration.status}`);
        return { success: false, message: 'Integration is not active' };
      }

      context.integrationId = integration.id;
      context.userId = integration.user?.id;

      // 4. Acquire distributed lock for the card
      const lockAcquired = await this.webhookSecurityService.acquireLock(card.id);
      if (!lockAcquired) {
        this.logWebhook('deferred', context, 'Card locked by another process');
        // Queue for retry instead of failing
        await this.webhookSecurityService.queueForRetry(
          webhookData,
          'Card locked by concurrent operation',
          0,
        );
        return { success: true, message: 'Queued for processing (card locked)' };
      }

      try {
        // 5. Process the webhook action
        switch (actionType) {
          case 'updateCard':
            await this.handleCardUpdate(action, integration, context);
            break;
          case 'deleteCard':
            await this.handleCardDelete(card.id, context);
            break;
          case 'updateCheckItemStateOnCard':
            await this.handleChecklistUpdate(action, context);
            break;
          case 'addMemberToCard':
          case 'removeMemberFromCard':
            await this.handleMemberChange(action, context);
            break;
          default:
            this.logWebhook('skipped', context, `Unhandled action: ${actionType}`);
        }

        // 6. Mark as successfully processed
        if (context.webhookId) {
          await this.webhookSecurityService.markAsProcessed(context.webhookId, {
            id: context.webhookId,
            processedAt: new Date(),
            actionType,
            cardId: card.id,
            result: 'success',
          });
        }

        const duration = Date.now() - startTime;
        this.logWebhook('success', context, `Processed in ${duration}ms`);
        return { success: true, message: 'Webhook processed successfully' };

      } finally {
        // Always release the lock
        await this.webhookSecurityService.releaseLock(card.id);
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logWebhook('error', context, error.message);

      // Queue for retry
      await this.webhookSecurityService.queueForRetry(webhookData, error.message, 0);

      // Mark as failed in idempotency store
      if (context.webhookId) {
        await this.webhookSecurityService.markAsProcessed(context.webhookId, {
          id: context.webhookId,
          processedAt: new Date(),
          actionType: context.actionType || 'unknown',
          cardId: context.cardId || 'unknown',
          result: 'failed',
          error: error.message,
        });
      }

      return { success: false, message: error.message };
    }
  }

  /**
   * Process webhook with retry context
   */
  private async processWebhookWithRetry(payload: any, retryCount: number): Promise<void> {
    try {
      const result = await this.handleTrelloWebhook(payload);
      
      if (!result.success && retryCount < 5) {
        await this.webhookSecurityService.queueForRetry(payload, result.message, retryCount);
      }
    } catch (error) {
      this.logger.error(`Retry processing failed: ${error.message}`);
      if (retryCount < 5) {
        await this.webhookSecurityService.queueForRetry(payload, error.message, retryCount);
      }
    }
  }

  /**
   * Find integration by Trello board ID
   */
  private async findIntegrationByBoardId(boardId: string): Promise<Integration | null> {
    if (!boardId) return null;

    return await this.integrationRepository
      .createQueryBuilder('integration')
      .addSelect('integration.accessToken')
      .leftJoinAndSelect('integration.user', 'user')
      .where('integration.provider = :provider', { provider: 'trello' })
      .andWhere("integration.config->>'boardId' = :boardId", { boardId })
      .getOne();
  }

  /**
   * Structured logging for webhooks
   */
  private logWebhook(
    status: 'success' | 'error' | 'skipped' | 'rejected' | 'deferred',
    context: Partial<WebhookContext>,
    message: string,
  ): void {
    const logData = {
      status,
      actionType: context.actionType,
      cardId: context.cardId,
      userId: context.userId,
      integrationId: context.integrationId,
      taskId: context.taskId,
      message,
      timestamp: new Date().toISOString(),
    };

    const emoji = {
      success: '✅',
      error: '❌',
      skipped: '⏭️',
      rejected: '🚫',
      deferred: '⏳',
    }[status];

    if (status === 'error') {
      this.logger.error(`${emoji} Webhook ${status}: ${JSON.stringify(logData)}`);
    } else if (status === 'rejected') {
      this.logger.warn(`${emoji} Webhook ${status}: ${JSON.stringify(logData)}`);
    } else {
      this.logger.log(`${emoji} Webhook ${status}: ${JSON.stringify(logData)}`);
    }
  }

  /**
   * Handle Trello card update with conflict resolution
   */
  private async handleCardUpdate(
    action: any,
    integration: Integration,
    context: Partial<WebhookContext>,
  ): Promise<void> {
    const cardId = action.data.card.id;
    const listAfter = action.data.listAfter;
    const listBefore = action.data.listBefore;
    const old = action.data.old;

    this.logger.log(`Processing card update for card ${cardId}`);

    // Use transaction for atomicity
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const task = await queryRunner.manager.findOne(Task, {
        where: { trelloCardId: cardId },
        relations: ['repository', 'repository.user'],
      });

      if (!task) {
        this.logWebhook('skipped', context, `Task not found for card ${cardId}`);
        await queryRunner.commitTransaction();
        return;
      }

      context.taskId = task.id;
      context.userId = task.repository.user?.id;

      // Check for local modifications (conflict detection)
      const lastLocalUpdate = task.lastModifiedAt?.getTime() || task.trelloLastSyncedAt?.getTime() || 0;
      const webhookTime = new Date(action.date).getTime();
      
      // If task was updated locally within 5 seconds of webhook, there may be a conflict
      if (lastLocalUpdate > webhookTime - 5000 && lastLocalUpdate < webhookTime + 5000) {
        this.logger.warn(`Potential conflict detected for task ${task.id} - local update near webhook time`);
        // For now, let Trello win (last-write-wins), but log it
      }

      let taskUpdated = false;
      let statusChange: { from: string; to: string } | null = null;

      // Handle list change (card moved)
      if (listAfter && listBefore && listAfter.id !== listBefore.id) {
        let newStatus = task.status;
        
        if (listAfter.id === integration.config?.todoListId) {
          newStatus = 'open';
        } else if (listAfter.id === integration.config?.inProgressListId) {
          newStatus = 'in-progress';
        } else if (listAfter.id === integration.config?.doneListId) {
          newStatus = 'done';
        } else {
          // Card moved to unmapped list - log warning
          this.logger.warn(
            `Card ${cardId} moved to unmapped list "${listAfter.name}" (${listAfter.id}). ` +
            `Configured lists: todo=${integration.config?.todoListId}, ` +
            `inProgress=${integration.config?.inProgressListId}, ` +
            `done=${integration.config?.doneListId}`,
          );
        }

        if (newStatus !== task.status) {
          statusChange = { from: task.status, to: newStatus };
          task.status = newStatus;
          taskUpdated = true;
          this.logger.log(
            `Updated task ${task.id} status: ${statusChange.from} → ${statusChange.to}`,
          );
        }
      }

      // Handle name change with fallback parsing
      if (old?.name && action.data.card.name !== old.name) {
        const newName = action.data.card.name;
        // Try to parse "TYPE: description" format
        const match = newName.match(/^([A-Z]+):\s*(.+)$/);
        if (match) {
          const [, type, description] = match;
          task.type = type;
          task.description = description;
          taskUpdated = true;
        } else {
          // Fallback: use entire name as description, keep existing type
          this.logger.warn(`Card name doesn't match expected format: "${newName}". Using as description.`);
          task.description = newName;
          taskUpdated = true;
        }
      }

      // Handle archive/unarchive
      if (old?.closed !== undefined && action.data.card.closed !== old.closed) {
        if (action.data.card.closed) {
          statusChange = { from: task.status, to: 'done' };
          task.status = 'done';
          taskUpdated = true;
        } else {
          statusChange = { from: task.status, to: 'open' };
          task.status = 'open';
          taskUpdated = true;
        }
      }

      if (taskUpdated) {
        task.trelloLastSyncedAt = new Date();
        await queryRunner.manager.save(task);
        await queryRunner.commitTransaction();

        // Send notification to user about the change
        if (statusChange && context.userId) {
          await this.notificationsService.emit(context.userId, {
            type: NotificationType.TASK_UPDATED,
            title: 'Task Updated from Trello',
            message: `Task "${task.description.substring(0, 50)}..." status changed to ${statusChange.to}`,
            data: {
              taskId: task.id,
              source: 'trello',
              statusChange,
              cardId,
            },
            timestamp: new Date(),
          });
        }
      } else {
        await queryRunner.commitTransaction();
      }

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Handle Trello card deletion
   */
  private async handleCardDelete(
    cardId: string,
    context: Partial<WebhookContext>,
  ): Promise<void> {
    const task = await this.taskRepository.findOne({
      where: { trelloCardId: cardId },
      relations: ['repository', 'repository.user'],
    });

    if (!task) {
      this.logWebhook('skipped', context, `Task not found for deleted card ${cardId}`);
      return;
    }

    context.taskId = task.id;
    context.userId = task.repository.user?.id;

    // Clear Trello association but don't delete the task
    task.trelloCardId = undefined;
    task.trelloCardUrl = undefined;
    task.trelloSyncStatus = undefined;
    task.trelloLastSyncedAt = undefined;
    delete task.trelloSyncError;

    await this.taskRepository.save(task);
    
    this.logger.log(`Cleared Trello association for task ${task.id} (card deleted)`);

    // Notify user
    if (context.userId) {
      await this.notificationsService.emit(context.userId, {
        type: NotificationType.TASK_UPDATED,
        title: 'Trello Card Deleted',
        message: `Trello card for task "${task.description.substring(0, 50)}..." was deleted`,
        data: {
          taskId: task.id,
          source: 'trello',
          action: 'card_deleted',
        },
        timestamp: new Date(),
      });
    }
  }

  /**
   * Handle checklist item state change
   */
  private async handleChecklistUpdate(
    action: any,
    context: Partial<WebhookContext>,
  ): Promise<void> {
    const cardId = action.data.card.id;
    const checkItem = action.data.checkItem;

    const task = await this.taskRepository.findOne({
      where: { trelloCardId: cardId },
      relations: ['repository', 'repository.user'],
    });

    if (!task) {
      return;
    }

    context.taskId = task.id;
    context.userId = task.repository.user?.id;

    // If checklist item completed, mark task as done
    if (checkItem?.state === 'complete') {
      task.status = 'done';
      task.trelloLastSyncedAt = new Date();
      await this.taskRepository.save(task);
      this.logger.log(`Task ${task.id} marked as done (checklist completed)`);
    }
  }

  /**
   * Handle member added/removed from card
   */
  private async handleMemberChange(
    action: any,
    context: Partial<WebhookContext>,
  ): Promise<void> {
    const cardId = action.data.card.id;
    const member = action.member;

    const task = await this.taskRepository.findOne({
      where: { trelloCardId: cardId },
    });

    if (!task) {
      return;
    }

    context.taskId = task.id;

    this.logger.log(
      `Member ${member?.username} ${action.type === 'addMemberToCard' ? 'added to' : 'removed from'} card for task ${task.id}`,
    );
  }

  /**
   * Handle Trello card moved (from webhook) - DEPRECATED, use handleCardUpdate instead
   */
  async handleTrelloCardMoved(cardId: string, newListId: string): Promise<void> {
    const task = await this.taskRepository.findOne({
      where: { trelloCardId: cardId },
      relations: ['repository', 'repository.user'],
    });

    if (!task) {
      this.logger.warn(`Task not found for Trello card: ${cardId}`);
      return;
    }

    const integration = await this.integrationRepository.findOne({
      where: {
        user: { id: task.repository.user.id },
        provider: 'trello',
        status: 'active',
      },
    });

    if (!integration || !integration.config?.autoMoveCards) {
      return;
    }

    // Map list to status
    let newStatus = task.status;
    if (newListId === integration.config.todoListId) {
      newStatus = 'open';
    } else if (newListId === integration.config.inProgressListId) {
      newStatus = 'in-progress';
    } else if (newListId === integration.config.doneListId) {
      newStatus = 'done';
    }

    if (newStatus !== task.status) {
      task.status = newStatus;
      task.trelloLastSyncedAt = new Date();
      await this.taskRepository.save(task);
      
      this.logger.log(`Updated task ${task.id} status to ${newStatus} from Trello`);
    }
  }

  /**
   * Build Trello card description from task
   */
  private buildCardDescription(task: Task): string {
    const lines = [
      `**Repository:** ${task.repository.name}`,
      `**File:** \`${task.filePath}\``,
      `**Line:** ${task.lineNumber}`,
      `**Priority:** ${task.priority}`,
      `**Status:** ${task.status}`,
      '',
      `**Description:**`,
      task.description,
    ];

    if (task.addedBy) {
      lines.push('', `**Added by:** ${task.addedBy}`);
    }

    if (task.ai_summary) {
      lines.push('', `**AI Summary:**`, task.ai_summary);
    }

    return lines.join('\n');
  }

  /**
   * Get target Trello list ID based on task status
   */
  private getTargetListId(status: string, config: any): string | undefined {
    switch (status) {
      case 'open':
      case 'pending':
        return config.todoListId;
      case 'in-progress':
        return config.inProgressListId || config.todoListId; // Fallback to todo
      case 'done':
      case 'completed':
        return config.doneListId || config.todoListId; // Fallback to todo
      default:
        return config.todoListId;
    }
  }
}
