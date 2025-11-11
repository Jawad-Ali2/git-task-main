import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, BeforeInsert, BeforeUpdate } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Repository } from '../../repositories/entities/repository.entity';
import * as crypto from 'crypto';

@Entity('integrations')
export class Integration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  provider: string; // 'trello', 'jira', 'asana', etc. (extensible for future)

  @Column({ type: 'text', select: false })
  accessToken: string; // Encrypted OAuth access token

  @Column({ type: 'text', nullable: true, select: false })
  refreshToken?: string; // Encrypted refresh token (if applicable)

  @Column({ type: 'timestamp', nullable: true })
  tokenExpiresAt?: Date; // Token expiration date

  @Column({ type: 'json', nullable: true })
  config: {
    boardId?: string;
    boardName?: string;
    todoListId?: string; // List for new TODOs
    todoListName?: string;
    inProgressListId?: string; // List for in-progress tasks
    inProgressListName?: string;
    doneListId?: string; // List for completed tasks
    doneListName?: string;
    webhookId?: string; // Trello webhook ID for bi-directional sync
    syncEnabled?: boolean;
    autoCreateCards?: boolean;
    autoMoveCards?: boolean;
    customFieldMappings?: Record<string, string>;
  };

  @ManyToOne(() => User, { nullable: false })
  user: User;

  @ManyToOne(() => Repository, { nullable: true })
  repository?: Repository; // Optional: integration can be repo-specific or user-wide

  @Column({ default: 'active' })
  status: string; // 'active', 'inactive', 'error', 'revoked'

  @Column({ type: 'text', nullable: true })
  lastError?: string; // Store last error message for debugging

  @Column({ type: 'timestamp', nullable: true })
  lastSyncAt?: Date; // When was the last successful sync

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Encrypt tokens before saving
  @BeforeInsert()
  @BeforeUpdate()
  encryptSensitiveData() {
    if (this.accessToken && !this.accessToken.includes(':')) {
      this.accessToken = this.encryptToken(this.accessToken);
    }
    if (this.refreshToken && !this.refreshToken.includes(':')) {
      this.refreshToken = this.encryptToken(this.refreshToken);
    }
  }

  // Encryption method
  private encryptToken(token: string): string {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  // Decryption method
  decryptAccessToken(): string | undefined {
    return this.decryptToken(this.accessToken);
  }

  decryptRefreshToken(): string | undefined {
    return this.refreshToken ? this.decryptToken(this.refreshToken) : undefined;
  }

  private decryptToken(encryptedToken: string): string | undefined {
    if (!encryptedToken) return undefined;

    try {
      const parts = encryptedToken.split(':');
      if (parts.length !== 3) return encryptedToken; // Not encrypted

      const [ivHex, authTagHex, encrypted] = parts;
      const algorithm = 'aes-256-gcm';
      const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error);
      return undefined;
    }
  }
}
