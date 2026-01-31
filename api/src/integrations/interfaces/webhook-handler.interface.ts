/**
 * Webhook Handler Interface
 * 
 * Defines the contract for webhook security and processing across all providers.
 */

export interface WebhookValidationResult {
  isValid: boolean;
  error?: string;
  webhookId?: string;
  isDuplicate?: boolean;
  isStale?: boolean;
}

export interface ProcessedWebhook {
  id: string;
  processedAt: Date;
  actionType: string;
  cardId: string;
  result: 'success' | 'failed' | 'skipped';
  error?: string;
}

export interface WebhookContext {
  provider: 'trello' | 'jira' | 'asana';
  userId?: string;
  integrationId?: string;
  taskId?: string;
  cardId: string;
  actionType: string;
  timestamp: Date;
  webhookId?: string;
}

export interface RetryQueueItem {
  payload: any;
  error: string;
  retryCount: number;
  nextRetryAt: Date;
  provider: string;
}

export interface RetryQueueStatus {
  queueLength: number;
  items: RetryQueueItem[];
}

/**
 * Webhook Security Service Interface
 * All providers must implement this for consistent webhook handling
 */
export interface WebhookSecurityService {
  /**
   * Verify webhook signature
   */
  verifySignature(
    rawBody: string,
    signatureHeader: string | undefined,
    secret: string,
  ): boolean;

  /**
   * Generate unique idempotency key for webhook event
   */
  generateIdempotencyKey(payload: any): string;

  /**
   * Check if webhook has already been processed
   */
  isProcessed(idempotencyKey: string): Promise<boolean>;

  /**
   * Mark webhook as processed
   */
  markAsProcessed(idempotencyKey: string, result: ProcessedWebhook): Promise<void>;

  /**
   * Check if webhook is stale (too old)
   */
  isStale(payload: any): boolean;

  /**
   * Full validation of incoming webhook
   */
  validateWebhook(
    rawBody: string,
    signatureHeader: string | undefined,
    callbackUrl: string,
    payload: any,
  ): Promise<WebhookValidationResult>;

  /**
   * Acquire distributed lock for a card/issue
   */
  acquireLock(cardId: string): Promise<boolean>;

  /**
   * Release distributed lock
   */
  releaseLock(cardId: string): Promise<void>;

  /**
   * Queue failed webhook for retry
   */
  queueForRetry(payload: any, error: string, retryCount: number): Promise<void>;

  /**
   * Get retry queue status
   */
  getRetryQueueStatus(): Promise<RetryQueueStatus>;
}

/**
 * Webhook event types by provider
 */
export interface TrelloWebhookEvent {
  action: {
    id: string;
    type: string;
    date: string;
    data: {
      card?: { id: string; name: string };
      board?: { id: string; name: string };
      list?: { id: string; name: string };
      listBefore?: { id: string; name: string };
      listAfter?: { id: string; name: string };
      old?: Record<string, any>;
    };
    memberCreator?: {
      id: string;
      username: string;
      fullName: string;
    };
  };
  model: {
    id: string;
    name: string;
  };
}

export interface JiraWebhookEvent {
  timestamp: number;
  webhookEvent: string; // e.g., "jira:issue_updated"
  issue_event_type_name?: string; // e.g., "issue_generic"
  user: {
    accountId: string;
    displayName: string;
    emailAddress?: string;
  };
  issue: {
    id: string;
    key: string;
    fields: {
      summary: string;
      description?: any;
      status: {
        id: string;
        name: string;
        statusCategory: {
          id: number;
          key: string;
          name: string;
        };
      };
      project: {
        id: string;
        key: string;
        name: string;
      };
      issuetype: {
        id: string;
        name: string;
      };
      priority?: {
        id: string;
        name: string;
      };
    };
  };
  changelog?: {
    id: string;
    items: Array<{
      field: string;
      fieldtype: string;
      fieldId?: string;
      from: string | null;
      fromString: string | null;
      to: string | null;
      toString: string | null;
    }>;
  };
}
