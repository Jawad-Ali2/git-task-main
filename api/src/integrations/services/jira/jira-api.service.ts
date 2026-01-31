import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import {
  JiraCloudSite,
  JiraProject,
  JiraIssueType,
  JiraStatus,
  JiraTransition,
  JiraIssue,
  JiraOAuthTokenResponse,
  JiraUser,
  CreateJiraIssueParams,
  UpdateJiraIssueParams,
} from '../../dto/jira.dto';

/**
 * Jira API Service
 * 
 * Handles all communication with the Jira Cloud REST API.
 * Uses OAuth 2.0 (3LO) for authentication.
 * 
 * API Documentation: https://developer.atlassian.com/cloud/jira/platform/rest/v3/
 */
@Injectable()
export class JiraApiService {
  private readonly logger = new Logger(JiraApiService.name);
  
  // Atlassian OAuth endpoints
  private readonly AUTH_URL = 'https://auth.atlassian.com/authorize';
  private readonly TOKEN_URL = 'https://auth.atlassian.com/oauth/token';
  private readonly RESOURCES_URL = 'https://api.atlassian.com/oauth/token/accessible-resources';
  
  // Jira API base URL (requires cloudId)
  private readonly API_BASE = 'https://api.atlassian.com/ex/jira';

  /**
   * Get OAuth 2.0 authorization URL
   */
  getAuthorizationUrl(state?: string): string {
    const clientId = process.env.JIRA_CLIENT_ID;
    const callbackUrl = process.env.JIRA_CALLBACK_URL || 
      `${process.env.BACKEND_URL}/integrations/jira/callback`;
    
    if (!clientId) {
      throw new HttpException('JIRA_CLIENT_ID not configured', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    // Scopes needed for full integration
    const scopes = [
      'read:jira-user',
      'read:jira-work',
      'write:jira-work',
      'manage:jira-webhook',
      'offline_access', // For refresh tokens
    ].join(' ');

    const params = new URLSearchParams({
      audience: 'api.atlassian.com',
      client_id: clientId,
      scope: scopes,
      redirect_uri: callbackUrl,
      response_type: 'code',
      prompt: 'consent',
    });

    if (state) {
      params.append('state', state);
    }

    return `${this.AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<JiraOAuthTokenResponse> {
    const clientId = process.env.JIRA_CLIENT_ID;
    const clientSecret = process.env.JIRA_CLIENT_SECRET;
    const callbackUrl = process.env.JIRA_CALLBACK_URL || 
      `${process.env.BACKEND_URL}/integrations/jira/callback`;

    if (!clientId || !clientSecret) {
      throw new HttpException(
        'JIRA_CLIENT_ID or JIRA_CLIENT_SECRET not configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    try {
      const response = await axios.post(this.TOKEN_URL, {
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: callbackUrl,
      });

      this.logger.log('Successfully exchanged code for Jira token');
      return response.data;
    } catch (error) {
      this.logger.error('Failed to exchange code for token', error.response?.data || error.message);
      throw new HttpException(
        error.response?.data?.error_description || 'Failed to complete Jira authorization',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<JiraOAuthTokenResponse> {
    const clientId = process.env.JIRA_CLIENT_ID;
    const clientSecret = process.env.JIRA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new HttpException(
        'JIRA_CLIENT_ID or JIRA_CLIENT_SECRET not configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    try {
      const response = await axios.post(this.TOKEN_URL, {
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      });

      this.logger.log('Successfully refreshed Jira token');
      return response.data;
    } catch (error) {
      this.logger.error('Failed to refresh token', error.response?.data || error.message);
      // Use BAD_REQUEST (400) instead of UNAUTHORIZED (401) to avoid triggering
      // the frontend's session refresh logic which redirects to login
      throw new HttpException(
        'Jira token expired - please reconnect your Jira account from Dashboard Settings',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Get accessible Jira Cloud sites for the user
   */
  async getAccessibleResources(accessToken: string): Promise<JiraCloudSite[]> {
    try {
      const response = await axios.get(this.RESOURCES_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return response.data;
    } catch (error) {
      this.logger.error('Failed to get accessible resources', error.response?.data || error.message);
      throw new HttpException(
        'Failed to get Jira sites',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Create authenticated API client for a specific Jira Cloud site
   */
  private createClient(cloudId: string, accessToken: string): AxiosInstance {
    return axios.create({
      baseURL: `${this.API_BASE}/${cloudId}/rest/api/3`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  /**
   * Get current user information
   */
  async getCurrentUser(cloudId: string, accessToken: string): Promise<JiraUser> {
    try {
      const client = this.createClient(cloudId, accessToken);
      const response = await client.get('/myself');
      return response.data;
    } catch (error) {
      this.logger.error('Failed to get current user', error.response?.data || error.message);
      throw new HttpException(
        'Failed to verify Jira credentials',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  /**
   * Get all accessible projects
   */
  async getProjects(cloudId: string, accessToken: string): Promise<JiraProject[]> {
    try {
      const client = this.createClient(cloudId, accessToken);
      const response = await client.get('/project/search', {
        params: {
          maxResults: 100,
          expand: 'description,lead,issueTypes',
        },
      });
      return response.data.values || response.data;
    } catch (error) {
      this.logger.error('Failed to get projects', error.response?.data || error.message);
      throw new HttpException(
        'Failed to fetch Jira projects',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Get issue types for a project
   */
  async getIssueTypes(
    cloudId: string,
    accessToken: string,
    projectId: string,
  ): Promise<JiraIssueType[]> {
    try {
      const client = this.createClient(cloudId, accessToken);
      const response = await client.get(`/project/${projectId}`);
      return response.data.issueTypes || [];
    } catch (error) {
      this.logger.error('Failed to get issue types', error.response?.data || error.message);
      throw new HttpException(
        'Failed to fetch Jira issue types',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Get all statuses for a project
   */
  async getStatuses(
    cloudId: string,
    accessToken: string,
    projectId: string,
  ): Promise<JiraStatus[]> {
    try {
      const client = this.createClient(cloudId, accessToken);
      const response = await client.get(`/project/${projectId}/statuses`);
      
      // Flatten statuses from all issue types
      const allStatuses: JiraStatus[] = [];
      const seenIds = new Set<string>();
      
      for (const issueType of response.data) {
        for (const status of issueType.statuses || []) {
          if (!seenIds.has(status.id)) {
            seenIds.add(status.id);
            allStatuses.push(status);
          }
        }
      }
      
      return allStatuses;
    } catch (error) {
      this.logger.error('Failed to get statuses', error.response?.data || error.message);
      throw new HttpException(
        'Failed to fetch Jira statuses',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Get available transitions for an issue
   */
  async getTransitions(
    cloudId: string,
    accessToken: string,
    issueIdOrKey: string,
  ): Promise<JiraTransition[]> {
    try {
      const client = this.createClient(cloudId, accessToken);
      const response = await client.get(`/issue/${issueIdOrKey}/transitions`);
      return response.data.transitions || [];
    } catch (error) {
      this.logger.error('Failed to get transitions', error.response?.data || error.message);
      throw new HttpException(
        'Failed to fetch Jira transitions',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Create a new issue
   */
  async createIssue(
    cloudId: string,
    accessToken: string,
    params: CreateJiraIssueParams,
  ): Promise<JiraIssue> {
    try {
      const client = this.createClient(cloudId, accessToken);
      
      const issueData: any = {
        fields: {
          project: { id: params.projectId },
          issuetype: { id: params.issueTypeId },
          summary: params.summary,
        },
      };

      // Add description in Atlassian Document Format (ADF)
      if (params.description) {
        issueData.fields.description = typeof params.description === 'string'
          ? this.textToADF(params.description)
          : params.description;
      }

      if (params.labels) {
        issueData.fields.labels = params.labels;
      }

      if (params.assignee) {
        issueData.fields.assignee = { accountId: params.assignee };
      }

      const response = await client.post('/issue', issueData);
      
      // Fetch the full issue to return
      const issue = await this.getIssue(cloudId, accessToken, response.data.key);
      
      this.logger.log(`Created Jira issue: ${response.data.key}`);
      return issue;
    } catch (error) {
      this.logger.error('Failed to create issue', error.response?.data || error.message);
      throw new HttpException(
        error.response?.data?.errors 
          ? JSON.stringify(error.response.data.errors)
          : 'Failed to create Jira issue',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Get an issue by ID or key
   */
  async getIssue(
    cloudId: string,
    accessToken: string,
    issueIdOrKey: string,
  ): Promise<JiraIssue> {
    try {
      const client = this.createClient(cloudId, accessToken);
      const response = await client.get(`/issue/${issueIdOrKey}`);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to get issue', error.response?.data || error.message);
      throw new HttpException(
        'Failed to fetch Jira issue',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Update an issue
   */
  async updateIssue(
    cloudId: string,
    accessToken: string,
    issueIdOrKey: string,
    params: UpdateJiraIssueParams,
  ): Promise<JiraIssue> {
    try {
      const client = this.createClient(cloudId, accessToken);
      
      const updateData: any = { fields: {} };

      if (params.summary) {
        updateData.fields.summary = params.summary;
      }

      if (params.description !== undefined) {
        updateData.fields.description = typeof params.description === 'string'
          ? this.textToADF(params.description)
          : params.description;
      }

      if (params.labels) {
        updateData.fields.labels = params.labels;
      }

      if (params.assignee !== undefined) {
        updateData.fields.assignee = params.assignee 
          ? { accountId: params.assignee }
          : null;
      }

      await client.put(`/issue/${issueIdOrKey}`, updateData);
      
      // Fetch updated issue
      const issue = await this.getIssue(cloudId, accessToken, issueIdOrKey);
      
      this.logger.log(`Updated Jira issue: ${issueIdOrKey}`);
      return issue;
    } catch (error) {
      this.logger.error('Failed to update issue', error.response?.data || error.message);
      throw new HttpException(
        'Failed to update Jira issue',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Transition an issue to a new status
   */
  async transitionIssue(
    cloudId: string,
    accessToken: string,
    issueIdOrKey: string,
    transitionId: string,
  ): Promise<void> {
    try {
      const client = this.createClient(cloudId, accessToken);
      
      await client.post(`/issue/${issueIdOrKey}/transitions`, {
        transition: { id: transitionId },
      });
      
      this.logger.log(`Transitioned Jira issue ${issueIdOrKey} with transition ${transitionId}`);
    } catch (error) {
      this.logger.error('Failed to transition issue', error.response?.data || error.message);
      throw new HttpException(
        'Failed to transition Jira issue',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Delete an issue
   */
  async deleteIssue(
    cloudId: string,
    accessToken: string,
    issueIdOrKey: string,
  ): Promise<void> {
    try {
      const client = this.createClient(cloudId, accessToken);
      await client.delete(`/issue/${issueIdOrKey}`);
      this.logger.log(`Deleted Jira issue: ${issueIdOrKey}`);
    } catch (error) {
      this.logger.error('Failed to delete issue', error.response?.data || error.message);
      throw new HttpException(
        'Failed to delete Jira issue',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Register a webhook for a project
   * 
   * Note: Jira Cloud webhooks are registered via the platform API, not the Jira REST API
   * See: https://developer.atlassian.com/cloud/jira/platform/webhooks/
   */
  async createWebhook(
    cloudId: string,
    accessToken: string,
    projectKey: string,
    callbackUrl: string,
  ): Promise<{ id: string; webhookRegistrationResult: any }> {
    try {
      // Jira Cloud webhooks use a different endpoint - the platform webhooks API
      const webhookClient = axios.create({
        baseURL: `${this.API_BASE}/${cloudId}/rest/api/3`,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });
      
      // Register webhook using Jira's webhook registration
      const response = await webhookClient.post('/webhook', {
        url: callbackUrl,
        webhooks: [
          {
            events: [
              'jira:issue_created',
              'jira:issue_updated',
              'jira:issue_deleted',
            ],
            jqlFilter: `project = ${projectKey}`,
          },
        ],
      });
      
      this.logger.log(`Created Jira webhook for project ${projectKey}: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to create webhook', error.response?.data || error.message);
      
      // Check if it's a scope issue
      if (error.response?.status === 403) {
        throw new HttpException(
          'Insufficient permissions to create webhook. Please reconnect with webhook permissions.',
          HttpStatus.FORBIDDEN,
        );
      }
      
      // Log the full error for debugging
      this.logger.error('Full webhook creation error:', JSON.stringify(error.response?.data));
      
      throw new HttpException(
        error.response?.data?.message || 'Failed to create Jira webhook',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(
    cloudId: string,
    accessToken: string,
    webhookId: string,
  ): Promise<void> {
    try {
      const client = this.createClient(cloudId, accessToken);
      await client.delete(`/webhook`, {
        data: {
          webhookIds: [parseInt(webhookId)],
        },
      });
      this.logger.log(`Deleted Jira webhook: ${webhookId}`);
    } catch (error) {
      this.logger.warn('Failed to delete webhook', error.response?.data || error.message);
      // Don't throw - webhook might already be deleted
    }
  }

  /**
   * Convert plain text to Atlassian Document Format (ADF)
   */
  private textToADF(text: string): any {
    // Split text into paragraphs
    const paragraphs = text.split('\n\n').filter(p => p.trim());
    
    return {
      version: 1,
      type: 'doc',
      content: paragraphs.map(para => ({
        type: 'paragraph',
        content: para.split('\n').map((line, index, arr) => {
          const content: any[] = [{ type: 'text', text: line }];
          // Add hard break between lines (but not after the last line)
          if (index < arr.length - 1) {
            content.push({ type: 'hardBreak' });
          }
          return content;
        }).flat(),
      })),
    };
  }

  /**
   * Get the browse URL for an issue
   */
  getIssueBrowseUrl(siteUrl: string, issueKey: string): string {
    return `${siteUrl}/browse/${issueKey}`;
  }
}
