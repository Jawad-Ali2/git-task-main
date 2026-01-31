import { Injectable, Logger, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import * as crypto from 'crypto';
import {
  WebhookValidationResult,
  ProcessedWebhook,
  RetryQueueStatus,
} from '../../interfaces/webhook-handler.interface';

/**
 * Base Webhook Security Service
 * 
 * Provides common webhook security functionality that can be shared across
 * all integration providers (Trello, Jira, Asana, etc.)
 * 
 * Features:
 * - Idempotency (prevent duplicate processing)
 * - Distributed locking (prevent race conditions)
 * - Retry queue with exponential backoff
 * - Stale webhook rejection
 */
@Injectable()
export class BaseWebhookSecurityService {
  protected readonly logger = new Logger(BaseWebhookSecurityService.name);
  
  // Configuration - can be overridden by child classes
  protected readonly IDEMPOTENCY_TTL = 86400; // 24 hours in seconds
  protected readonly MAX_STALE_AGE_MS = 5 * 60 * 1000; // 5 minutes
  protected readonly LOCK_TTL = 30; // 30 seconds
  protected readonly MAX_RETRIES = 5;
  protected readonly RETRY_DELAYS = [1000, 5000, 15000, 60000, 300000]; // 1s, 5s, 15s, 1m, 5m

  // Redis key prefixes - should be overridden per provider
  protected readonly PROVIDER_PREFIX: string = 'base';
  protected RETRY_QUEUE_KEY: string;
  protected PROCESSED_KEY_PREFIX: string;
  protected LOCK_KEY_PREFIX: string;

  constructor(
    @Inject('REDIS_CLIENT')
    protected readonly redis: Redis,
  ) {
    this.RETRY_QUEUE_KEY = `${this.PROVIDER_PREFIX}:webhook:retry:queue`;
    this.PROCESSED_KEY_PREFIX = `${this.PROVIDER_PREFIX}:webhook:processed:`;
    this.LOCK_KEY_PREFIX = `${this.PROVIDER_PREFIX}:lock:card:`;
  }

  /**
   * Initialize the retry processor
   * Should be called in onModuleInit of child class
   */
  protected async initRetryProcessor(retryChannel: string): Promise<void> {
    const subscriber = this.redis.duplicate();
    await subscriber.subscribe(retryChannel);
    
    subscriber.on('message', async (channel, message) => {
      if (channel === retryChannel) {
        try {
          const { payload, retryCount } = JSON.parse(message);
          await this.processRetry(payload, retryCount);
        } catch (error) {
          this.logger.error(`Failed to process retry: ${error.message}`);
        }
      }
    });

    this.logger.log(`Retry processor initialized for ${this.PROVIDER_PREFIX}`);
  }

  /**
   * Override this in child class to process retried webhooks
   */
  protected async processRetry(payload: any, retryCount: number): Promise<void> {
    this.logger.warn('processRetry not implemented in child class');
  }

  /**
   * Generate SHA256 hash for idempotency key
   */
  protected hashKey(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
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
   * Acquire distributed lock for a card/issue
   * Uses Redis SET NX EX for atomic lock acquisition
   */
  async acquireLock(cardId: string): Promise<boolean> {
    const key = `${this.LOCK_KEY_PREFIX}${cardId}`;
    const lockValue = `${Date.now()}:${crypto.randomUUID()}`;
    
    const result = await this.redis.set(key, lockValue, 'EX', this.LOCK_TTL, 'NX');
    
    if (result === 'OK') {
      this.logger.debug(`Lock acquired for ${cardId}`);
      return true;
    }
    
    this.logger.debug(`Failed to acquire lock for ${cardId} (already locked)`);
    return false;
  }

  /**
   * Release distributed lock
   */
  async releaseLock(cardId: string): Promise<void> {
    const key = `${this.LOCK_KEY_PREFIX}${cardId}`;
    await this.redis.del(key);
    this.logger.debug(`Lock released for ${cardId}`);
  }

  /**
   * Queue webhook for retry with exponential backoff
   */
  async queueForRetry(payload: any, error: string, retryCount: number): Promise<void> {
    if (retryCount >= this.MAX_RETRIES) {
      this.logger.error(
        `Max retries (${this.MAX_RETRIES}) exceeded for webhook. Dropping: ${JSON.stringify(payload).substring(0, 200)}...`,
      );
      return;
    }

    const delay = this.RETRY_DELAYS[retryCount] || this.RETRY_DELAYS[this.RETRY_DELAYS.length - 1];
    const nextRetryAt = Date.now() + delay;

    const retryItem = {
      payload,
      error,
      retryCount: retryCount + 1,
      nextRetryAt,
      provider: this.PROVIDER_PREFIX,
      queuedAt: Date.now(),
    };

    // Add to sorted set with score = nextRetryAt
    await this.redis.zadd(this.RETRY_QUEUE_KEY, nextRetryAt, JSON.stringify(retryItem));

    this.logger.log(
      `Queued webhook for retry #${retryCount + 1} in ${delay / 1000}s: ${error}`,
    );

    // Schedule processing
    setTimeout(async () => {
      await this.processRetryQueue();
    }, delay);
  }

  /**
   * Process items from retry queue
   */
  protected async processRetryQueue(): Promise<void> {
    const now = Date.now();
    
    // Get items due for retry
    const items = await this.redis.zrangebyscore(this.RETRY_QUEUE_KEY, 0, now);
    
    for (const itemStr of items) {
      try {
        const item = JSON.parse(itemStr);
        
        // Remove from queue
        await this.redis.zrem(this.RETRY_QUEUE_KEY, itemStr);
        
        // Publish for processing
        await this.redis.publish(
          `${this.PROVIDER_PREFIX}:webhook:retry`,
          JSON.stringify({ payload: item.payload, retryCount: item.retryCount }),
        );
      } catch (error) {
        this.logger.error(`Failed to process retry item: ${error.message}`);
      }
    }
  }

  /**
   * Get retry queue status
   */
  async getRetryQueueStatus(): Promise<RetryQueueStatus> {
    const items = await this.redis.zrange(this.RETRY_QUEUE_KEY, 0, -1, 'WITHSCORES');
    const queueItems: Array<{
      payload: any;
      error: string;
      retryCount: number;
      nextRetryAt: Date;
      provider: string;
    }> = [];
    
    for (let i = 0; i < items.length; i += 2) {
      try {
        const item = JSON.parse(items[i]);
        queueItems.push({
          payload: item.payload,
          error: item.lastError || '',
          retryCount: item.retryCount || 0,
          nextRetryAt: new Date(parseInt(items[i + 1])),
          provider: this.PROVIDER_PREFIX,
        });
      } catch (e) {
        // Skip malformed items
      }
    }

    return {
      queueLength: queueItems.length,
      items: queueItems,
    };
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  protected timingSafeEqual(a: string, b: string): boolean {
    try {
      return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    } catch {
      return false;
    }
  }
}
