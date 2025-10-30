import { Inject, Injectable, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import { Repository as RepoEntity } from './entities/repository.entity';
import { Octokit } from '@octokit/rest';
import Redis from 'ioredis';
import { createAppAuth } from '@octokit/auth-app';
import { readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class RepositoriesService {
    private readonly logger = new Logger(RepositoriesService.name);
    private readonly MAX_SAVED_REPOS = 20; // Limit per user

    constructor(
        @InjectRepository(User)
        private readonly user: Repository<User>,

        @InjectRepository(RepoEntity)
        private readonly repoEntity: Repository<RepoEntity>,

        @Inject('REDIS_CLIENT') private readonly redis: Redis
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
            where: { id: repoId, user: { id: userId } }
        });

        if (!repo) {
            throw new Error('Repository not found or access denied');
        }

        await this.repoEntity.remove(repo);
        this.logger.log(`Deleted repository ${repoId} for user ${userId}`);
        
        // Invalidate cache
        await this.invalidateUserCache(userId);
    }
}
