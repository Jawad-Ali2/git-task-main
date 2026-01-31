/**
 * Provider Configuration Types
 * 
 * Each integration provider has its own configuration structure.
 * These interfaces define what's stored in the Integration.config JSON field.
 */

/**
 * Base configuration shared by all providers
 */
export interface BaseProviderConfig {
  syncEnabled?: boolean;
  autoCreateCards?: boolean;
  autoMoveCards?: boolean;
  webhookId?: string;
}

/**
 * Trello-specific configuration
 */
export interface TrelloConfig extends BaseProviderConfig {
  boardId?: string;
  boardName?: string;
  todoListId?: string;
  todoListName?: string;
  inProgressListId?: string;
  inProgressListName?: string;
  doneListId?: string;
  doneListName?: string;
  customFieldMappings?: Record<string, string>;
}

/**
 * Jira-specific configuration
 * 
 * Note: Jira uses "statuses" instead of "lists" - statuses are part of a workflow
 * and issues transition between them.
 */
export interface JiraConfig extends BaseProviderConfig {
  // Cloud/Site info
  cloudId?: string;           // Jira Cloud instance ID (required for API calls)
  siteUrl?: string;           // e.g., https://yourcompany.atlassian.net
  
  // Project info
  projectId?: string;
  projectKey?: string;        // e.g., "PROJ"
  projectName?: string;
  
  // Issue type
  issueTypeId?: string;       // e.g., "10001" for Task
  issueTypeName?: string;     // e.g., "Task", "Bug", "Story"
  
  // Status mapping (Jira uses status IDs, not list IDs)
  todoStatusId?: string;
  todoStatusName?: string;
  inProgressStatusId?: string;
  inProgressStatusName?: string;
  doneStatusId?: string;
  doneStatusName?: string;
  
  // Transition IDs (needed to move issues between statuses)
  toTodoTransitionId?: string;
  toInProgressTransitionId?: string;
  toDoneTransitionId?: string;
  
  // Custom field mappings
  priorityFieldId?: string;
  customFieldMappings?: Record<string, string>;
}

/**
 * Asana-specific configuration (future)
 */
export interface AsanaConfig extends BaseProviderConfig {
  workspaceId?: string;
  workspaceName?: string;
  projectId?: string;
  projectName?: string;
  todoSectionId?: string;
  todoSectionName?: string;
  inProgressSectionId?: string;
  inProgressSectionName?: string;
  doneSectionId?: string;
  doneSectionName?: string;
}

/**
 * Union type for all provider configs
 */
export type ProviderConfig = TrelloConfig | JiraConfig | AsanaConfig;

/**
 * Type guard functions
 */
export function isTrelloConfig(config: ProviderConfig): config is TrelloConfig {
  return 'boardId' in config || 'todoListId' in config;
}

export function isJiraConfig(config: ProviderConfig): config is JiraConfig {
  return 'cloudId' in config || 'projectKey' in config || 'todoStatusId' in config;
}

export function isAsanaConfig(config: ProviderConfig): config is AsanaConfig {
  return 'workspaceId' in config || 'todoSectionId' in config;
}
