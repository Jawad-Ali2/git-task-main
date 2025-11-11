import { Injectable, Logger, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository } from 'typeorm';
import { Integration } from '../entities/integration.entity';
import { Task } from '../../tasks/entities/tasks.entity';
import { Repository } from '../../repositories/entities/repository.entity';
import { TrelloApiService } from './trello-api.service';
import { CreateIntegrationDto, UpdateIntegrationDto, SyncTasksDto } from '../dto/integration.dto';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    @InjectRepository(Integration)
    private integrationRepository: TypeOrmRepository<Integration>,
    @InjectRepository(Task)
    private taskRepository: TypeOrmRepository<Task>,
    @InjectRepository(Repository)
    private repositoryRepository: TypeOrmRepository<Repository>,
    private trelloApiService: TrelloApiService,
  ) {}

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
   * Handle Trello webhook events (full bi-directional sync)
   */
  async handleTrelloWebhook(webhookData: any): Promise<void> {
    try {
      const action = webhookData.action;
      
      if (!action) {
        this.logger.warn('Webhook data missing action');
        return;
      }

      const actionType = action.type;
      const card = action.data?.card;
      
      if (!card?.id) {
        this.logger.warn(`Webhook action ${actionType} has no card data`);
        return;
      }

      this.logger.log(`Trello webhook: ${actionType} for card ${card.id}`);

      switch (actionType) {
        case 'updateCard':
          await this.handleCardUpdate(action);
          break;
        case 'deleteCard':
          await this.handleCardDelete(card.id);
          break;
        case 'updateCheckItemStateOnCard':
          await this.handleChecklistUpdate(action);
          break;
        case 'addMemberToCard':
        case 'removeMemberFromCard':
          await this.handleMemberChange(action);
          break;
        default:
          this.logger.debug(`Unhandled webhook action: ${actionType}`);
      }
    } catch (error) {
      this.logger.error('Failed to process Trello webhook', error);
    }
  }

  /**
   * Handle Trello card update (move, rename, description change)
   */
  private async handleCardUpdate(action: any): Promise<void> {
    const cardId = action.data.card.id;
    const listAfter = action.data.listAfter;
    const listBefore = action.data.listBefore;
    const old = action.data.old;

    this.logger.log(`Processing card update for card ${cardId}`);
    this.logger.log(`List change: ${listBefore?.name || 'N/A'} → ${listAfter?.name || 'N/A'}`);

    const task = await this.taskRepository.findOne({
      where: { trelloCardId: cardId },
      relations: ['repository', 'repository.user'],
    });

    if (!task) {
      this.logger.warn(`Task not found for Trello card: ${cardId}`);
      return;
    }

    this.logger.log(`Found task: ${task.id} (current status: ${task.status})`);

    const integration = await this.integrationRepository.findOne({
      where: {
        user: { id: task.repository.user.id },
        provider: 'trello',
        status: 'active',
      },
    });

    if (!integration) {
      this.logger.warn(`No active Trello integration found for user ${task.repository.user.id}`);
      return;
    }

    this.logger.log(`Integration config:`, {
      todoListId: integration.config?.todoListId,
      inProgressListId: integration.config?.inProgressListId,
      doneListId: integration.config?.doneListId,
      autoMoveCards: integration.config?.autoMoveCards,
    });

    let taskUpdated = false;

    // Handle list change (card moved) - ALWAYS sync, don't check autoMoveCards
    if (listAfter && listBefore && listAfter.id !== listBefore.id) {
      let newStatus = task.status;
      
      if (listAfter.id === integration.config.todoListId) {
        newStatus = 'open';
      } else if (listAfter.id === integration.config.inProgressListId) {
        newStatus = 'in-progress';
      } else if (listAfter.id === integration.config.doneListId) {
        newStatus = 'done';
      }

      if (newStatus !== task.status) {
        task.status = newStatus;
        taskUpdated = true;
        this.logger.log(
          `✅ Updated task ${task.id} status to ${newStatus} (moved from ${listBefore.name} to ${listAfter.name})`
        );
      } else {
        this.logger.log(`Status unchanged (${newStatus}) - list ${listAfter.id} not mapped to a different status`);
      }
    }

    // Handle name change
    if (old?.name && action.data.card.name !== old.name) {
      // Extract description from card name (format: "TYPE: description")
      const match = action.data.card.name.match(/^([A-Z]+):\s*(.+)$/);
      if (match) {
        const [, type, description] = match;
        task.type = type;
        task.description = description;
        taskUpdated = true;
        this.logger.log(`Updated task ${task.id} from card name change`);
      }
    }

    // Handle description change
    if (old?.desc !== undefined && action.data.card.desc !== old.desc) {
      // Could parse description to extract more metadata if needed
      taskUpdated = true;
      this.logger.log(`Task ${task.id} description updated in Trello`);
    }

    // Handle archive/unarchive
    if (old?.closed !== undefined && action.data.card.closed !== old.closed) {
      if (action.data.card.closed) {
        task.status = 'done';
        taskUpdated = true;
        this.logger.log(`Task ${task.id} marked as done (card archived)`);
      } else {
        task.status = 'open';
        taskUpdated = true;
        this.logger.log(`Task ${task.id} reopened (card unarchived)`);
      }
    }

    if (taskUpdated) {
      task.trelloLastSyncedAt = new Date();
      await this.taskRepository.save(task);
    }
  }

  /**
   * Handle Trello card deletion
   */
  private async handleCardDelete(cardId: string): Promise<void> {
    const task = await this.taskRepository.findOne({
      where: { trelloCardId: cardId },
    });

    if (!task) {
      this.logger.warn(`Task not found for deleted Trello card: ${cardId}`);
      return;
    }

    // Clear Trello association but don't delete the task
    task.trelloCardId = undefined;
    task.trelloCardUrl = undefined;
    task.trelloSyncStatus = undefined;
    task.trelloLastSyncedAt = undefined;
    delete task.trelloSyncError;

    await this.taskRepository.save(task);
    this.logger.log(`Cleared Trello association for task ${task.id} (card deleted)`);
  }

  /**
   * Handle checklist item state change
   */
  private async handleChecklistUpdate(action: any): Promise<void> {
    const cardId = action.data.card.id;
    const checkItem = action.data.checkItem;

    const task = await this.taskRepository.findOne({
      where: { trelloCardId: cardId },
    });

    if (!task) {
      return;
    }

    // If checklist item completed, mark task as done
    if (checkItem.state === 'complete') {
      task.status = 'done';
      task.trelloLastSyncedAt = new Date();
      await this.taskRepository.save(task);
      this.logger.log(`Task ${task.id} marked as done (checklist completed)`);
    }
  }

  /**
   * Handle member added/removed from card
   */
  private async handleMemberChange(action: any): Promise<void> {
    const cardId = action.data.card.id;
    const member = action.member;

    const task = await this.taskRepository.findOne({
      where: { trelloCardId: cardId },
    });

    if (!task) {
      return;
    }

    // Could update assignee field if it exists
    this.logger.log(`Member ${member.username} ${action.type === 'addMemberToCard' ? 'added to' : 'removed from'} card for task ${task.id}`);
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
