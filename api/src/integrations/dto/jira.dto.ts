import { IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';

/**
 * Jira Configuration DTO
 * Used when configuring the Jira integration with project and status mappings
 */
export class JiraConfigDto {
  @IsString()
  cloudId: string; // Jira Cloud instance ID

  @IsString()
  siteUrl: string; // e.g., https://yourcompany.atlassian.net

  @IsString()
  projectId: string;

  @IsString()
  projectKey: string;

  @IsString()
  projectName: string;

  @IsString()
  issueTypeId: string;

  @IsString()
  issueTypeName: string;

  @IsString()
  todoStatusId: string;

  @IsString()
  todoStatusName: string;

  @IsOptional()
  @IsString()
  inProgressStatusId?: string;

  @IsOptional()
  @IsString()
  inProgressStatusName?: string;

  @IsOptional()
  @IsString()
  doneStatusId?: string;

  @IsOptional()
  @IsString()
  doneStatusName?: string;

  @IsOptional()
  @IsString()
  toTodoTransitionId?: string;

  @IsOptional()
  @IsString()
  toInProgressTransitionId?: string;

  @IsOptional()
  @IsString()
  toDoneTransitionId?: string;

  @IsBoolean()
  syncEnabled: boolean;

  @IsBoolean()
  autoCreateCards: boolean;

  @IsBoolean()
  autoMoveCards: boolean;
}

/**
 * Jira Cloud Site (from accessible-resources API)
 */
export interface JiraCloudSite {
  id: string;           // Cloud ID
  url: string;          // Site URL (e.g., https://company.atlassian.net)
  name: string;         // Site name
  scopes: string[];     // Granted scopes
  avatarUrl?: string;
}

/**
 * Jira Project
 */
export interface JiraProject {
  id: string;
  key: string;          // e.g., "PROJ"
  name: string;
  projectTypeKey: string; // "software", "business", etc.
  avatarUrls?: {
    '48x48'?: string;
    '24x24'?: string;
    '16x16'?: string;
    '32x32'?: string;
  };
}

/**
 * Jira Issue Type
 */
export interface JiraIssueType {
  id: string;
  name: string;         // "Task", "Bug", "Story", "Epic", etc.
  description?: string;
  iconUrl?: string;
  subtask: boolean;
}

/**
 * Jira Status (within a workflow)
 */
export interface JiraStatus {
  id: string;
  name: string;         // "To Do", "In Progress", "Done", etc.
  description?: string;
  statusCategory: {
    id: number;
    key: string;        // "new", "indeterminate", "done"
    name: string;       // "To Do", "In Progress", "Done"
    colorName: string;  // "blue-gray", "yellow", "green"
  };
}

/**
 * Jira Transition (to move issues between statuses)
 */
export interface JiraTransition {
  id: string;
  name: string;
  to: JiraStatus;
  hasScreen: boolean;
  isGlobal: boolean;
  isInitial: boolean;
  isConditional: boolean;
}

/**
 * Jira Issue
 */
export interface JiraIssue {
  id: string;
  key: string;          // e.g., "PROJ-123"
  self: string;         // API URL
  fields: {
    summary: string;
    description?: any;  // Atlassian Document Format
    status: JiraStatus;
    project: JiraProject;
    issuetype: JiraIssueType;
    priority?: {
      id: string;
      name: string;
      iconUrl?: string;
    };
    assignee?: {
      accountId: string;
      displayName: string;
      emailAddress?: string;
      avatarUrls?: Record<string, string>;
    };
    reporter?: {
      accountId: string;
      displayName: string;
      emailAddress?: string;
    };
    created: string;
    updated: string;
    labels?: string[];
  };
}

/**
 * Create Issue Request
 */
export interface CreateJiraIssueParams {
  projectId: string;
  issueTypeId: string;
  summary: string;
  description?: any;    // Atlassian Document Format
  priority?: string;
  labels?: string[];
  assignee?: string;    // Account ID
}

/**
 * Update Issue Request
 */
export interface UpdateJiraIssueParams {
  summary?: string;
  description?: any;
  priority?: string;
  labels?: string[];
  assignee?: string;
}

/**
 * Jira OAuth Token Response
 */
export interface JiraOAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;     // Seconds until expiration (typically 3600)
  token_type: string;     // "Bearer"
  scope: string;
}

/**
 * Jira User (from /myself endpoint)
 */
export interface JiraUser {
  accountId: string;
  accountType: string;    // "atlassian"
  emailAddress?: string;
  displayName: string;
  avatarUrls?: Record<string, string>;
  active: boolean;
  timeZone?: string;
  locale?: string;
}
