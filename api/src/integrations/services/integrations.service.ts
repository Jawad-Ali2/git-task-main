import { Injectable, Logger, HttpException, HttpStatus, NotFoundException, Inject, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository, DataSource } from 'typeorm';
import { Integration } from '../entities/integration.entity';
import { Task } from '../../tasks/entities/tasks.entity';
import { Repository } from '../../repositories/entities/repository.entity';
import { TrelloApiService, TrelloCard } from './trello-api.service';
import { TrelloWebhookSecurityService } from './trello-webhook-security.service';
import { JiraApiService } from './jira/jira-api.service';
import { JiraWebhookSecurityService } from './jira/jira-webhook-security.service';
import { CreateIntegrationDto, UpdateIntegrationDto, SyncTasksDto } from '../dto/integration.dto';
import { NotificationsService, NotificationType } from '../../notifications/notifications.service';
import { JiraConfig, TrelloConfig } from '../interfaces/provider-config.interface';
import { JiraWebhookEvent } from '../interfaces/webhook-handler.interface';
import Redis from 'ioredis';

export interface WebhookContext {
  provider?: 'trello' | 'jira';
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
    private jiraApiService: JiraApiService,
    private jiraWebhookSecurityService: JiraWebhookSecurityService,
    private notificationsService: NotificationsService,
    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
    private dataSource: DataSource,
  ) {}

  /**
   * Initialize retry processor subscription
   */
  async onModuleInit() {
    // Subscribe to Trello retry events
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

    // Subscribe to Jira retry events
    const jiraSubscriber = this.redis.duplicate();
    await jiraSubscriber.subscribe('jira:webhook:retry');
    
    jiraSubscriber.on('message', async (channel, message) => {
      if (channel === 'jira:webhook:retry') {
        try {
          const { payload, retryCount } = JSON.parse(message);
          await this.processJiraWebhookWithRetry(payload, retryCount);
        } catch (error) {
          this.logger.error(`Failed to process Jira retry: ${error.message}`);
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
   * Get user-level OAuth connections (repositoryId = NULL)
   * These are integrations that have OAuth tokens but are not linked to a specific repository
   */
  async getUserConnections(userId: string): Promise<Integration[]> {
    return await this.integrationRepository
      .createQueryBuilder('integration')
      .addSelect('integration.accessToken')
      .addSelect('integration.refreshToken')
      .leftJoinAndSelect('integration.user', 'user')
      .where('integration.userId = :userId', { userId })
      .andWhere('integration.repositoryId IS NULL')
      .getMany();
  }

  /**
   * Get integrations for a specific repository
   */
  async getRepositoryIntegrations(userId: string, repositoryId: string): Promise<Integration[]> {
    return await this.integrationRepository
      .createQueryBuilder('integration')
      .addSelect('integration.accessToken')
      .addSelect('integration.refreshToken')
      .leftJoinAndSelect('integration.user', 'user')
      .leftJoinAndSelect('integration.repository', 'repository')
      .where('integration.userId = :userId', { userId })
      .andWhere('integration.repositoryId = :repositoryId', { repositoryId })
      .getMany();
  }

  /**
   * Check if user has a user-level OAuth connection for a provider
   */
  async hasUserConnection(userId: string, provider: 'trello' | 'jira'): Promise<boolean> {
    const connection = await this.integrationRepository
      .createQueryBuilder('integration')
      .where('integration.userId = :userId', { userId })
      .andWhere('integration.provider = :provider', { provider })
      .andWhere('integration.repositoryId IS NULL')
      .getOne();
    
    return !!connection;
  }

  /**
   * Link a repository to an existing user-level OAuth connection
   * Creates a new repo-specific integration with copied tokens
   */
  async linkRepositoryToProvider(
    userId: string,
    repositoryId: string,
    provider: 'trello' | 'jira',
  ): Promise<Integration> {
    // Check if repository already has this provider linked
    const existingRepoIntegration = await this.integrationRepository
      .createQueryBuilder('integration')
      .where('integration.userId = :userId', { userId })
      .andWhere('integration.repositoryId = :repositoryId', { repositoryId })
      .andWhere('integration.provider = :provider', { provider })
      .getOne();

    if (existingRepoIntegration) {
      throw new HttpException(
        `This repository is already linked to ${provider}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Check if repository already has another PM tool linked
    const existingOtherIntegration = await this.integrationRepository
      .createQueryBuilder('integration')
      .where('integration.userId = :userId', { userId })
      .andWhere('integration.repositoryId = :repositoryId', { repositoryId })
      .andWhere('integration.isConfigured = :isConfigured', { isConfigured: true })
      .getOne();

    if (existingOtherIntegration) {
      throw new HttpException(
        `This repository is already linked to ${existingOtherIntegration.provider}. Unlink it first.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Get user-level OAuth connection with tokens
    const userConnection = await this.integrationRepository
      .createQueryBuilder('integration')
      .addSelect('integration.accessToken')
      .addSelect('integration.refreshToken')
      .where('integration.userId = :userId', { userId })
      .andWhere('integration.provider = :provider', { provider })
      .andWhere('integration.repositoryId IS NULL')
      .getOne();

    if (!userConnection) {
      throw new HttpException(
        `No ${provider} connection found. Please connect ${provider} first from Dashboard Settings.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Verify repository exists and belongs to user
    const repository = await this.repositoryRepository.findOne({
      where: { id: repositoryId, user: { id: userId } },
    });

    if (!repository) {
      throw new NotFoundException('Repository not found');
    }

    // Build config - copy essential OAuth-related fields from user connection
    let config: TrelloConfig | JiraConfig;
    if (provider === 'trello') {
      config = { 
        syncEnabled: false, 
        autoCreateCards: false, 
        autoMoveCards: false 
      } as TrelloConfig;
    } else {
      // For Jira, copy cloudId and siteUrl from user connection - these are required for API calls
      const userConfig = userConnection.config as JiraConfig;
      config = { 
        cloudId: userConfig?.cloudId,
        siteUrl: userConfig?.siteUrl,
        syncEnabled: false, 
        autoCreateIssues: false, 
        autoTransitionIssues: false 
      } as JiraConfig;
    }

    // Create new repo-specific integration with copied tokens
    const repoIntegration = this.integrationRepository.create({
      provider,
      accessToken: userConnection.accessToken, // Already encrypted
      refreshToken: userConnection.refreshToken,
      tokenExpiresAt: userConnection.tokenExpiresAt,
      user: { id: userId } as any,
      repository: { id: repositoryId } as any,
      status: 'active',
      isConfigured: false, // Needs configuration
      config,
    });

    return await this.integrationRepository.save(repoIntegration) as unknown as Integration;
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
      
      // Auto-set isConfigured based on required fields being present
      if (integration.provider === 'trello') {
        const config = integration.config as TrelloConfig;
        integration.isConfigured = !!(config.boardId && config.todoListId);
      } else if (integration.provider === 'jira') {
        const config = integration.config as JiraConfig;
        integration.isConfigured = !!(config.projectId && config.issueTypeId && config.todoStatusId);
      }
    }

    if (dto.status) {
      integration.status = dto.status;
    }

    return await this.integrationRepository.save(integration);
  }

  /**
   * Update integration tokens (for OAuth token refresh)
   * This method encrypts the tokens before saving
   */
  async updateTokens(
    id: string,
    tokens: {
      accessToken: string;
      refreshToken?: string;
      tokenExpiresAt?: Date;
    },
  ): Promise<void> {
    const integration = await this.integrationRepository
      .createQueryBuilder('integration')
      .where('integration.id = :id', { id })
      .getOne();

    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    // Use the entity's setter which handles encryption
    integration.accessToken = tokens.accessToken;
    if (tokens.refreshToken) {
      integration.refreshToken = tokens.refreshToken;
    }
    if (tokens.tokenExpiresAt) {
      integration.tokenExpiresAt = tokens.tokenExpiresAt;
    }

    // Successful token refresh means auth is healthy again
    integration.status = 'active';
    integration.lastError = undefined;

    await this.integrationRepository.save(integration);
  }

  /**
   * Mark integration authentication as invalid to avoid repeated failing refresh attempts
   */
  async markIntegrationAuthError(id: string, message: string): Promise<void> {
    await this.integrationRepository
      .createQueryBuilder()
      .update(Integration)
      .set({
        status: 'error',
        lastError: message,
      })
      .where('id = :id', { id })
      .execute();
  }

  /**
   * Create Trello webhook for board
   */
  async createWebhook(integrationId: string, userId: string): Promise<void> {
    const integration = await this.findOne(integrationId, userId);

    if (integration.provider !== 'trello') {
      throw new HttpException('Integration is not Trello', HttpStatus.BAD_REQUEST);
    }

    const config = integration.config as TrelloConfig;
    if (!config?.boardId) {
      throw new HttpException('Board not configured', HttpStatus.BAD_REQUEST);
    }

    if (config?.webhookId) {
      this.logger.log(`Webhook already exists: ${config.webhookId}`);
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
        config.boardId,
        callbackUrl,
      );

      // Save webhook ID to integration config
      integration.config = {
        ...config,
        webhookId: webhook.id,
      };

      await this.integrationRepository.save(integration);

      this.logger.log(`Created Trello webhook: ${webhook.id} for board ${config.boardId}`);
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

    // If a repository-specific PM integration is unlinked,
    // clear provider links from tasks in that repository.
    if (integration.repository?.id) {
      if (integration.provider === 'trello') {
        await this.taskRepository
          .createQueryBuilder()
          .update(Task)
          .set({
            trelloCardId: () => 'NULL',
            trelloCardUrl: () => 'NULL',
            trelloSyncStatus: 'disabled',
            trelloLastSyncedAt: () => 'NULL',
            trelloSyncError: () => 'NULL',
          })
          .where('repositoryId = :repositoryId', { repositoryId: integration.repository.id })
          .execute();
      }

      if (integration.provider === 'jira') {
        await this.taskRepository
          .createQueryBuilder()
          .update(Task)
          .set({
            jiraIssueId: () => 'NULL',
            jiraIssueKey: () => 'NULL',
            jiraIssueUrl: () => 'NULL',
            jiraSyncStatus: 'disabled',
            jiraLastSyncedAt: () => 'NULL',
            jiraSyncError: () => 'NULL',
          })
          .where('repositoryId = :repositoryId', { repositoryId: integration.repository.id })
          .execute();
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
    // Prioritize repo-specific integration over user-level integration
    let integration = await this.integrationRepository
      .createQueryBuilder('integration')
      .addSelect('integration.accessToken')
      .where('integration.userId = :userId', { userId })
      .andWhere('integration.provider = :provider', { provider: 'trello' })
      .andWhere('integration.status = :status', { status: 'active' })
      .andWhere('integration.repositoryId = :repoId', { repoId: task.repository.id })
      .andWhere('integration.isConfigured = :isConfigured', { isConfigured: true })
      .getOne();

    if (!integration) {
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
        '(task.trelloCardId IS NULL OR task.trelloSyncStatus IS NULL OR task.trelloSyncStatus IN (:...syncStatuses))',
        { syncStatuses: ['pending', 'error', 'disabled'] },
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

    const trelloConfig = integration.config as TrelloConfig;
    let boardCards: TrelloCard[] = [];
    const cardByTaskId = new Map<string, TrelloCard>();

    // Best-effort prefetch for idempotent syncs (avoids duplicate cards on retries)
    if (!dto.force && trelloConfig?.boardId) {
      try {
        boardCards = await this.trelloApiService.getBoardCards(apiKey, token, trelloConfig.boardId);
        for (const card of boardCards) {
          const taskId = this.extractGitTaskIdFromCard(card.desc);
          if (taskId) {
            cardByTaskId.set(taskId, card);
          }
        }
      } catch (error) {
        this.logger.warn(`Unable to prefetch Trello cards for dedupe: ${error.message}`);
      }
    }

    for (const task of tasks) {
      try {
        const targetListId = this.getTargetListId(task.status, integration.config);

        if (!targetListId) {
          throw new Error(`Trello list not configured for status: ${task.status}`);
        }

        let linkedCard: TrelloCard | undefined;

        if (!dto.force && task.trelloCardId) {
          linkedCard = {
            id: task.trelloCardId,
            name: '',
            desc: '',
            url: task.trelloCardUrl || '',
            idList: '',
            idBoard: trelloConfig?.boardId || '',
            labels: [],
            pos: 0,
          };
        }

        // Recover missing task->card links if card exists in board already
        if (!dto.force && !linkedCard) {
          linkedCard = cardByTaskId.get(task.id);
          if (!linkedCard) {
            linkedCard = this.findExistingCardForTask(task, boardCards);
          }

          if (linkedCard) {
            task.trelloCardId = linkedCard.id;
            task.trelloCardUrl = linkedCard.url;
          }
        }

        if (linkedCard && !dto.force) {
          // Update existing card (including recovered card links)
          await this.trelloApiService.updateCard(apiKey, token, linkedCard.id, {
            name: `${task.type}: ${task.description}`,
            desc: this.buildCardDescription(task),
            idList: targetListId,
          });
          task.trelloCardId = linkedCard.id;
          task.trelloCardUrl = linkedCard.url;
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
      .andWhere('integration.status = :status', { status: 'active' })
      .andWhere('integration.isConfigured = :isConfigured', { isConfigured: true })
      .andWhere('integration.repositoryId IS NOT NULL')
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
      const trelloConfig = integration.config as TrelloConfig;

      // Handle list change (card moved)
      if (listAfter && listBefore && listAfter.id !== listBefore.id) {
        let newStatus = task.status;
        
        if (listAfter.id === trelloConfig?.todoListId) {
          newStatus = 'open';
        } else if (listAfter.id === trelloConfig?.inProgressListId) {
          newStatus = 'in-progress';
        } else if (listAfter.id === trelloConfig?.doneListId) {
          newStatus = 'done';
        } else {
          // Card moved to unmapped list - log warning
          this.logger.warn(
            `Card ${cardId} moved to unmapped list "${listAfter.name}" (${listAfter.id}). ` +
            `Configured lists: todo=${trelloConfig?.todoListId}, ` +
            `inProgress=${trelloConfig?.inProgressListId}, ` +
            `done=${trelloConfig?.doneListId}`,
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

    const trelloConfig = integration.config as TrelloConfig;

    // Map list to status
    let newStatus = task.status;
    if (newListId === trelloConfig.todoListId) {
      newStatus = 'open';
    } else if (newListId === trelloConfig.inProgressListId) {
      newStatus = 'in-progress';
    } else if (newListId === trelloConfig.doneListId) {
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
      `<!-- GITTASK_TASK_ID:${task.id} -->`,
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

  private extractGitTaskIdFromCard(desc?: string): string | undefined {
    if (!desc) {
      return undefined;
    }

    const match = desc.match(/GITTASK_TASK_ID:([a-f0-9\-]{36})/i);
    return match?.[1];
  }

  private findExistingCardForTask(task: Task, cards: TrelloCard[]): TrelloCard | undefined {
    if (!cards.length) {
      return undefined;
    }

    const expectedName = `${task.type}: ${task.description}`;
    const fileSignature = `**File:** \`${task.filePath}\``;
    const lineSignature = `**Line:** ${task.lineNumber}`;

    return cards.find((card) => {
      if (card.name !== expectedName) {
        return false;
      }

      const desc = card.desc || '';
      return desc.includes(fileSignature) && desc.includes(lineSignature);
    });
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

  // ==================== JIRA INTEGRATION METHODS ====================

  /**
   * Sync all tasks in a repository to Jira
   */
  async syncJiraRepositoryTasks(
    userId: string,
    dto: SyncTasksDto,
  ): Promise<{ synced: number; failed: number; total: number; errors: string[] }> {
    const integration = await this.integrationRepository
      .createQueryBuilder('integration')
      .addSelect('integration.accessToken')
      .addSelect('integration.refreshToken')
      .where('integration.userId = :userId', { userId })
      .andWhere('integration.provider = :provider', { provider: 'jira' })
      .andWhere('integration.status = :status', { status: 'active' })
      .andWhere(
        dto.repositoryId
          ? 'integration.repositoryId = :repoId'
          : 'integration.repositoryId IS NULL',
        { repoId: dto.repositoryId },
      )
      .getOne();

    if (!integration) {
      throw new HttpException(
        'No active Jira integration found for this repository',
        HttpStatus.BAD_REQUEST,
      );
    }

    const config = integration.config as JiraConfig;
    if (!config?.syncEnabled) {
      throw new HttpException(
        'Jira sync is not enabled. Please configure Jira first.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!config.cloudId || !config.projectId || !config.issueTypeId) {
      throw new HttpException(
        'Jira project not fully configured',
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
        '(task.jiraIssueId IS NULL OR task.jiraSyncStatus IS NULL OR task.jiraSyncStatus IN (:...syncStatuses))',
        { syncStatuses: ['pending', 'error', 'disabled'] },
      );
    }

    const tasks = await query.getMany();
    
    const total = tasks.length;
    let synced = 0;
    let failed = 0;
    const errors: string[] = [];

    const token = await this.ensureValidJiraToken(integration);

    for (const task of tasks) {
      try {
        const targetStatusId = this.getJiraTargetStatusId(task.status, config);

        if (task.jiraIssueId && !dto.force) {
          // Update existing issue
          await this.jiraApiService.updateIssue(
            config.cloudId,
            token,
            task.jiraIssueKey!,
            {
              summary: `${task.type}: ${task.description}`,
              description: this.buildJiraIssueDescription(task),
            },
          );

          // Handle status transition if needed
          if (targetStatusId) {
            try {
              await this.transitionJiraIssue(
                config.cloudId,
                token,
                task.jiraIssueKey!,
                task.status,
                config,
              );
            } catch (transitionError) {
              this.logger.warn(`Failed to transition issue ${task.jiraIssueKey}: ${transitionError.message}`);
            }
          }

          task.jiraIssueUrl = this.jiraApiService.getIssueBrowseUrl(config.siteUrl!, task.jiraIssueKey!);
        } else {
          // Create new issue
          const issue = await this.jiraApiService.createIssue(config.cloudId, token, {
            projectId: config.projectId,
            issueTypeId: config.issueTypeId,
            summary: `${task.type}: ${task.description}`,
            description: this.buildJiraIssueDescription(task),
          });

          task.jiraIssueId = issue.id;
          task.jiraIssueKey = issue.key;
          task.jiraIssueUrl = this.jiraApiService.getIssueBrowseUrl(config.siteUrl!, issue.key);

          // Try to transition to correct status
          if (targetStatusId && task.status !== 'todo') {
            try {
              await this.transitionJiraIssue(
                config.cloudId,
                token,
                issue.key,
                task.status,
                config,
              );
            } catch (transitionError) {
              this.logger.warn(`Failed to transition new issue ${issue.key}: ${transitionError.message}`);
            }
          }
        }

        task.jiraSyncStatus = 'synced';
        task.jiraLastSyncedAt = new Date();
        task.jiraSyncError = undefined;
        await this.taskRepository.save(task);

        synced++;

        // Rate limiting - Jira allows ~100 requests per minute
        if (synced % 30 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (error) {
        failed++;
        errors.push(`Task ${task.id}: ${error.message}`);
        
        task.jiraSyncStatus = 'error';
        task.jiraSyncError = error.message;
        await this.taskRepository.save(task);
      }
    }

    // Update last sync time
    integration.lastSyncAt = new Date();
    await this.integrationRepository.save(integration);

    return { synced, failed, total, errors };
  }

  /**
   * Sync a single task to Jira
   */
  async syncTaskToJira(taskId: string, userId: string): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['repository', 'repository.user'],
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Find active Jira integration for this repository (repo-specific only)
    const integration = await this.integrationRepository
      .createQueryBuilder('integration')
      .addSelect('integration.accessToken')
      .addSelect('integration.refreshToken')
      .where('integration.userId = :userId', { userId })
      .andWhere('integration.provider = :provider', { provider: 'jira' })
      .andWhere('integration.status = :status', { status: 'active' })
      .andWhere('integration.repositoryId = :repoId', { repoId: task.repository.id })
      .andWhere('integration.isConfigured = :isConfigured', { isConfigured: true })
      .getOne();

    if (!integration) {
      throw new HttpException(
        'No active Jira integration found',
        HttpStatus.BAD_REQUEST,
      );
    }

    const config = integration.config as JiraConfig;

    try {
      const token = await this.ensureValidJiraToken(integration);

      if (!config.cloudId || !config.projectId || !config.issueTypeId) {
        throw new HttpException(
          'Jira project not fully configured',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (task.jiraIssueId) {
        // Update existing issue
        const updatedIssue = await this.jiraApiService.updateIssue(
          config.cloudId,
          token,
          task.jiraIssueKey!,
          {
            summary: `${task.type}: ${task.description}`,
            description: this.buildJiraIssueDescription(task),
          },
        );

        // Handle status change if needed
        const targetStatusId = this.getJiraTargetStatusId(task.status, config);
        if (targetStatusId && updatedIssue.fields.status.id !== targetStatusId) {
          await this.transitionJiraIssue(config.cloudId, token, task.jiraIssueKey!, task.status, config);
        }

        task.jiraIssueUrl = this.jiraApiService.getIssueBrowseUrl(config.siteUrl!, updatedIssue.key);
        task.jiraSyncStatus = 'synced';
        task.jiraLastSyncedAt = new Date();
        task.jiraSyncError = undefined;
      } else {
        // Create new issue
        const issue = await this.jiraApiService.createIssue(config.cloudId, token, {
          projectId: config.projectId,
          issueTypeId: config.issueTypeId,
          summary: `${task.type}: ${task.description}`,
          description: this.buildJiraIssueDescription(task),
        });

        task.jiraIssueId = issue.id;
        task.jiraIssueKey = issue.key;
        task.jiraIssueUrl = this.jiraApiService.getIssueBrowseUrl(config.siteUrl!, issue.key);
        task.jiraSyncStatus = 'synced';
        task.jiraLastSyncedAt = new Date();
        task.jiraSyncError = undefined;
      }

      return await this.taskRepository.save(task);
    } catch (error) {
      this.logger.error('Failed to sync task to Jira', error);
      
      task.jiraSyncStatus = 'error';
      task.jiraSyncError = error.message;
      await this.taskRepository.save(task);

      throw new HttpException(
        'Failed to sync task to Jira',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Handle Jira webhook events
   */
  async handleJiraWebhook(
    webhookData: JiraWebhookEvent,
    rawBody?: string,
    signatureHeader?: string,
    callbackUrl?: string,
  ): Promise<{ success: boolean; message: string }> {
    const startTime = Date.now();
    let context: Partial<WebhookContext> = {
      provider: 'jira',
      actionType: webhookData.webhookEvent,
      cardId: webhookData.issue?.id,
      timestamp: new Date(),
    };

    try {
      // 1. Security validation
      if (rawBody && callbackUrl) {
        const validation = await this.jiraWebhookSecurityService.validateWebhook(
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

      const issue = webhookData.issue;
      if (!issue?.id) {
        this.logWebhook('skipped', context, 'No issue data');
        return { success: true, message: 'No issue to process' };
      }

      // 2. Parse event type
      const eventInfo = this.jiraWebhookSecurityService.parseEventType(webhookData);
      context.actionType = eventInfo.action;

      this.logger.log(`🔍 Jira webhook: issue=${issue.key}, event=${eventInfo.action}, project=${issue.fields.project.key}`);

      // 3. Find integration by project
      const integration = await this.findIntegrationByJiraProject(issue.fields.project.key);
      
      if (!integration) {
        this.logger.warn(`❌ No integration found for Jira project: ${issue.fields.project.key}`);
        this.logWebhook('skipped', context, `No integration for project ${issue.fields.project.key}`);
        return { success: false, message: `No integration found for project ${issue.fields.project.key}` };
      }

      this.logger.log(`✅ Found integration ${integration.id} for project ${issue.fields.project.key}`);

      if (integration.status !== 'active') {
        this.logWebhook('skipped', context, `Integration status: ${integration.status}`);
        return { success: false, message: 'Integration is not active' };
      }

      context.integrationId = integration.id;
      context.userId = integration.user?.id;

      // 4. Acquire distributed lock
      const lockAcquired = await this.jiraWebhookSecurityService.acquireLock(issue.id);
      if (!lockAcquired) {
        this.logWebhook('deferred', context, 'Issue locked by another process');
        await this.jiraWebhookSecurityService.queueForRetry(
          webhookData,
          'Issue locked by concurrent operation',
          0,
        );
        return { success: true, message: 'Queued for processing (issue locked)' };
      }

      try {
        // 5. Process based on event type
        switch (eventInfo.action) {
          case 'updated':
            await this.handleJiraIssueUpdate(webhookData, integration, eventInfo, context);
            break;
          case 'deleted':
            await this.handleJiraIssueDelete(issue.id, context);
            break;
          case 'created':
            // Ignore created events - we create issues, not the other way
            this.logWebhook('skipped', context, 'Issue created event ignored');
            break;
          default:
            this.logWebhook('skipped', context, `Unhandled action: ${eventInfo.action}`);
        }

        // 6. Mark as processed
        if (context.webhookId) {
          await this.jiraWebhookSecurityService.markAsProcessed(context.webhookId, {
            id: context.webhookId,
            processedAt: new Date(),
            actionType: eventInfo.action,
            cardId: issue.id,
            result: 'success',
          });
        }

        const duration = Date.now() - startTime;
        this.logWebhook('success', context, `Processed in ${duration}ms`);
        return { success: true, message: 'Webhook processed successfully' };

      } finally {
        await this.jiraWebhookSecurityService.releaseLock(issue.id);
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logWebhook('error', context, error.message);

      await this.jiraWebhookSecurityService.queueForRetry(webhookData, error.message, 0);

      if (context.webhookId) {
        await this.jiraWebhookSecurityService.markAsProcessed(context.webhookId, {
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
   * Process Jira webhook with retry context
   */
  private async processJiraWebhookWithRetry(payload: JiraWebhookEvent, retryCount: number): Promise<void> {
    try {
      const result = await this.handleJiraWebhook(payload);
      
      if (!result.success && retryCount < 5) {
        await this.jiraWebhookSecurityService.queueForRetry(payload, result.message, retryCount);
      }
    } catch (error) {
      this.logger.error(`Jira retry processing failed: ${error.message}`);
      if (retryCount < 5) {
        await this.jiraWebhookSecurityService.queueForRetry(payload, error.message, retryCount);
      }
    }
  }

  /**
   * Handle Jira issue update
   */
  private async handleJiraIssueUpdate(
    webhookData: JiraWebhookEvent,
    integration: Integration,
    eventInfo: { action: string; hasStatusChange: boolean; statusChange?: { from: string; to: string } },
    context: Partial<WebhookContext>,
  ): Promise<void> {
    const issue = webhookData.issue;
    const config = integration.config as JiraConfig;

    this.logger.log(`🔄 handleJiraIssueUpdate: Looking for task with jiraIssueId="${issue.id}"`);

    const task = await this.taskRepository.findOne({
      where: { jiraIssueId: issue.id },
      relations: ['repository', 'repository.user'],
    });

    if (!task) {
      this.logger.warn(`❌ Task not found for Jira issue ${issue.key} (id: ${issue.id})`);
      this.logWebhook('skipped', context, `Task not found for issue ${issue.key}`);
      return;
    }

    this.logger.log(`✅ Found task ${task.id} for Jira issue ${issue.key}`);

    context.taskId = task.id;
    context.userId = task.repository.user?.id;

    let taskUpdated = false;
    let statusChange: { from: string; to: string } | null = null;

    // Handle status change
    if (eventInfo.hasStatusChange && eventInfo.statusChange) {
      this.logger.log(`📊 Status change detected: Jira status ID is now ${issue.fields.status.id} (${issue.fields.status.name})`);
      this.logger.log(`📊 Config status IDs: todo=${config.todoStatusId}, inProgress=${config.inProgressStatusId}, done=${config.doneStatusId}`);
      
      const newStatus = this.mapJiraStatusToTaskStatus(
        issue.fields.status.id,
        config,
      );

      this.logger.log(`📊 Mapped Jira status to task status: ${newStatus}`);

      if (newStatus && newStatus !== task.status) {
        statusChange = { from: task.status, to: newStatus };
        task.status = newStatus;
        taskUpdated = true;
        this.logger.log(
          `✅ Updated task ${task.id} status: ${statusChange.from} → ${statusChange.to} (from Jira)`,
        );
      } else {
        this.logger.log(`⏭️ No status change needed (current: ${task.status}, mapped: ${newStatus})`);
      }
    }

    // Handle summary change
    const changes = this.jiraWebhookSecurityService.extractChanges(webhookData);
    if (changes.summary) {
      const newSummary = changes.summary.to as string;
      // Try to parse "TYPE: description" format
      const match = newSummary.match(/^([A-Z]+):\s*(.+)$/);
      if (match) {
        const [, type, description] = match;
        task.type = type;
        task.description = description;
        taskUpdated = true;
      } else {
        task.description = newSummary;
        taskUpdated = true;
      }
    }

    if (taskUpdated) {
      task.jiraLastSyncedAt = new Date();
      await this.taskRepository.save(task);

      // Notify user
      if (statusChange && context.userId) {
        await this.notificationsService.emit(context.userId, {
          type: NotificationType.TASK_UPDATED,
          title: 'Task Updated from Jira',
          message: `Task "${task.description.substring(0, 50)}..." status changed to ${statusChange.to}`,
          data: {
            taskId: task.id,
            source: 'jira',
            statusChange,
            issueKey: issue.key,
          },
          timestamp: new Date(),
        });
      }
    }
  }

  /**
   * Handle Jira issue deletion
   */
  private async handleJiraIssueDelete(
    issueId: string,
    context: Partial<WebhookContext>,
  ): Promise<void> {
    const task = await this.taskRepository.findOne({
      where: { jiraIssueId: issueId },
      relations: ['repository', 'repository.user'],
    });

    if (!task) {
      this.logWebhook('skipped', context, `Task not found for deleted issue ${issueId}`);
      return;
    }

    context.taskId = task.id;
    context.userId = task.repository.user?.id;

    // Clear Jira association but don't delete the task
    task.jiraIssueId = undefined;
    task.jiraIssueKey = undefined;
    task.jiraIssueUrl = undefined;
    task.jiraSyncStatus = undefined;
    task.jiraLastSyncedAt = undefined;
    task.jiraSyncError = undefined;

    await this.taskRepository.save(task);
    
    this.logger.log(`Cleared Jira association for task ${task.id} (issue deleted)`);

    // Notify user
    if (context.userId) {
      await this.notificationsService.emit(context.userId, {
        type: NotificationType.TASK_UPDATED,
        title: 'Jira Issue Deleted',
        message: `Jira issue for task "${task.description.substring(0, 50)}..." was deleted`,
        data: {
          taskId: task.id,
          source: 'jira',
          action: 'issue_deleted',
        },
        timestamp: new Date(),
      });
    }
  }

  /**
   * Find integration by Jira project key
   */
  private async findIntegrationByJiraProject(projectKey: string): Promise<Integration | null> {
    if (!projectKey) {
      this.logger.warn('findIntegrationByJiraProject: No project key provided');
      return null;
    }

    this.logger.debug(`findIntegrationByJiraProject: Searching for projectKey="${projectKey}"`);

    const integration = await this.integrationRepository
      .createQueryBuilder('integration')
      .addSelect('integration.accessToken')
      .addSelect('integration.refreshToken')
      .leftJoinAndSelect('integration.user', 'user')
      .where('integration.provider = :provider', { provider: 'jira' })
      .andWhere('integration.status = :status', { status: 'active' })
      .andWhere('integration.isConfigured = :isConfigured', { isConfigured: true })
      .andWhere('integration.repositoryId IS NOT NULL')
      .andWhere("integration.config->>'projectKey' = :projectKey", { projectKey })
      .getOne();

    if (!integration) {
      // Debug: Let's see if there's any Jira integration at all
      const anyJiraIntegration = await this.integrationRepository
        .createQueryBuilder('integration')
        .where('integration.provider = :provider', { provider: 'jira' })
        .getMany();
      
      this.logger.debug(`findIntegrationByJiraProject: Total Jira integrations: ${anyJiraIntegration.length}`);
      for (const int of anyJiraIntegration) {
        const config = int.config as any;
        this.logger.debug(
          `  - ID: ${int.id}, status: ${int.status}, isConfigured: ${int.isConfigured}, ` +
          `repoId: ${int.repository?.id || 'NULL'}, projectKey: ${config?.projectKey || 'NONE'}`
        );
      }
    }

    return integration;
  }

  /**
   * Ensure Jira token is valid, refresh if needed
   */
  private async ensureValidJiraToken(integration: Integration): Promise<string> {
    const token = integration.decryptAccessToken();

    if (!token) {
      throw new HttpException('Invalid Jira token', HttpStatus.UNAUTHORIZED);
    }

    // Check if token is expired or about to expire
    const expiresAt = integration.tokenExpiresAt;
    const now = new Date();
    const buffer = 5 * 60 * 1000; // 5 minutes

    if (expiresAt && new Date(expiresAt).getTime() - now.getTime() < buffer) {
      this.logger.log('Jira token expired or expiring soon, refreshing...');

      const refreshToken = integration.decryptRefreshToken();
      if (!refreshToken) {
        throw new HttpException(
          'Jira token expired and no refresh token available',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const tokens = await this.jiraApiService.refreshAccessToken(refreshToken);

      // Update integration with new tokens
      integration.accessToken = tokens.access_token;
      if (tokens.refresh_token) {
        integration.refreshToken = tokens.refresh_token;
      }
      integration.tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);
      
      await this.integrationRepository.save(integration);

      return tokens.access_token;
    }

    return token;
  }

  /**
   * Get target Jira status ID based on task status
   */
  private getJiraTargetStatusId(status: string, config: JiraConfig): string | undefined {
    switch (status) {
      case 'open':
      case 'pending':
        return config.todoStatusId;
      case 'in-progress':
        return config.inProgressStatusId || config.todoStatusId;
      case 'done':
      case 'completed':
        return config.doneStatusId || config.todoStatusId;
      default:
        return config.todoStatusId;
    }
  }

  /**
   * Map Jira status ID to task status
   */
  private mapJiraStatusToTaskStatus(statusId: string, config: JiraConfig): string | null {
    if (statusId === config.todoStatusId) {
      return 'open';
    } else if (statusId === config.inProgressStatusId) {
      return 'in-progress';
    } else if (statusId === config.doneStatusId) {
      return 'done';
    }
    return null;
  }

  /**
   * Transition Jira issue to target status
   */
  private async transitionJiraIssue(
    cloudId: string,
    token: string,
    issueKey: string,
    targetStatus: string,
    config: JiraConfig,
  ): Promise<void> {
    // Get target transition ID based on status
    let transitionId: string | undefined;
    switch (targetStatus) {
      case 'open':
        transitionId = config.toTodoTransitionId;
        break;
      case 'in-progress':
        transitionId = config.toInProgressTransitionId;
        break;
      case 'done':
        transitionId = config.toDoneTransitionId;
        break;
    }

    if (!transitionId) {
      // Try to find the transition dynamically
      const transitions = await this.jiraApiService.getTransitions(cloudId, token, issueKey);
      const targetStatusId = this.getJiraTargetStatusId(targetStatus, config);
      
      const transition = transitions.find(t => t.to.id === targetStatusId);
      if (transition) {
        transitionId = transition.id;
      }
    }

    if (transitionId) {
      await this.jiraApiService.transitionIssue(cloudId, token, issueKey, transitionId);
    } else {
      this.logger.warn(`No transition found for status ${targetStatus} on issue ${issueKey}`);
    }
  }

  /**
   * Build Jira issue description from task (returns plain text for ADF conversion)
   */
  private buildJiraIssueDescription(task: Task): string {
    const lines = [
      `Repository: ${task.repository.name}`,
      `File: ${task.filePath}`,
      `Line: ${task.lineNumber}`,
      `Priority: ${task.priority}`,
      `Status: ${task.status}`,
      '',
      'Description:',
      task.description,
    ];

    if (task.addedBy) {
      lines.push('', `Added by: ${task.addedBy}`);
    }

    if (task.ai_summary) {
      lines.push('', 'AI Summary:', task.ai_summary);
    }

    return lines.join('\n');
  }

  /**
   * Auto-sync a newly created task to Jira (called by TasksService)
   */
  async autoSyncNewTaskToJira(taskId: string, userId: string): Promise<void> {
    try {
      const task = await this.taskRepository.findOne({
        where: { id: taskId },
        relations: ['repository', 'repository.user'],
      });

      if (!task) {
        return;
      }

      // Find active Jira integration with auto-create enabled
      const integration = await this.integrationRepository
        .createQueryBuilder('integration')
        .addSelect('integration.accessToken')
        .addSelect('integration.refreshToken')
        .where('integration.userId = :userId', { userId })
        .andWhere('integration.provider = :provider', { provider: 'jira' })
        .andWhere('integration.status = :status', { status: 'active' })
        .andWhere(
          '(integration.repositoryId = :repoId OR integration.repositoryId IS NULL)',
          { repoId: task.repository.id },
        )
        .getOne();

      const config = integration?.config as JiraConfig;
      if (!config?.autoCreateCards || !config?.syncEnabled) {
        return; // Auto-sync not enabled
      }

      // Sync the task to Jira
      await this.syncTaskToJira(taskId, userId);
    } catch (error) {
      this.logger.warn(`Auto-sync to Jira failed for task ${taskId}: ${error.message}`);
    }
  }
}
