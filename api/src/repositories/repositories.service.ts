import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import { Repository as RepoEntity } from './entities/repository.entity';
import { Octokit } from '@octokit/rest';
import Redis from 'ioredis';

@Injectable()
export class RepositoriesService {
    private readonly logger = new Logger(RepositoriesService.name);

    constructor(
        @InjectRepository(User)
        private readonly user: Repository<User>,

        @InjectRepository(RepoEntity)
        private readonly repoEntity: Repository<RepoEntity>,

        @Inject('REDIS_CLIENT') private readonly redis: Redis

    ) { }

    /**
   * Fetch user repositories from GitHub and store them in the database.
   * Uses Redis caching to avoid re-fetching repeatedly within 1 hour.
   */
    async fetchAndStoreUserRepos(userId: string) {
        // Log access attempt
        this.logger.log(`GitHub API access requested by user ${userId}`);
        
        const user = await this.user
            .createQueryBuilder('user')
            .addSelect('user.githubAccessToken')
            .where('user.id = :userId', { userId })
            .getOne();

        if (!user || !user.githubAccessToken) {
            this.logger.warn(`GitHub token missing for user ${userId}`);
            throw new UnauthorizedException('User not found or missing GitHub access token!');
        }

        // Decrypt the GitHub token
        const decryptedToken = user.decryptGithubToken();
        
        if (!decryptedToken) {
            this.logger.error(`Failed to decrypt GitHub token for user ${userId}`);
            throw new UnauthorizedException('Failed to decrypt GitHub access token');
        }

        this.logger.log(`Successfully decrypted GitHub token for user ${userId}`);

        const cacheKey = `repos:${user.id}`;

        const cachedRepos = await this.redis.get(cacheKey);

        if (cachedRepos) {
            this.logger.log(`Returning cached repos for user ${user.id}`)
            return JSON.parse(cachedRepos);
        }

        const octokit = new Octokit({ auth: decryptedToken });

        const repos = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
            per_page: 20
        });

        const mappedRepos = repos.map(repo => ({
            githubId: repo.id.toString(),
            name: repo.name,
            url: repo.html_url,
            private: repo.private,
            user
        }));

        for (const repo of mappedRepos) {
            const exists = await this.repoEntity.findOne({
                where: { githubId: repo.githubId, user: { id: user.id } }
            })

            if (!exists) {
                await this.repoEntity.save(repo);
            }
        }

        await this.redis.set(cacheKey, JSON.stringify(mappedRepos), 'EX', 3600);

        this.logger.log(`Fetched and cached ${mappedRepos.length} repos for user ${user.id}`);

        return repos.map(r => ({
            name: r.name,
            url: r.html_url,
            private: r.private
        }));
    }

    /**
   * Retrieve repositories from the database for the current user.
   */
    async getUserRepos(userId: any) {
        const cacheKey = `repos:${userId}`;

        const cachedRepos = await this.redis.get(cacheKey);

        if (cachedRepos) {
            this.logger.log(`Returning cached repos for user ${userId}`)
            return JSON.parse(cachedRepos);
        }

        return this.repoEntity.find({ where: { user: { id: userId } } });
    }
}
