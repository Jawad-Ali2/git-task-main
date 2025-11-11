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
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IntegrationsService } from './services/integrations.service';
import { TrelloApiService } from './services/trello-api.service';
import { CreateIntegrationDto, UpdateIntegrationDto, SyncTasksDto, TrelloConfigDto } from './dto/integration.dto';
import { Public } from './decorators/public.decorator';

@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly trelloApiService: TrelloApiService,
  ) {}

  /**
   * Get all integrations for the authenticated user
   */
  @Get()
  @UseGuards(AuthGuard('jwt'))
  async findAll(@Req() req, @Query('provider') provider?: string) {
    return this.integrationsService.findAll(req.user.id, provider);
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
   * Frontend receives token from Trello redirect and sends it here
   */
  @Post('trello/callback')
  @UseGuards(AuthGuard('jwt'))
  async handleOAuthCallback(@Req() req, @Body() body: { token: string; repositoryId?: string }) {
    console.log('🔍 Trello callback received:', {
      hasUser: !!req.user,
      userId: req.user?.id,
      hasToken: !!body.token,
      repositoryId: body.repositoryId,
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

    // Verify the token is valid by fetching member info
    await this.trelloApiService.getMemberInfo(apiKey, body.token);

    // Create the integration
    const createDto: CreateIntegrationDto = {
      provider: 'trello',
      accessToken: body.token,
      repositoryId: body.repositoryId, // ✅ Optional: link to specific repository
      config: {
        syncEnabled: false, // User needs to configure board/lists first
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
  async handleTrelloWebhook(@Body() payload: any) {
    console.log('🔔 Trello webhook received:', JSON.stringify(payload, null, 2));
    
    // Trello webhook verification (HEAD request)
    if (!payload.action) {
      console.log('✅ Webhook verification request (no action)');
      return { status: 'ok' };
    }

    // Use the enhanced webhook handler
    try {
      await this.integrationsService.handleTrelloWebhook(payload);
      console.log('✅ Webhook processed successfully');
    } catch (error) {
      console.error('❌ Webhook processing failed:', error.message);
    }

    return { status: 'ok' };
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
    
    return {
      integrationId: integration.id,
      boardId: integration.config?.boardId,
      boardName: integration.config?.boardName,
      webhookId: integration.config?.webhookId,
      webhookExists: !!integration.config?.webhookId,
      callbackUrl: `${process.env.BACKEND_URL || 'http://localhost:3000'}/integrations/webhook/trello`,
      lists: {
        todo: {
          id: integration.config?.todoListId,
          name: integration.config?.todoListName,
        },
        inProgress: {
          id: integration.config?.inProgressListId,
          name: integration.config?.inProgressListName,
        },
        done: {
          id: integration.config?.doneListId,
          name: integration.config?.doneListName,
        },
      },
      autoMoveCards: integration.config?.autoMoveCards,
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
