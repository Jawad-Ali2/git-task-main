/**
 * Integration Provider Interface
 * 
 * This interface defines the contract that all integration providers (Trello, Jira, Asana, etc.)
 * must implement. It ensures consistent behavior across different platforms.
 */

import { Integration } from '../entities/integration.entity';
import { Task } from '../../tasks/entities/tasks.entity';

// Generic types for provider-agnostic operations
export interface Board {
  id: string;
  name: string;
  url?: string;
  description?: string;
}

export interface List {
  id: string;
  name: string;
  boardId: string;
  position?: number;
}

export interface Card {
  id: string;
  name: string;
  description?: string;
  url: string;
  listId: string;
  boardId?: string;
  key?: string; // Jira issue key (e.g., "PROJ-123")
}

export interface CardUpdate {
  name?: string;
  description?: string;
  listId?: string;
  status?: string;
  closed?: boolean;
}

export interface Webhook {
  id: string;
  modelId: string;
  callbackUrl: string;
  active?: boolean;
}

export interface WebhookResult {
  success: boolean;
  message: string;
  taskId?: string;
  statusChange?: { from: string; to: string };
}

export interface BoardWithLists {
  board: Board;
  lists: {
    todo: List;
    inProgress: List;
    done: List;
  };
}

export interface MemberInfo {
  id: string;
  username?: string;
  displayName?: string;
  email?: string;
  avatarUrl?: string;
}

/**
 * Main Integration Provider Interface
 * All providers (Trello, Jira, Asana) must implement this
 */
export interface IntegrationProvider {
  /**
   * Unique provider identifier
   */
  readonly providerName: 'trello' | 'jira' | 'asana';

  /**
   * OAuth Flow Methods
   */
  getAuthUrl(userId: string, repositoryId?: string): Promise<string>;
  handleCallback(userId: string, code: string, repositoryId?: string): Promise<Integration>;
  refreshToken?(integration: Integration): Promise<Integration>;

  /**
   * Validate credentials/token
   */
  validateCredentials(accessToken: string): Promise<MemberInfo>;

  /**
   * Board/Project Operations
   */
  getBoards(integration: Integration): Promise<Board[]>;
  getLists(integration: Integration, boardId: string): Promise<List[]>;
  createBoard?(integration: Integration, name: string, description?: string): Promise<BoardWithLists>;

  /**
   * Card/Issue Operations
   */
  createCard(integration: Integration, task: Task, listId: string): Promise<Card>;
  updateCard(integration: Integration, cardId: string, updates: CardUpdate): Promise<Card>;
  moveCard(integration: Integration, cardId: string, targetListId: string): Promise<Card>;
  getCard(integration: Integration, cardId: string): Promise<Card>;
  deleteCard?(integration: Integration, cardId: string): Promise<void>;

  /**
   * Webhook Operations
   */
  createWebhook(integration: Integration, boardId: string, callbackUrl: string): Promise<Webhook>;
  deleteWebhook(integration: Integration, webhookId: string): Promise<void>;

  /**
   * Status Mapping
   */
  mapStatusToListId(status: string, config: any): string | undefined;
  mapListIdToStatus(listId: string, config: any): string;

  /**
   * Build card description from task
   */
  buildCardDescription(task: Task): string;
}

/**
 * Provider Factory Interface
 */
export interface IntegrationProviderFactory {
  getProvider(providerName: string): IntegrationProvider;
  hasProvider(providerName: string): boolean;
  getSupportedProviders(): string[];
}
