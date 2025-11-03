import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

export enum NotificationType {
  SCAN_STARTED = 'scan:started',
  SCAN_PROGRESS = 'scan:progress',
  SCAN_COMPLETED = 'scan:completed',
  SCAN_FAILED = 'scan:failed',
  REPO_ADDED = 'repo:added',
  REPO_REMOVED = 'repo:removed',
  WEBHOOK_CREATED = 'webhook:created',
  WEBHOOK_DELETED = 'webhook:deleted',
  WEBHOOK_FAILED = 'webhook:failed',
  TASK_CREATED = 'task:created',
  TASK_UPDATED = 'task:updated',
  TASK_DELETED = 'task:deleted',
}

export interface Notification {
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  timestamp: Date;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private publisher: Redis;
  private subscribers: Map<string, Redis> = new Map();

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {
    // Create a separate Redis client for publishing
    this.publisher = this.redis.duplicate();
  }

  /**
   * Emit a notification to a specific user
   * @param userId - The user ID to send notification to
   * @param notification - The notification payload
   */
  async emit(userId: string, notification: Notification): Promise<void> {
    const channel = this.getUserChannel(userId);
    const payload = JSON.stringify({
      ...notification,
      timestamp: new Date(),
    });

    try {
      await this.publisher.publish(channel, payload);
      this.logger.log(`📢 Notification sent to ${userId}: ${notification.type}`);
    } catch (error) {
      this.logger.error(`Failed to publish notification: ${error.message}`);
    }
  }

  /**
   * Emit a notification to multiple users
   */
  async emitToMany(userIds: string[], notification: Notification): Promise<void> {
    await Promise.all(userIds.map(userId => this.emit(userId, notification)));
  }

  /**
   * Subscribe to notifications for a specific user
   * Returns a callback-based subscription for SSE streaming
   */
  async subscribe(
    userId: string,
    callback: (notification: Notification) => void
  ): Promise<() => Promise<void>> {
    const channel = this.getUserChannel(userId);
    const subscriber = this.redis.duplicate();
    
    await subscriber.subscribe(channel);
    this.logger.log(`📡 User ${userId} subscribed to notifications`);

    // Store subscriber for cleanup
    this.subscribers.set(userId, subscriber);

    // Handle incoming messages
    subscriber.on('message', (ch, message) => {
      try {
        const notification = JSON.parse(message);
        callback(notification);
      } catch (error) {
        this.logger.error(`Failed to parse notification: ${error.message}`);
      }
    });

    // Return cleanup function
    return async () => {
      await subscriber.quit();
      this.subscribers.delete(userId);
      this.logger.log(`🔌 User ${userId} unsubscribed`);
    };
  }

  /**
   * Unsubscribe a user from notifications
   */
  async unsubscribe(userId: string): Promise<void> {
    const subscriber = this.subscribers.get(userId);
    if (subscriber) {
      await subscriber.quit();
      this.subscribers.delete(userId);
      this.logger.log(`Unsubscribed user ${userId}`);
    }
  }

  /**
   * Get Redis channel name for a user
   */
  private getUserChannel(userId: string): string {
    return `notifications:user:${userId}`;
  }

  /**
   * Set a lock to prevent duplicate operations
   * @param key - Lock key
   * @param ttl - Time to live in seconds
   * @returns true if lock was acquired, false if already locked
   */
  async acquireLock(key: string, ttl: number = 300): Promise<boolean> {
    const lockKey = `lock:${key}`;
    const result = await this.redis.set(lockKey, '1', 'EX', ttl, 'NX');
    return result === 'OK';
  }

  /**
   * Release a lock
   */
  async releaseLock(key: string): Promise<void> {
    const lockKey = `lock:${key}`;
    await this.redis.del(lockKey);
  }

  /**
   * Check if a lock exists
   */
  async isLocked(key: string): Promise<boolean> {
    const lockKey = `lock:${key}`;
    const exists = await this.redis.exists(lockKey);
    return exists === 1;
  }

  /**
   * Cleanup when module is destroyed
   */
  async onModuleDestroy() {
    await this.publisher.quit();
    for (const [userId, subscriber] of this.subscribers) {
      await subscriber.quit();
    }
    this.subscribers.clear();
  }
}
