import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  HttpException,
  Headers,
  RawBodyRequest,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { JiraApiService } from '../services/jira/jira-api.service';
import { JiraWebhookSecurityService } from '../services/jira/jira-webhook-security.service';
import { IntegrationsService } from '../services/integrations.service';
import { Public } from '../decorators/public.decorator';
import { JiraConfigDto } from '../dto/jira.dto';
import { SyncTasksDto } from '../dto/integration.dto';
import { JiraConfig } from '../interfaces/provider-config.interface';

/**
 * Jira Integration Controller
 * 
 * Handles all Jira-specific endpoints:
 * - OAuth 2.0 (3LO) flow
 * - Project and status retrieval
 * - Configuration
 * - Webhooks
 */
@Controller('integrations/jira')
export class JiraController {
  constructor(
    private readonly jiraApiService: JiraApiService,
    private readonly jiraWebhookSecurityService: JiraWebhookSecurityService,
    private readonly integrationsService: IntegrationsService,
  ) {}

  /**
   * Get Jira OAuth authorization URL
   * Frontend redirects user to this URL
   */
  @Get('authorize')
  @UseGuards(AuthGuard('jwt'))
  async getAuthorizationUrl(@Req() req) {
    const authUrl = this.jiraApiService.getAuthorizationUrl(req.user.id);
    return { authUrl };
  }

  /**
   * OAuth callback - exchange code for tokens
   * Creates a user-level OAuth connection (no repository linked)
   */
  @Post('callback')
  @UseGuards(AuthGuard('jwt'))
  async handleCallback(
    @Req() req,
    @Body() body: { code: string },
  ) {
    console.log('🔍 Jira callback received:', {
      hasUser: !!req.user,
      userId: req.user?.id,
      hasCode: !!body.code,
    });

    if (!req.user || !req.user.id) {
      throw new HttpException('User not authenticated', HttpStatus.UNAUTHORIZED);
    }

    // Check if user already has a Jira connection
    const existingConnections = await this.integrationsService.getUserConnections(req.user.id);
    const existingJira = existingConnections.find(c => c.provider === 'jira');
    if (existingJira) {
      throw new HttpException('Jira is already connected', HttpStatus.BAD_REQUEST);
    }

    // Exchange code for tokens
    const tokens = await this.jiraApiService.exchangeCodeForToken(body.code);

    // Get accessible Jira sites
    const sites = await this.jiraApiService.getAccessibleResources(tokens.access_token);

    if (!sites || sites.length === 0) {
      throw new HttpException(
        'No accessible Jira sites found. Please ensure you have access to at least one Jira site.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Use the first site (most users have only one)
    const site = sites[0];

    // Verify the token works by getting user info
    await this.jiraApiService.getCurrentUser(site.id, tokens.access_token);

    // Calculate token expiration
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Create user-level OAuth connection (no repository)
    const integration = await this.integrationsService.create(req.user.id, {
      provider: 'jira',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: expiresAt, // Set expiration time during creation
      // repositoryId is NOT set - this is a user-level connection
      config: {
        cloudId: site.id,
        siteUrl: site.url,
        syncEnabled: false, // User needs to configure project first
        autoCreateIssues: false,
        autoTransitionIssues: false,
      } as JiraConfig,
    });

    return {
      ...integration,
      sites, // Return available sites in case user has multiple
    };
  }

  /**
   * Get accessible Jira Cloud sites
   */
  @Get('sites')
  @UseGuards(AuthGuard('jwt'))
  async getSites(@Req() req) {
    const integration = await this.getJiraIntegration(req.user.id);
    const token = integration.decryptAccessToken();

    if (!token) {
      throw new HttpException('Invalid Jira token', HttpStatus.UNAUTHORIZED);
    }

    return this.jiraApiService.getAccessibleResources(token);
  }

  /**
   * Get projects from connected Jira site
   */
  @Get('projects')
  @UseGuards(AuthGuard('jwt'))
  async getProjects(@Req() req) {
    const integration = await this.getJiraIntegration(req.user.id);
    const config = integration.config as JiraConfig;
    const token = await this.ensureValidToken(integration);

    if (!config?.cloudId) {
      throw new HttpException('Jira site not configured', HttpStatus.BAD_REQUEST);
    }

    return this.jiraApiService.getProjects(config.cloudId, token);
  }

  /**
   * Get issue types for a project
   */
  @Get('projects/:projectId/issue-types')
  @UseGuards(AuthGuard('jwt'))
  async getIssueTypes(
    @Req() req,
    @Param('projectId') projectId: string,
  ) {
    const integration = await this.getJiraIntegration(req.user.id);
    const config = integration.config as JiraConfig;
    const token = await this.ensureValidToken(integration);

    if (!config?.cloudId) {
      throw new HttpException('Jira site not configured', HttpStatus.BAD_REQUEST);
    }

    return this.jiraApiService.getIssueTypes(config.cloudId, token, projectId);
  }

  /**
   * Get statuses and issue types for a project
   * Returns both in a single call for the config modal
   */
  @Get('projects/:projectId/statuses')
  @UseGuards(AuthGuard('jwt'))
  async getStatuses(
    @Req() req,
    @Param('projectId') projectId: string,
  ) {
    const integration = await this.getJiraIntegration(req.user.id);
    const config = integration.config as JiraConfig;
    const token = await this.ensureValidToken(integration);

    if (!config?.cloudId) {
      throw new HttpException('Jira site not configured', HttpStatus.BAD_REQUEST);
    }

    // Fetch both statuses and issue types in parallel
    const [statuses, issueTypes] = await Promise.all([
      this.jiraApiService.getStatuses(config.cloudId, token, projectId),
      this.jiraApiService.getIssueTypes(config.cloudId, token, projectId),
    ]);

    return {
      statuses,
      issueTypes,
    };
  }

  /**
   * Configure Jira integration (project, statuses, etc.)
   */
  @Post(':id/configure')
  @UseGuards(AuthGuard('jwt'))
  async configure(
    @Req() req,
    @Param('id') id: string,
    @Body() config: JiraConfigDto,
  ) {
    let result = await this.integrationsService.update(id, req.user.id, { config });

    let webhookError: string | null = null;

    // Try to create webhook if configured and no webhook exists
    if (config.projectKey && !result.config?.webhookId) {
      try {
        await this.createWebhook(id, req.user.id);
        // Fetch updated integration to get webhookId
        result = await this.integrationsService.findOne(id, req.user.id);
        console.log('✅ Jira webhook created automatically during configuration');
      } catch (error) {
        webhookError = error.message;
        console.error('❌ Failed to create Jira webhook during configuration:', error.message);
        console.error('   Make sure BACKEND_URL is publicly accessible (not localhost)');
        // Don't fail configuration if webhook creation fails
      }
    }

    return {
      ...result,
      webhookCreated: !webhookError && !!result.config?.webhookId,
      webhookError,
    };
  }

  /**
   * Manually create/recreate webhook for Jira integration
   */
  @Post(':id/webhook/create')
  @UseGuards(AuthGuard('jwt'))
  async createWebhookManually(
    @Req() req,
    @Param('id') id: string,
  ) {
    try {
      await this.createWebhook(id, req.user.id);
      return { success: true, message: 'Webhook created successfully' };
    } catch (error) {
      return { 
        success: false, 
        message: error.message,
        details: 'Make sure BACKEND_URL is set to a publicly accessible URL (not localhost)',
      };
    }
  }

  /**
   * Sync all tasks in a repository to Jira
   */
  @Post('sync/repository')
  @UseGuards(AuthGuard('jwt'))
  async syncRepository(@Req() req, @Body() syncDto: SyncTasksDto) {
    return this.integrationsService.syncJiraRepositoryTasks(req.user.id, syncDto);
  }

  /**
   * Create webhook for Jira project
   */
  private async createWebhook(integrationId: string, userId: string): Promise<void> {
    const integration = await this.integrationsService.findOne(integrationId, userId);
    const config = integration.config as JiraConfig;

    if (!config?.cloudId || !config?.projectKey) {
      return;
    }

    const token = await this.ensureValidToken(integration);
    const callbackUrl = `${process.env.BACKEND_URL || 'http://localhost:3001'}/integrations/jira/webhook`;

    try {
      const webhook = await this.jiraApiService.createWebhook(
        config.cloudId,
        token,
        config.projectKey,
        callbackUrl,
      );

      // Save webhook ID to config
      const updatedConfig: JiraConfig = {
        ...config,
        webhookId: webhook.id?.toString(),
      };
      await this.integrationsService.update(integrationId, userId, {
        config: updatedConfig,
      });

      console.log(`✅ Created Jira webhook for project ${config.projectKey}`);
    } catch (error) {
      console.error('Failed to create Jira webhook:', error.message);
      throw error;
    }
  }

  /**
   * Webhook endpoint for Jira events
   * This is called by Jira when issues are created/updated/deleted
   */
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() payload: any,
    @Headers('x-hub-signature') signatureHeader?: string,
  ) {
    const startTime = Date.now();
    const callbackUrl = `${process.env.BACKEND_URL || 'http://localhost:3001'}/integrations/jira/webhook`;
    
    // Get raw body for signature verification
    const rawBody = req.rawBody?.toString() || JSON.stringify(payload);

    // Handle Jira webhook test/verification
    if (!payload || !payload.webhookEvent) {
      console.log('✅ Jira webhook verification request');
      return { status: 'ok', message: 'Verification successful' };
    }

    console.log(`📥 Jira webhook received: ${payload.webhookEvent} for issue ${payload.issue?.key}`);

    // Process webhook with full security validation
    const result = await this.integrationsService.handleJiraWebhook(
      payload,
      rawBody,
      signatureHeader,
      callbackUrl,
    );

    const duration = Date.now() - startTime;
    console.log(`📤 Jira webhook response (${duration}ms): ${result.success ? '✅' : '❌'} ${result.message}`);

    return {
      status: result.success ? 'ok' : 'error',
      message: result.message,
      duration,
    };
  }

  /**
   * Get webhook status for debugging
   */
  @Get('webhook/status')
  @UseGuards(AuthGuard('jwt'))
  async getWebhookStatus(@Req() req) {
    const integrations = await this.integrationsService.findAll(req.user.id, 'jira');

    if (!integrations.length) {
      return { error: 'No Jira integration found' };
    }

    const integration = integrations[0];
    const config = integration.config as JiraConfig;

    return {
      integrationId: integration.id,
      cloudId: config?.cloudId,
      siteUrl: config?.siteUrl,
      projectKey: config?.projectKey,
      projectName: config?.projectName,
      webhookId: config?.webhookId,
      webhookExists: !!config?.webhookId,
      callbackUrl: `${process.env.BACKEND_URL || 'http://localhost:3001'}/integrations/jira/webhook`,
      statuses: {
        todo: {
          id: config?.todoStatusId,
          name: config?.todoStatusName,
        },
        inProgress: {
          id: config?.inProgressStatusId,
          name: config?.inProgressStatusName,
        },
        done: {
          id: config?.doneStatusId,
          name: config?.doneStatusName,
        },
      },
      autoMoveCards: config?.autoMoveCards,
    };
  }

  /**
   * Manually refresh Jira token
   */
  @Post('refresh-token')
  @UseGuards(AuthGuard('jwt'))
  async refreshToken(@Req() req) {
    const integration = await this.getJiraIntegration(req.user.id);
    const refreshToken = integration.decryptRefreshToken();

    if (!refreshToken) {
      throw new HttpException(
        'No refresh token available. Please reconnect Jira.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const tokens = await this.jiraApiService.refreshAccessToken(refreshToken);

    // Update integration with new tokens
    integration.accessToken = tokens.access_token;
    if (tokens.refresh_token) {
      integration.refreshToken = tokens.refresh_token;
    }
    integration.tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await this.integrationsService.update(integration.id, req.user.id, {});

    return { message: 'Token refreshed successfully' };
  }

  /**
   * Get retry queue status
   */
  @Get('webhook/retry-status')
  @UseGuards(AuthGuard('jwt'))
  async getRetryQueueStatus() {
    return this.jiraWebhookSecurityService.getRetryQueueStatus();
  }

  // ==================== Helper Methods ====================

  /**
   * Get user's Jira integration
   */
  private async getJiraIntegration(userId: string) {
    const integrations = await this.integrationsService.findAll(userId, 'jira');

    if (!integrations.length) {
      throw new HttpException(
        'Jira not connected. Please connect Jira first.',
        HttpStatus.NOT_FOUND,
      );
    }

    return integrations[0];
  }

  /**
   * Ensure token is valid, refresh if needed
   * @param forceRefresh - If true, refresh even if token doesn't appear expired
   */
  private async ensureValidToken(integration: any, forceRefresh = false): Promise<string> {
    const token = integration.decryptAccessToken();

    if (!token) {
      throw new HttpException('Invalid Jira token', HttpStatus.UNAUTHORIZED);
    }

    // Check if token is expired or about to expire (5 min buffer)
    const expiresAt = integration.tokenExpiresAt;
    const now = new Date();
    const buffer = 5 * 60 * 1000; // 5 minutes

    // Refresh if:
    // 1. Force refresh requested, OR
    // 2. Token expiration is set and token is expired/expiring, OR
    // 3. Token expiration is NOT set (legacy token, try refresh to be safe)
    const shouldRefresh = forceRefresh || 
      (expiresAt && new Date(expiresAt).getTime() - now.getTime() < buffer) ||
      !expiresAt;

    if (shouldRefresh) {
      console.log('🔄 Jira token needs refresh (forceRefresh:', forceRefresh, ', expiresAt:', expiresAt, ')');

      const refreshToken = integration.decryptRefreshToken();
      if (!refreshToken) {
        throw new HttpException(
          'Jira token expired and no refresh token available. Please reconnect Jira.',
          HttpStatus.UNAUTHORIZED,
        );
      }

      try {
        const tokens = await this.jiraApiService.refreshAccessToken(refreshToken);

        // Update integration with new encrypted tokens and save to database
        await this.integrationsService.updateTokens(integration.id, {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || refreshToken,
          tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        });

        console.log('✅ Jira token refreshed successfully');
        return tokens.access_token;
      } catch (error) {
        console.error('❌ Failed to refresh Jira token:', error.message);
        // If we had a valid expiration and it wasn't expired, return the original token
        if (expiresAt && new Date(expiresAt).getTime() > now.getTime()) {
          console.log('⚠️ Refresh failed but token may still be valid, trying original token');
          return token;
        }
        throw new HttpException(
          'Failed to refresh Jira token. Please reconnect Jira.',
          HttpStatus.UNAUTHORIZED,
        );
      }
    }

    return token;
  }
}
