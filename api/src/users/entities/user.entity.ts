import { Repository } from '../../repositories/entities/repository.entity';
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, BeforeInsert, BeforeUpdate } from 'typeorm';
import * as crypto from 'crypto';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ nullable: true })
  githubId?: string;

  @Column({ nullable: true, select: false })
  refreshToken?: string; // Store hashed refresh token

  @Column({ nullable: true, select: false, type: 'text' })
  githubAccessToken?: string; // Encrypted GitHub API access token

  @Column({ nullable: true })
  name?: string;

  @Column({ unique: true, nullable: true })
  email?: string;

  @Column({ default: 'developer' })
  role: string; // developer | manager | admin

  @Column({ nullable: true, unique: true })
  githubInstallationId?: number; // GitHub App installation ID

  @OneToMany(() => Repository, (repo) => repo.user)
  repositories: Repository[];

  // Encrypt before saving to database
  @BeforeInsert()
  @BeforeUpdate()
  encryptSensitiveData() {
    if (this.githubAccessToken && !this.githubAccessToken.includes(':')) {
      // Only encrypt if not already encrypted (check for delimiter)
      this.githubAccessToken = this.encryptToken(this.githubAccessToken);
    }
  }

  // Encryption method
  private encryptToken(token: string): string {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'); // 32 bytes
    const iv = crypto.randomBytes(16); // Initialization vector

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  // Decryption method (use when needed)
  decryptGithubToken(): string | undefined {
    if (!this.githubAccessToken) return undefined;

    try {
      const parts = this.githubAccessToken.split(':');
      if (parts.length !== 3) return this.githubAccessToken; // Not encrypted

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
