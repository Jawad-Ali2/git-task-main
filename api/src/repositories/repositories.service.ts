import { Inject, Injectable, Logger, UnauthorizedException, BadRequestException, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import { Repository as RepoEntity } from './entities/repository.entity';
import { Octokit } from '@octokit/rest';
import Redis from 'ioredis';
import { createAppAuth } from '@octokit/auth-app';
import { readFileSync } from 'fs';
import { join } from 'path';
import axios from 'axios';
import { TasksService } from 'src/tasks/tasks.service';
import { NotificationsService, NotificationType } from 'src/notifications/notifications.service';

@Injectable()
export class RepositoriesService {
    private readonly logger = new Logger(RepositoriesService.name);
    private readonly MAX_SAVED_REPOS = 20; // Limit per user

    constructor(
        @InjectRepository(User)
        private readonly user: Repository<User>,

        @InjectRepository(RepoEntity)
        private readonly repoEntity: Repository<RepoEntity>,

        @Inject('REDIS_CLIENT') private readonly redis: Redis,
        
        @Inject(forwardRef(() => TasksService))
        private readonly tasksService: TasksService,
        
        private readonly notificationsService: NotificationsService,
    ) { }

    /**
     * Generate GitHub App installation token
     * This token is short-lived (1 hour) and provides access to repositories installed via GitHub App
     */
    private async getInstallationToken(installationId: number): Promise<string> {
        const appId = process.env.GITHUB_APP_ID;
        const privateKeyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH;

        if (!appId || !privateKeyPath) {
            this.logger.error('GitHub App configuration missing (GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY_PATH)');
            throw new Error('GitHub App configuration missing');
        }

        try {
            // Read the private key from file
            const privateKey = readFileSync(join(process.cwd(), privateKeyPath), 'utf-8');

            // Create app authentication
            const auth = createAppAuth({
                appId: parseInt(appId),
                privateKey,
            });

            // Get installation-specific token
            const installationAuth = await auth({
                type: 'installation',
                installationId,
            });

            this.logger.log(`Generated installation token for installation ID: ${installationId}`);
            return installationAuth.token;
        } catch (error) {
            this.logger.error(`Failed to generate installation token: ${error.message}`);
            throw new Error(`Failed to generate GitHub App installation token: ${error.message}`);
        }
    }

    /**
     * Fetch repositories from GitHub API with pagination and caching.
     * Does NOT save to database.
     */
    async fetchGithubRepos(userId: string, page: number = 1, perPage: number = 30, search?: string) {
        this.logger.log(`Fetching GitHub repos for user ${userId} (page: ${page}, perPage: ${perPage})`);

        const user = await this.user
            .createQueryBuilder('user')
            .addSelect('user.githubAccessToken')
            .where('user.id = :userId', { userId })
            .getOne();

        if (!user || !user.githubAccessToken) {
            this.logger.warn(`GitHub token missing for user ${userId}`);
            throw new UnauthorizedException('User not found or missing GitHub access token!');
        }

        const decryptedToken = user.decryptGithubToken();

        if (!decryptedToken) {
            this.logger.error(`Failed to decrypt GitHub token for user ${userId}`);
            throw new UnauthorizedException('Failed to decrypt GitHub access token');
        }

        // Cache key includes pagination and search params
        const cacheKey = `repos:list:${user.id}:${page}:${perPage}:${search || 'all'}`;
        const cachedData = await this.redis.get(cacheKey);

        if (cachedData) {
            this.logger.log(`Returning cached GitHub repos list for user ${user.id}`);
            return JSON.parse(cachedData);
        }

        const octokit = new Octokit({ auth: decryptedToken });

        try {
            // Fetch repos from GitHub
            const response = await octokit.repos.listForAuthenticatedUser({
                page,
                per_page: perPage,
                sort: 'updated',
                direction: 'desc'
            });

            let repos = response.data;

            // Filter by search term if provided
            if (search) {
                const searchLower = search.toLowerCase();
                repos = repos.filter(repo =>
                    repo.name.toLowerCase().includes(searchLower) ||
                    (repo.description && repo.description.toLowerCase().includes(searchLower))
                );
            }

            // Get saved repo IDs for this user
            const savedRepos = await this.repoEntity.find({
                where: { user: { id: userId } },
                select: ['githubId']
            });
            const savedRepoIds = new Set(savedRepos.map(r => r.githubId));

            const mappedRepos = repos.map(repo => ({
                githubId: repo.id.toString(),
                name: repo.name,
                fullName: repo.full_name,
                url: repo.html_url,
                private: repo.private,
                description: repo.description,
                language: repo.language,
                defaultBranch: repo.default_branch,
                updatedAt: repo.updated_at,
                isSaved: savedRepoIds.has(repo.id.toString()) // Mark if already saved
            }));

            const result = {
                repos: mappedRepos,
                pagination: {
                    page,
                    perPage,
                    hasMore: repos.length === perPage // Simple check for more pages
                }
            };

            // Cache for 10 minutes
            await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 600);

            this.logger.log(`Fetched ${mappedRepos.length} repos from GitHub for user ${user.id}`);

            return result;
        } catch (error) {
            this.logger.error(`GitHub API error: ${error.message}`);
            throw new UnauthorizedException('Failed to fetch repositories from GitHub');
        }
    }

    /**
     * Save selected repositories to the database.
     * Enforces a maximum limit per user.
     * @param userId - The user ID
     * @param githubRepoIds - Array of GitHub repository IDs to save
     * @param useInstallationToken - If true, uses GitHub App installation token instead of OAuth token (for webhook events)
     */
    async saveSelectedRepos(userId: string, githubRepoIds: string[], useInstallationToken: boolean = false) {
        this.logger.log(`Saving ${githubRepoIds.length} repos for user ${userId}`);

        const user = await this.user
            .createQueryBuilder('user')
            .addSelect('user.githubAccessToken')
            .where('user.id = :userId', { userId })
            .getOne();

        if (!user) {
            throw new UnauthorizedException('User not found!');
        }

        // Check current saved count
        const currentCount = await this.repoEntity.count({
            where: { user: { id: userId } }
        });

        const newCount = currentCount + githubRepoIds.length;

        if (newCount > this.MAX_SAVED_REPOS) {
            throw new BadRequestException(
                `Cannot save more than ${this.MAX_SAVED_REPOS} repositories. You currently have ${currentCount} saved.`
            );
        }

        let octokit: Octokit;
        let allRepos: any[] = [];

        // Use installation token for webhook events, OAuth token for manual saves
        if (useInstallationToken && user.githubInstallationId) {
            const installationToken = await this.getInstallationToken(user.githubInstallationId);
            octokit = new Octokit({ auth: installationToken });
            this.logger.log(`Using GitHub App installation token for user ${userId}`);

            // For GitHub App: Use installation-specific endpoint
            try {
                const response = await octokit.apps.listReposAccessibleToInstallation({
                    per_page: 100
                });
                // Extract repositories from the response
                allRepos = response.data.repositories || [];
                this.logger.log(`Fetched ${allRepos.length} repositories via GitHub App installation`);
            } catch (error) {
                this.logger.error(`Failed to fetch repos via installation: ${error.message}`);
                throw new Error(`Failed to fetch repositories via GitHub App: ${error.message}`);
            }
        } else {
            // Fallback to OAuth token
            if (!user.githubAccessToken) {
                throw new UnauthorizedException('User missing GitHub access token!');
            }

            const decryptedToken = user.decryptGithubToken();
            if (!decryptedToken) {
                throw new UnauthorizedException('Failed to decrypt GitHub access token');
            }
            octokit = new Octokit({ auth: decryptedToken });
            this.logger.log(`Using OAuth token for user ${userId}`);

            // For OAuth: Use standard user repos endpoint
            allRepos = await octokit.paginate(octokit.repos.listForAuthenticatedUser, {
                per_page: 100
            });
        }

        const repoMap = new Map(allRepos.map(r => [r.id.toString(), r]));

        const validRepos = githubRepoIds
            .map(id => repoMap.get(id))
            .filter((repo): repo is NonNullable<typeof repo> => repo !== undefined)
            .map(repo => ({
                githubId: repo.id.toString(),
                name: repo.name,
                url: repo.html_url,
                private: repo.private,
                user
            }));

        // Filter out already saved repos
        const newRepos: Array<{
            githubId: string;
            name: string;
            url: string;
            private: boolean;
            user: User;
        }> = [];

        for (const repo of validRepos) {
            const exists = await this.repoEntity.findOne({
                where: { githubId: repo.githubId, user: { id: userId } }
            });
            if (!exists) {
                newRepos.push(repo);
            }
        }

        if (newRepos.length > 0) {
            const savedRepos = await this.repoEntity.save(newRepos);
            this.logger.log(`Saved ${newRepos.length} new repos for user ${userId}`);
            
            // ✅ Create webhooks for each saved repository
            const decryptedToken = user.decryptGithubToken();
            if (decryptedToken) {
                for (const repo of savedRepos) {
                    try {
                        // Extract owner/repo from URL (e.g., "https://github.com/owner/repo")
                        const repoFullName = repo.url.replace('https://github.com/', '').replace(/\/$/, '');
                        await this.createWebhookForRepo(repoFullName, decryptedToken);
                        
                        // ✅ Send success notification for webhook
                        await this.notificationsService.emit(userId, {
                            type: NotificationType.WEBHOOK_CREATED,
                            title: 'Webhook Created',
                            message: `Webhook created successfully for ${repo.name}`,
                            timestamp: new Date(),
                        });
                    } catch (error) {
                        this.logger.error(`Failed to create webhook for ${repo.name}: ${error.message}`);
                        
                        // ✅ Send error notification
                        await this.notificationsService.emit(userId, {
                            type: NotificationType.WEBHOOK_FAILED,
                            title: 'Webhook Failed',
                            message: `Failed to create webhook for ${repo.name}`,
                            timestamp: new Date(),
                        });
                        // Continue with other repos even if one fails
                    }
                }
            } else {
                this.logger.warn(`Could not create webhooks - failed to decrypt token for user ${userId}`);
            }
            
            // ✅ Trigger automatic scan for each saved repository
            for (const repo of savedRepos) {
                try {
                    this.logger.log(`Queuing automatic scan for ${repo.name} (${repo.id})`);
                    await this.tasksService.queueScan(repo.id, userId, 10); // High priority for initial scans
                    
                    // ✅ Send info notification
                    await this.notificationsService.emit(userId, {
                        type: NotificationType.REPO_ADDED,
                        title: 'Repository Added',
                        message: `${repo.name} has been added and scan initiated`,
                        timestamp: new Date(),
                    });
                } catch (error) {
                    this.logger.error(`Failed to queue scan for ${repo.name}: ${error.message}`);
                    
                    // ✅ Send error notification
                    await this.notificationsService.emit(userId, {
                        type: NotificationType.SCAN_FAILED,
                        title: 'Scan Failed to Start',
                        message: `Could not initiate scan for ${repo.name}`,
                        timestamp: new Date(),
                    });
                }
            }
            
            // Invalidate cache
            await this.invalidateUserCache(userId);
            
            // Return the saved repositories with their database IDs
            return savedRepos;
        }

        // Invalidate cache even if no new repos (to refresh isSaved status)
        await this.invalidateUserCache(userId);
        return [];
    }

    /**
     * Get only saved repositories from database.
     */
    async getSavedRepos(userId: string) {
        return this.repoEntity.find({
            where: { user: { id: userId } },
            order: { name: 'ASC' }
        });
    }

    /**
     * Invalidate all cache entries for a user.
     */
    private async invalidateUserCache(userId: string) {
        const keys = await this.redis.keys(`repos:list:${userId}:*`);
        if (keys.length > 0) {
            await this.redis.del(...keys);
            this.logger.log(`Invalidated ${keys.length} cache keys for user ${userId}`);
        }
    }

    /**
     * Find a repository by its GitHub ID and user ID.
     * @param githubId
     * @param userId 
     */
    async findByGithubId(githubId: string, userId: string) {
        return await this.repoEntity.findOne({
            where: { githubId, user: { id: userId } }
        });
    }

    /**
     * Find a repository by its GitHub ID across all users (for webhook processing)
     * @param githubId - GitHub repository ID
     */
    async findByGithubIdAcrossUsers(githubId: string) {
        return await this.repoEntity.findOne({
            where: { githubId },
            relations: ['user']
        });
    }

    /**
     * Get count of monitored repositories for a user.
     */
    async countMonitoredRepos(userId: string): Promise<number> {
        return this.repoEntity.count({
            where: { user: { id: userId } }
        });
    }

    /**
     * Check if user can add more repositories
     */
    async canAddMoreRepos(userId: string, limit: number = 20): Promise<boolean> {
        const count = await this.countMonitoredRepos(userId);
        return count < limit;
    }

    /**
     * Remove a repository by GitHub ID (used by webhook auto-removal)
     */
    async removeByGithubId(userId: string, githubId: string): Promise<void> {
        const repo = await this.repoEntity.findOne({
            where: { githubId, user: { id: userId } }
        });

        if (repo) {
            await this.repoEntity.remove(repo);
            this.logger.log(`Removed repository ${githubId} for user ${userId}`);
            
            // Invalidate cache
            await this.invalidateUserCache(userId);
        }
    }

    /**
     * Delete a repository by database ID
     */
    async deleteRepository(userId: string, repoId: string): Promise<void> {
        const repo = await this.repoEntity.findOne({
            where: { id: repoId, user: { id: userId } },
            relations: ['user']
        });

        if (!repo) {
            throw new Error('Repository not found or access denied');
        }

        const repoName = repo.name;

        // ✅ Delete webhook before removing from database
        const user = await this.user
            .createQueryBuilder('user')
            .addSelect('user.githubAccessToken')
            .where('user.id = :userId', { userId })
            .getOne();

        if (user) {
            const decryptedToken = user.decryptGithubToken();
            if (decryptedToken) {
                try {
                    const repoFullName = repo.url.replace('https://github.com/', '').replace(/\/$/, '');
                    await this.deleteWebhookForRepo(repoFullName, decryptedToken);
                    
                    // ✅ Send success notification
                    await this.notificationsService.emit(userId, {
                        type: NotificationType.WEBHOOK_DELETED,
                        title: 'Webhook Deleted',
                        message: `Webhook removed for ${repoName}`,
                        timestamp: new Date(),
                    });
                } catch (error) {
                    this.logger.error(`Failed to delete webhook for ${repo.name}: ${error.message}`);
                    // Continue with repo deletion even if webhook deletion fails
                }
            }
        }

        await this.repoEntity.remove(repo);
        this.logger.log(`Deleted repository ${repoId} for user ${userId}`);
        
        // ✅ Send repository deletion notification
        await this.notificationsService.emit(userId, {
            type: NotificationType.REPO_REMOVED,
            title: 'Repository Removed',
            message: `${repoName} has been removed from monitoring`,
            timestamp: new Date(),
        });
        
        // Invalidate cache
        await this.invalidateUserCache(userId);
    }

    /**
     * Create a webhook for a repository using OAuth token
     * @param repoFullName - Full repository name (owner/repo)
     * @param accessToken - User's GitHub OAuth token (decrypted)
     */
    private async createWebhookForRepo(repoFullName: string, accessToken: string): Promise<void> {
        const webhookUrl = `${process.env.API_URL || 'http://localhost:5000'}/webhooks/github`;
        
        // ⚠️ Warning if using localhost
        if (webhookUrl.includes('localhost')) {
            this.logger.warn(`⚠️  WARNING: Using localhost URL (${webhookUrl}). GitHub cannot reach localhost! Use ngrok or deploy to production.`);
        }
        
        this.logger.log(`Creating webhook for ${repoFullName} → ${webhookUrl}`);
        
        try {
            const response = await axios.post(
                `https://api.github.com/repos/${repoFullName}/hooks`,
                {
                    name: 'web',
                    active: true,
                    events: ['push', 'pull_request', 'issues', 'issue_comment'],
                    config: {
                        url: webhookUrl,
                        content_type: 'json',
                        secret: process.env.GITHUB_WEBHOOK_SECRET,
                        insecure_ssl: '0'
                    }
                },
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        Accept: 'application/vnd.github+json',
                        'X-GitHub-Api-Version': '2022-11-28'
                    }
                }
            );
            
            this.logger.log(`✅ Webhook created for ${repoFullName} (ID: ${response.data.id}) → ${webhookUrl}`);
        } catch (error) {
            if (axios.isAxiosError(error)) {
                // Check if webhook already exists
                if (error.response?.status === 422 && error.response?.data?.errors?.some((e: any) => e.message?.includes('Hook already exists'))) {
                    this.logger.warn(`Webhook already exists for ${repoFullName}`);
                    return;
                }
                this.logger.error(`❌ Failed to create webhook for ${repoFullName}: ${error.response?.data?.message || error.message}`);
                this.logger.error(`Response: ${JSON.stringify(error.response?.data, null, 2)}`);
            } else {
                this.logger.error(`❌ Failed to create webhook for ${repoFullName}: ${error}`);
            }
            throw new Error(`Failed to create webhook for ${repoFullName}`);
        }
    }

    /**
     * Delete a webhook for a repository using OAuth token
     * @param repoFullName - Full repository name (owner/repo)
     * @param accessToken - User's GitHub OAuth token (decrypted)
     */
    private async deleteWebhookForRepo(repoFullName: string, accessToken: string): Promise<void> {
        const webhookUrl = `${process.env.API_URL || 'http://localhost:5000'}/webhooks/github`;
        
        try {
            // First, get all webhooks for the repo
            const response = await axios.get(
                `https://api.github.com/repos/${repoFullName}/hooks`,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        Accept: 'application/vnd.github+json',
                        'X-GitHub-Api-Version': '2022-11-28'
                    }
                }
            );

            // Find the webhook with our URL
            const webhook = response.data.find((hook: any) => hook.config?.url === webhookUrl);

            if (webhook) {
                // Delete the webhook
                await axios.delete(
                    `https://api.github.com/repos/${repoFullName}/hooks/${webhook.id}`,
                    {
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            Accept: 'application/vnd.github+json',
                            'X-GitHub-Api-Version': '2022-11-28'
                        }
                    }
                );
                
                this.logger.log(`✅ Webhook deleted for ${repoFullName} (ID: ${webhook.id})`);
            } else {
                this.logger.warn(`No webhook found for ${repoFullName}`);
            }
        } catch (error) {
            if (axios.isAxiosError(error)) {
                this.logger.error(`Failed to delete webhook for ${repoFullName}: ${error.response?.data?.message || error.message}`);
            } else {
                this.logger.error(`Failed to delete webhook for ${repoFullName}: ${error}`);
            }
            // Don't throw - webhook deletion is not critical
        }
    }
}
