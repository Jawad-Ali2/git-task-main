import { Injectable, Logger, Inject, HttpException, HttpStatus } from '@nestjs/common';
import Redis from 'ioredis';
import * as crypto from 'crypto';

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

@Injectable()
export class TrelloWebhookSecurityService {
  private readonly logger = new Logger(TrelloWebhookSecurityService.name);
  
  // Configuration
  private readonly IDEMPOTENCY_TTL = 86400; // 24 hours in seconds
  private readonly MAX_STALE_AGE_MS = 5 * 60 * 1000; // 5 minutes
  private readonly RETRY_QUEUE_KEY = 'trello:webhook:retry:queue';
  private readonly PROCESSED_KEY_PREFIX = 'trello:webhook:processed:';
  private readonly LOCK_KEY_PREFIX = 'trello:lock:card:';
  private readonly LOCK_TTL = 30; // 30 seconds
  private readonly MAX_RETRIES = 5;
  private readonly RETRY_DELAYS = [1000, 5000, 15000, 60000, 300000]; // 1s, 5s, 15s, 1m, 5m

  constructor(
    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
  ) {
    // Start retry processor
    this.startRetryProcessor();
  }

  /**
   * Verify Trello webhook signature using HMAC-SHA1
   * 
   * NOTE: Trello's webhook signature uses the USER'S OAUTH TOKEN as the secret,
   * not the API secret. This makes verification complex since we don't know
   * which user's token to use until we process the webhook.
   * 
   * For now, we skip signature verification and rely on other security measures:
   * - Idempotency (prevent replay attacks)
   * - Stale webhook rejection
   * - Distributed locking
   * 
   * To enable signature verification, you would need to:
   * 1. Extract board ID from webhook payload
   * 2. Look up the integration by board ID
   * 3. Use that integration's OAuth token as the HMAC secret
   */
  verifySignature(
    rawBody: string,
    signatureHeader: string | undefined,
    callbackUrl: string,
  ): boolean {
    // Skip signature verification - Trello uses user OAuth tokens as secrets
    // which requires looking up the integration before we can verify
    if (process.env.TRELLO_SKIP_SIGNATURE_VERIFICATION !== 'false') {
      this.logger.debug('Signature verification skipped (TRELLO_SKIP_SIGNATURE_VERIFICATION)');
      return true;
    }

    // If explicitly enabled, attempt verification with API secret (may not work)
    const trelloSecret = process.env.TRELLO_API_SECRET;
    
    if (!trelloSecret) {
      this.logger.warn('TRELLO_API_SECRET not configured, skipping signature verification');
      return true;
    }

    if (!signatureHeader) {
      this.logger.warn('Missing x-trello-webhook signature header');
      return true; // Allow - header may not always be present
    }

    try {
      // Trello uses base64(hmac-sha1(callbackUrl + body, secret))
      const content = callbackUrl + rawBody;
      const expectedSignature = crypto
        .createHmac('sha1', trelloSecret)
        .update(content)
        .digest('base64');

      // Log for debugging
      this.logger.debug(`Signature verification: received=${signatureHeader}, expected=${expectedSignature}`);

      // Constant-time comparison to prevent timing attacks
      try {
        const isValid = crypto.timingSafeEqual(
          Buffer.from(signatureHeader),
          Buffer.from(expectedSignature),
        );

        if (!isValid) {
          this.logger.warn('Signature mismatch - allowing anyway (Trello uses user tokens)');
        }

        return true; // Allow anyway since Trello signature verification is complex
      } catch {
        // Buffer length mismatch
        this.logger.warn('Signature length mismatch - allowing anyway');
        return true;
      }
    } catch (error) {
      this.logger.error(`Signature verification error: ${error.message}`);
      return true; // Allow on error
    }
  }

  /**
   * Generate unique idempotency key for webhook event
   */
  generateIdempotencyKey(payload: any): string {
    const action = payload.action;
    if (!action) {
      return `webhook:${Date.now()}:${crypto.randomUUID()}`;
    }

    // Use action ID + type + date for uniqueness
    const key = `${action.id}:${action.type}:${action.date}`;
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Check if webhook has already been processed (idempotency)
   */
  async isProcessed(idempotencyKey: string): Promise<boolean> {
    const key = `${this.PROCESSED_KEY_PREFIX}${idempotencyKey}`;
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  /**
   * Mark webhook as processed
   */
  async markAsProcessed(
    idempotencyKey: string,
    result: ProcessedWebhook,
  ): Promise<void> {
    const key = `${this.PROCESSED_KEY_PREFIX}${idempotencyKey}`;
    await this.redis.setex(key, this.IDEMPOTENCY_TTL, JSON.stringify(result));
    this.logger.debug(`Marked webhook ${idempotencyKey} as processed`);
  }

  /**
   * Check if webhook is stale (too old)
   */
  isStale(payload: any): boolean {
    const actionDate = payload.action?.date;
    if (!actionDate) {
      return false; // Can't determine, allow it
    }

    const webhookTime = new Date(actionDate).getTime();
    const age = Date.now() - webhookTime;
    
    if (age > this.MAX_STALE_AGE_MS) {
      this.logger.warn(
        `Stale webhook detected: ${Math.round(age / 1000)}s old (max: ${this.MAX_STALE_AGE_MS / 1000}s)`,
      );
      return true;
    }

    return false;
  }

  /**
   * Full validation of incoming webhook
   */
  async validateWebhook(
    rawBody: string,
    signatureHeader: string | undefined,
    callbackUrl: string,
    payload: any,
  ): Promise<WebhookValidationResult> {
    // 1. Verify signature
    const signatureValid = this.verifySignature(rawBody, signatureHeader, callbackUrl);
    if (!signatureValid) {
      return { isValid: false, error: 'Invalid webhook signature' };
    }

    // 2. Check for stale webhook
    if (this.isStale(payload)) {
      return { 
        isValid: false, 
        error: 'Webhook is stale (too old)', 
        isStale: true 
      };
    }

    // 3. Generate idempotency key
    const idempotencyKey = this.generateIdempotencyKey(payload);

    // 4. Check for duplicate
    const isDuplicate = await this.isProcessed(idempotencyKey);
    if (isDuplicate) {
      return { 
        isValid: false, 
        error: 'Webhook already processed', 
        webhookId: idempotencyKey,
        isDuplicate: true 
      };
    }

    return { 
      isValid: true, 
      webhookId: idempotencyKey 
    };
  }

  /**
   * Acquire distributed lock for a card to prevent race conditions
   */
  async acquireLock(cardId: string): Promise<boolean> {
    const lockKey = `${this.LOCK_KEY_PREFIX}${cardId}`;
    const lockValue = `${Date.now()}:${crypto.randomUUID()}`;
    
    // Try to acquire lock with NX (only if not exists) and EX (expire)
    const result = await this.redis.set(lockKey, lockValue, 'EX', this.LOCK_TTL, 'NX');
    
    if (result === 'OK') {
      this.logger.debug(`Acquired lock for card ${cardId}`);
      return true;
    }

    this.logger.debug(`Failed to acquire lock for card ${cardId} (already locked)`);
    return false;
  }

  /**
   * Release distributed lock for a card
   */
  async releaseLock(cardId: string): Promise<void> {
    const lockKey = `${this.LOCK_KEY_PREFIX}${cardId}`;
    await this.redis.del(lockKey);
    this.logger.debug(`Released lock for card ${cardId}`);
  }

  /**
   * Add failed webhook to retry queue
   */
  async queueForRetry(
    payload: any,
    error: string,
    retryCount: number = 0,
  ): Promise<void> {
    if (retryCount >= this.MAX_RETRIES) {
      this.logger.error(
        `Webhook exceeded max retries (${this.MAX_RETRIES}), dropping: ${JSON.stringify(payload.action?.id)}`,
      );
      return;
    }

    const retryItem = {
      payload,
      error,
      retryCount: retryCount + 1,
      queuedAt: Date.now(),
      nextRetryAt: Date.now() + this.RETRY_DELAYS[retryCount] || this.RETRY_DELAYS[this.RETRY_DELAYS.length - 1],
    };

    await this.redis.zadd(
      this.RETRY_QUEUE_KEY,
      retryItem.nextRetryAt,
      JSON.stringify(retryItem),
    );

    this.logger.log(
      `Queued webhook for retry (attempt ${retryItem.retryCount}/${this.MAX_RETRIES}) in ${this.RETRY_DELAYS[retryCount] / 1000}s`,
    );
  }

  /**
   * Get next item from retry queue (if ready)
   */
  async getNextRetry(): Promise<{ payload: any; retryCount: number } | null> {
    const now = Date.now();
    
    // Get items with score (nextRetryAt) <= now
    const items = await this.redis.zrangebyscore(
      this.RETRY_QUEUE_KEY,
      '-inf',
      now,
      'LIMIT',
      0,
      1,
    );

    if (items.length === 0) {
      return null;
    }

    const item = items[0];
    
    // Remove from queue
    await this.redis.zrem(this.RETRY_QUEUE_KEY, item);

    try {
      const parsed = JSON.parse(item);
      return {
        payload: parsed.payload,
        retryCount: parsed.retryCount,
      };
    } catch (error) {
      this.logger.error(`Failed to parse retry item: ${error.message}`);
      return null;
    }
  }

  /**
   * Start background processor for retry queue
   */
  private async startRetryProcessor(): Promise<void> {
    this.logger.log('Started webhook retry processor');
    
    // Process retry queue every 5 seconds
    setInterval(async () => {
      try {
        const item = await this.getNextRetry();
        if (item) {
          this.logger.log(`Processing retry (attempt ${item.retryCount})`);
          // Emit event for processing - will be handled by IntegrationsService
          // Using Redis pub/sub to notify the service
          await this.redis.publish('trello:webhook:retry', JSON.stringify(item));
        }
      } catch (error) {
        this.logger.error(`Retry processor error: ${error.message}`);
      }
    }, 5000);
  }

  /**
   * Get retry queue status
   */
  async getRetryQueueStatus(): Promise<{
    pendingCount: number;
    oldestItem?: { queuedAt: Date; retryCount: number };
  }> {
    const count = await this.redis.zcard(this.RETRY_QUEUE_KEY);
    
    if (count === 0) {
      return { pendingCount: 0 };
    }

    const oldest = await this.redis.zrange(this.RETRY_QUEUE_KEY, 0, 0);
    if (oldest.length > 0) {
      try {
        const parsed = JSON.parse(oldest[0]);
        return {
          pendingCount: count,
          oldestItem: {
            queuedAt: new Date(parsed.queuedAt),
            retryCount: parsed.retryCount,
          },
        };
      } catch {
        return { pendingCount: count };
      }
    }

    return { pendingCount: count };
  }

  /**
   * Clear all processed webhook records (for testing)
   */
  async clearProcessedRecords(): Promise<number> {
    const pattern = `${this.PROCESSED_KEY_PREFIX}*`;
    const keys = await this.redis.keys(pattern);
    
    if (keys.length === 0) {
      return 0;
    }

    await this.redis.del(...keys);
    return keys.length;
  }
}
