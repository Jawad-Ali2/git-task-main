import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import * as crypto from 'crypto';
import { BaseWebhookSecurityService } from '../base/base-webhook-security.service';
import {
  WebhookValidationResult,
  JiraWebhookEvent,
} from '../../interfaces/webhook-handler.interface';

/**
 * Jira Webhook Security Service
 * 
 * Extends the base webhook security with Jira-specific:
 * - HMAC-SHA256 signature verification
 * - Jira webhook event parsing
 * - Idempotency key generation from Jira events
 */
@Injectable()
export class JiraWebhookSecurityService extends BaseWebhookSecurityService implements OnModuleInit {
  protected readonly logger = new Logger(JiraWebhookSecurityService.name);
  
  // Override provider prefix for Redis keys
  protected readonly PROVIDER_PREFIX = 'jira';
  protected readonly RETRY_QUEUE_KEY = 'jira:webhook:retry:queue';
  protected readonly PROCESSED_KEY_PREFIX = 'jira:webhook:processed:';
  protected readonly LOCK_KEY_PREFIX = 'jira:lock:issue:';

  constructor(
    @Inject('REDIS_CLIENT')
    redis: Redis,
  ) {
    super(redis);
  }

  async onModuleInit() {
    await this.initRetryProcessor('jira:webhook:retry');
    this.startRetryProcessor();
  }

  /**
   * Start background retry processor
   */
  private startRetryProcessor() {
    // Process retry queue every 30 seconds
    setInterval(async () => {
      await this.processRetryQueue();
    }, 30000);
  }

  /**
   * Verify Jira webhook signature using HMAC-SHA256
   * 
   * Jira uses a shared secret that you configure when setting up the webhook.
   * The signature is in the X-Hub-Signature header.
   */
  verifySignature(
    rawBody: string,
    signatureHeader: string | undefined,
    secret: string,
  ): boolean {
    // Skip if verification is disabled
    if (process.env.JIRA_SKIP_SIGNATURE_VERIFICATION === 'true') {
      this.logger.debug('Signature verification skipped (JIRA_SKIP_SIGNATURE_VERIFICATION)');
      return true;
    }

    if (!secret) {
      this.logger.warn('JIRA_WEBHOOK_SECRET not configured, skipping signature verification');
      return true;
    }

    if (!signatureHeader) {
      this.logger.warn('Missing X-Hub-Signature header');
      return true; // Allow - header may not always be present during setup
    }

    try {
      // Jira uses sha256=<signature> format
      const [algorithm, signature] = signatureHeader.split('=');
      
      if (algorithm !== 'sha256') {
        this.logger.warn(`Unexpected signature algorithm: ${algorithm}`);
        return true;
      }

      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

      const isValid = this.timingSafeEqual(signature, expectedSignature);

      if (!isValid) {
        this.logger.warn('Jira webhook signature mismatch');
      }

      return isValid;
    } catch (error) {
      this.logger.error(`Signature verification error: ${error.message}`);
      return true; // Allow on error to prevent blocking legitimate webhooks
    }
  }

  /**
   * Generate unique idempotency key for Jira webhook event
   */
  generateIdempotencyKey(payload: JiraWebhookEvent): string {
    // Use timestamp + event type + issue ID for uniqueness
    const parts = [
      payload.timestamp?.toString() || Date.now().toString(),
      payload.webhookEvent || 'unknown',
      payload.issue?.id || 'no-issue',
      payload.changelog?.id || 'no-changelog',
    ];

    const key = parts.join(':');
    return this.hashKey(key);
  }

  /**
   * Check if webhook is stale (too old)
   */
  isStale(payload: JiraWebhookEvent): boolean {
    if (!payload.timestamp) {
      return false; // Can't determine, allow it
    }

    const webhookTime = payload.timestamp;
    const age = Date.now() - webhookTime;
    
    if (age > this.MAX_STALE_AGE_MS) {
      this.logger.warn(
        `Stale Jira webhook detected: ${Math.round(age / 1000)}s old (max: ${this.MAX_STALE_AGE_MS / 1000}s)`,
      );
      return true;
    }

    return false;
  }

  /**
   * Full validation of incoming Jira webhook
   */
  async validateWebhook(
    rawBody: string,
    signatureHeader: string | undefined,
    callbackUrl: string,
    payload: JiraWebhookEvent,
  ): Promise<WebhookValidationResult> {
    const secret = process.env.JIRA_WEBHOOK_SECRET || '';

    // 1. Verify signature
    const signatureValid = this.verifySignature(rawBody, signatureHeader, secret);
    if (!signatureValid) {
      return { isValid: false, error: 'Invalid webhook signature' };
    }

    // 2. Check for stale webhook
    if (this.isStale(payload)) {
      return { 
        isValid: false, 
        error: 'Webhook is stale (too old)', 
        isStale: true,
      };
    }

    // 3. Generate and check idempotency key
    const webhookId = this.generateIdempotencyKey(payload);
    
    const isDuplicate = await this.isProcessed(webhookId);
    if (isDuplicate) {
      this.logger.debug(`Duplicate Jira webhook detected: ${webhookId}`);
      return { 
        isValid: false, 
        error: 'Duplicate webhook (already processed)', 
        isDuplicate: true,
        webhookId,
      };
    }

    return { isValid: true, webhookId };
  }

  /**
   * Parse Jira webhook event type to determine action
   */
  parseEventType(payload: JiraWebhookEvent): {
    action: 'created' | 'updated' | 'deleted' | 'unknown';
    hasStatusChange: boolean;
    statusChange?: { from: string; to: string };
  } {
    const event = payload.webhookEvent;
    
    let action: 'created' | 'updated' | 'deleted' | 'unknown' = 'unknown';
    let hasStatusChange = false;
    let statusChange: { from: string; to: string } | undefined;

    switch (event) {
      case 'jira:issue_created':
        action = 'created';
        break;
      case 'jira:issue_updated':
        action = 'updated';
        // Check for status change in changelog
        if (payload.changelog?.items) {
          const statusItem = payload.changelog.items.find(
            item => item.field === 'status' || item.fieldId === 'status',
          );
          if (statusItem) {
            hasStatusChange = true;
            statusChange = {
              from: statusItem.fromString || statusItem.from || '',
              to: statusItem.toString || statusItem.to || '',
            };
          }
        }
        break;
      case 'jira:issue_deleted':
        action = 'deleted';
        break;
    }

    return { action, hasStatusChange, statusChange };
  }

  /**
   * Extract relevant fields from changelog
   */
  extractChanges(payload: JiraWebhookEvent): Record<string, { from: any; to: any }> {
    const changes: Record<string, { from: any; to: any }> = {};
    
    if (!payload.changelog?.items) {
      return changes;
    }

    for (const item of payload.changelog.items) {
      changes[item.field] = {
        from: item.fromString || item.from,
        to: item.toString || item.to,
      };
    }

    return changes;
  }
}
