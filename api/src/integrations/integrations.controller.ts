import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Head,
  HttpException,
  Headers,
  RawBodyRequest,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IntegrationsService } from './services/integrations.service';
import { TrelloApiService } from './services/trello-api.service';
import { TrelloWebhookSecurityService } from './services/trello-webhook-security.service';
import { CreateIntegrationDto, UpdateIntegrationDto, SyncTasksDto, TrelloConfigDto } from './dto/integration.dto';
import { Public } from './decorators/public.decorator';
import { Request } from 'express';
import { TrelloConfig } from './interfaces/provider-config.interface';

@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly trelloApiService: TrelloApiService,
    private readonly webhookSecurityService: TrelloWebhookSecurityService,
  ) {}

  /**
   * Get all integrations for the authenticated user
   */
  @Get()
  @UseGuards(AuthGuard('jwt'))
  async findAll(@Req() req, @Query('provider') provider?: string, @Query('repositoryId') repositoryId?: string) {
    if (repositoryId) {
      return this.integrationsService.getRepositoryIntegrations(req.user.id, repositoryId);
    }
    return this.integrationsService.findAll(req.user.id, provider);
  }

  /**
   * Get user-level OAuth connections (not linked to any repository)
   */
  @Get('connections')
  @UseGuards(AuthGuard('jwt'))
  async getUserConnections(@Req() req) {
    return this.integrationsService.getUserConnections(req.user.id);
  }

  /**
   * Link a repository to an existing OAuth connection
   */
  @Post('link/:provider/:repositoryId')
  @UseGuards(AuthGuard('jwt'))
  async linkRepository(
    @Req() req,
    @Param('provider') provider: 'trello' | 'jira',
    @Param('repositoryId') repositoryId: string,
  ) {
    return this.integrationsService.linkRepositoryToProvider(
      req.user.id,
      repositoryId,
      provider,
    );
  }

  /**
   * Get a specific integration
   */
  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  async findOne(@Req() req, @Param('id') id: string) {
    return this.integrationsService.findOne(id, req.user.id);
  }

  /**
   * Initiate Trello OAuth flow - returns authorization URL
   * Frontend redirects user to this URL
   */
  @Get('trello/authorize')
  @UseGuards(AuthGuard('jwt'))
  async initiateOAuth(@Req() req) {
    const apiKey = process.env.TRELLO_API_KEY;
    const appName = process.env.TRELLO_APP_NAME || 'GitTask';
    const callbackUrl = `${process.env.FRONTEND_URL}/integrations/trello/callback`;
    
    // Trello OAuth authorization URL
    const authUrl = `https://trello.com/1/authorize?` +
      `expiration=never&` +
      `name=${encodeURIComponent(appName)}&` +
      `scope=read,write&` +
      `response_type=token&` +
      `key=${apiKey}&` +
      `return_url=${encodeURIComponent(callbackUrl)}`;

    return { authUrl };
  }

  /**
   * Complete Trello OAuth - save the token returned from frontend
   * Creates a user-level OAuth connection (no repository linked)
   */
  @Post('trello/callback')
  @UseGuards(AuthGuard('jwt'))
  async handleOAuthCallback(@Req() req, @Body() body: { token: string }) {
    console.log('🔍 Trello callback received:', {
      hasUser: !!req.user,
      userId: req.user?.id,
      hasToken: !!body.token,
    });

    const apiKey = process.env.TRELLO_API_KEY;
    if (!apiKey) {
      throw new Error('TRELLO_API_KEY not configured');
    }

    // Debug: Check if user is authenticated
    if (!req.user || !req.user.id) {
      console.error('❌ User not authenticated in Trello callback');
      throw new HttpException('User not authenticated', HttpStatus.UNAUTHORIZED);
    }

    // Check if user already has a Trello connection
    const existingConnection = await this.integrationsService.hasUserConnection(req.user.id, 'trello');
    if (existingConnection) {
      throw new HttpException('Trello is already connected', HttpStatus.BAD_REQUEST);
    }

    // Verify the token is valid by fetching member info
    await this.trelloApiService.getMemberInfo(apiKey, body.token);

    // Create user-level OAuth connection (no repository)
    const createDto: CreateIntegrationDto = {
      provider: 'trello',
      accessToken: body.token,
      // repositoryId is NOT set - this is a user-level connection
      config: {
        syncEnabled: false,
        autoCreateCards: false,
        autoMoveCards: false,
      },
    };

    return this.integrationsService.create(req.user.id, createDto);
  }

  /**
   * Update integration configuration
   */
  @Put(':id')
  @UseGuards(AuthGuard('jwt'))
  async update(
    @Req() req,
    @Param('id') id: string,
    @Body() updateDto: UpdateIntegrationDto,
  ) {
    return this.integrationsService.update(id, req.user.id, updateDto);
  }

  /**
   * Delete an integration
   */
  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() req, @Param('id') id: string) {
    await this.integrationsService.remove(id, req.user.id);
  }

  /**
   * Get Trello boards for connected account
   */
  @Get('trello/boards')
  @UseGuards(AuthGuard('jwt'))
  async getTrelloBoards(@Req() req) {
    const apiKey = process.env.TRELLO_API_KEY;
    if (!apiKey) {
      throw new Error('TRELLO_API_KEY not configured');
    }

    // Get the user's Trello integration
    const integrations = await this.integrationsService.findAll(req.user.id, 'trello');
    
    if (!integrations.length) {
      throw new Error('No Trello integration found');
    }

    const integration = integrations[0];
    
    const token = integration.decryptAccessToken();
    console.log('🔍 Decrypted token:', {
      hasToken: !!token,
      tokenLength: token?.length,
      hasEncryptionKey: !!process.env.ENCRYPTION_KEY,
    });
    
    if (!token) {
      throw new Error('Invalid Trello token');
    }

    return this.trelloApiService.getBoards(apiKey, token);
  }

  /**
   * Create a new Trello board with default lists for GitTask
   */
  @Post('trello/boards/create')
  @UseGuards(AuthGuard('jwt'))
  async createTrelloBoard(
    @Req() req,
    @Body()
    body: {
      name: string;
      description?: string;
      repositoryId?: string;
    },
  ) {
    try {
      const apiKey = process.env.TRELLO_API_KEY;
      if (!apiKey) {
        throw new HttpException('TRELLO_API_KEY not configured', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      const { name, description, repositoryId } = body;

      // Get user's Trello integration (repository-specific if provided)
      const integrations = await this.integrationsService.findAll(req.user.id, 'trello');
      
      if (!integrations.length) {
        throw new HttpException(
          'Trello not connected. Please connect Trello first.',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Find the integration for this repository (or use first one if no repository specified)
      const integration = repositoryId
        ? integrations.find((i) => i.repository?.id === repositoryId) || integrations[0]
        : integrations[0];

      const token = integration.decryptAccessToken();
      if (!token) {
        throw new HttpException('Invalid Trello token', HttpStatus.UNAUTHORIZED);
      }

      // Create the board
      const board = await this.trelloApiService.createBoard(
        apiKey,
        token,
        name,
        description,
      );

      // Create default lists: "To Do", "In Progress", "Done"
      const [todoList, inProgressList, doneList] = await Promise.all([
        this.trelloApiService.createList(apiKey, token, board.id, 'To Do', 'top'),
        this.trelloApiService.createList(apiKey, token, board.id, 'In Progress', 'bottom'),
        this.trelloApiService.createList(apiKey, token, board.id, 'Done', 'bottom'),
      ]);

      console.log('✅ Created Trello board with default lists:', {
        boardId: board.id,
        boardName: board.name,
        lists: [todoList.name, inProgressList.name, doneList.name],
      });

      return {
        board,
        lists: {
          todo: todoList,
          inProgress: inProgressList,
          done: doneList,
        },
        message: 'Board created successfully with default lists',
      };
    } catch (error) {
      console.error('[Create Board] Error:', error);
      throw new HttpException(
        error.message || 'Failed to create board',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get lists for a specific Trello board
   */
  @Get('trello/boards/:boardId/lists')
  @UseGuards(AuthGuard('jwt'))
  async getTrelloLists(@Req() req, @Param('boardId') boardId: string) {
    const apiKey = process.env.TRELLO_API_KEY;
    if (!apiKey) {
      throw new Error('TRELLO_API_KEY not configured');
    }

    const integrations = await this.integrationsService.findAll(req.user.id, 'trello');
    if (!integrations.length) {
      throw new Error('No Trello integration found');
    }

    const integration = integrations[0];
    const token = integration.decryptAccessToken();
    if (!token) {
      throw new Error('Invalid Trello token');
    }

    return this.trelloApiService.getLists(apiKey, token, boardId);
  }

  /**
   * Configure Trello board and lists for syncing
   */
  @Post(':id/configure')
  @UseGuards(AuthGuard('jwt'))
  async configureTrello(
    @Req() req,
    @Param('id') id: string,
    @Body() config: TrelloConfigDto,
  ) {
    const result = await this.integrationsService.update(id, req.user.id, { config });

    // Auto-create webhook if not already created
    if (config.boardId && !result.config?.webhookId) {
      try {
        await this.integrationsService.createWebhook(id, req.user.id);
      } catch (error) {
        // Don't fail configuration if webhook creation fails
        console.error('Failed to create webhook:', error.message);
      }
    }

    return result;
  }

  /**
   * Sync a single task to Trello
   */
  @Post('sync/task/:taskId')
  @UseGuards(AuthGuard('jwt'))
  async syncTask(@Req() req, @Param('taskId') taskId: string) {
    return this.integrationsService.syncTaskToTrello(taskId, req.user.id);
  }

  /**
   * Sync all tasks in a repository to Trello
   */
  @Post('sync/repository')
  @UseGuards(AuthGuard('jwt'))
  async syncRepository(@Req() req, @Body() syncDto: SyncTasksDto) {
    return this.integrationsService.syncRepositoryTasks(req.user.id, syncDto);
  }

  /**
   * Webhook endpoint for Trello events
   * This will be called by Trello when cards are moved/updated
   * Note: This endpoint is NOT protected by JWT auth
   */
  @Public()
  @Post('webhook/trello')
  @HttpCode(HttpStatus.OK)
  async handleTrelloWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() payload: any,
    @Headers('x-trello-webhook') signatureHeader?: string,
  ) {
    const startTime = Date.now();
    const callbackUrl = `${process.env.BACKEND_URL || 'http://localhost:3001'}/integrations/webhook/trello`;
    
    // Get raw body for signature verification
    const rawBody = req.rawBody?.toString() || JSON.stringify(payload);
    
    // Trello webhook verification (HEAD request returns empty payload)
    if (!payload || !payload.action) {
      console.log('✅ Webhook verification request (no action)');
      return { status: 'ok', message: 'Verification successful' };
    }

    // Log incoming webhook (structured)
    console.log(`📥 Webhook received: ${payload.action?.type} for card ${payload.action?.data?.card?.id}`);

    // Process with full security validation
    const result = await this.integrationsService.handleTrelloWebhook(
      payload,
      rawBody,
      signatureHeader,
      callbackUrl,
    );

    const duration = Date.now() - startTime;
    console.log(`📤 Webhook response (${duration}ms): ${result.success ? '✅' : '❌'} ${result.message}`);

    return { 
      status: result.success ? 'ok' : 'error',
      message: result.message,
      duration,
    };
  }

  /**
   * Verify webhook (Trello sends HEAD request)
   * Note: This endpoint is NOT protected by JWT auth
   */
  @Public()
  @Head('webhook/trello')
  @HttpCode(HttpStatus.OK)
  verifyTrelloWebhookHead() {
    return;
  }

  @Public()
  @Get('webhook/trello')
  @HttpCode(HttpStatus.OK)
  verifyTrelloWebhook() {
    return { status: 'ok' };
  }

  /**
   * Get webhook retry queue status
   */
  @Get('webhook/retry-status')
  @UseGuards(AuthGuard('jwt'))
  async getRetryQueueStatus() {
    return this.webhookSecurityService.getRetryQueueStatus();
  }

  /**
   * Debug endpoint: Check webhook status
   */
  @Get('trello/webhook/status')
  @UseGuards(AuthGuard('jwt'))
  async getWebhookStatus(@Req() req) {
    const integrations = await this.integrationsService.findAll(req.user.id, 'trello');
    
    if (!integrations.length) {
      return { error: 'No Trello integration found' };
    }

    const integration = integrations[0];
    const config = integration.config as TrelloConfig;
    
    return {
      integrationId: integration.id,
      boardId: config?.boardId,
      boardName: config?.boardName,
      webhookId: config?.webhookId,
      webhookExists: !!config?.webhookId,
      callbackUrl: `${process.env.BACKEND_URL || 'http://localhost:3000'}/integrations/webhook/trello`,
      lists: {
        todo: {
          id: config?.todoListId,
          name: config?.todoListName,
        },
        inProgress: {
          id: config?.inProgressListId,
          name: config?.inProgressListName,
        },
        done: {
          id: config?.doneListId,
          name: config?.doneListName,
        },
      },
      autoMoveCards: config?.autoMoveCards,
    };
  }

  /**
   * Debug endpoint: Manually create/recreate webhook
   */
  @Post('trello/webhook/create')
  @UseGuards(AuthGuard('jwt'))
  async createWebhookManually(@Req() req) {
    const integrations = await this.integrationsService.findAll(req.user.id, 'trello');
    
    if (!integrations.length) {
      throw new HttpException('No Trello integration found', HttpStatus.NOT_FOUND);
    }

    const integration = integrations[0];
    
    try {
      await this.integrationsService.createWebhook(integration.id, req.user.id);
      return { 
        success: true, 
        message: 'Webhook created successfully',
        webhookId: integration.config?.webhookId,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
