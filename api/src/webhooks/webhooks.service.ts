import { RepositoriesService } from '@/repositories/repositories.service';
import { TasksService } from '@/tasks/tasks.service';
import { User } from '@/users/entities/user.entity';
import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';

@Injectable()
export class WebhooksService {
    private readonly logger = new Logger(WebhooksService.name);

    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly tasksService: TasksService,
        private readonly repositoriesService: RepositoriesService
    ) { }


    async handleInstallationRepositoriesEvent(payload: any) {
        const { action, installation, repositories_added, repositories_removed } = payload;

        this.logger.log(
            `Installation repositories ${action}: ${installation.account.login} (${installation.id})`
        );

        // Find user by installation ID
        const user = await this.userRepository.findOne({ where: { githubInstallationId: installation.id } });

        if (!user) {
            this.logger.warn(`No user found for installation ID: ${installation.id}`);
            return { message: 'User not found.' };
        }

        // Auto-add newly selected repositories
        if (repositories_added && repositories_added.length > 0) {
            const repoIds = repositories_added.map(repo => repo.id.toString());
            try {
                await this.repositoriesService.saveSelectedRepos(user.id, repoIds);
                this.logger.log(`✅ Auto-added ${repoIds.length} repositories for user ${user.id}`);
            } catch (error) {
                this.logger.error(`Failed to auto-add repositories: ${error.message}`);
            }
        }

        // Auto-remove deselected repositories
        if (repositories_removed && repositories_removed.length > 0) {
            for (const repo of repositories_removed) {
                try {
                    await this.repositoriesService.removeByGithubId(user.id, repo.id.toString());
                    this.logger.log(`✅ Auto-removed repository ${repo.name} for user ${user.id}`);
                } catch (error) {
                    this.logger.error(`Failed to auto-remove repository: ${error.message}`);
                }
            }
        }

        return {
            message: 'Installation repositories event processed.',
            added: repositories_added?.length || 0,
            removed: repositories_removed?.length || 0
        };
    }

    async handleInstallationEvent(payload: any) {
        const { action, installation, sender, repositories } = payload;

        this.logger.log(
            `Installation ${action}: ${installation.account.login} (${installation.id})`
        );

        if (action === 'created') {
            // User installed the app
            const user = await this.userRepository.findOne({ where: { githubId: sender.id.toString() } });

            // We'll link installation ID to user in the frontend callback
            if (user) {
                user.githubInstallationId = installation.id;
                await this.userRepository.save(user);
                this.logger.log(`New installation: ${installation.id}`);

                // Auto-add selected repositories to database
                if (repositories && repositories.length > 0) {
                    const repoIds = repositories.map(repo => repo.id.toString());
                    try {
                        await this.repositoriesService.saveSelectedRepos(user.id, repoIds);
                        this.logger.log(`✅ Auto-added ${repoIds.length} repositories for user ${user.id}`);
                    } catch (error) {
                        this.logger.error(`Failed to auto-add repositories: ${error.message}`);
                    }
                }

                return {
                    message: 'Installation event handled.',
                    installationId: installation.id,
                    repositoriesAdded: repositories?.length || 0
                }
            } else {
                this.logger.warn(
                    `⚠️  User not found for GitHub ID ${sender.id}. User needs to login first.`
                );

                return {
                    message: 'User not found. Please login first.',
                    installationId: installation.id,
                };
            }


        }

        if (action === 'deleted') {
            // User uninstalled the app - remove installation ID
            const user = await this.userRepository.findOne({ where: { githubInstallationId: installation.id } });

            if (user) {
                user.githubInstallationId = undefined;
                await this.userRepository.save(user);
                this.logger.log(`Installation ${installation.id} uninstalled, user ${user.id} updated.`);
            }

            return { message: 'Installation deleted event handled.' }
        }

        return { message: `Installation event ${action} ignored.` };

    }



    async handlePushEvent(payload: any) {
        const { repository, installation, pusher, commits } = payload;

        if (!repository || !installation || !pusher || !commits) {
            throw new BadRequestException('Invalid payload structure');
        }

        const repoFullName = repository.full_name;
        const installationId = installation.id;

        this.logger.log(`Push event on repository: ${repoFullName} by ${pusher.name} (${commits.length} commits)`);

        const user = await this.userRepository.findOne({ where: { githubInstallationId: installationId } });

        if (!user) {
            this.logger.warn(`No user found for installation ID: ${installationId}`);
            return { message: 'User not found.' };
        }

        // Find saved repo in DB
        // const dbRepo = await this.repositoriesService.getSavedRepos(user.id);
        const monitoredRepo = await this.repositoriesService.findByGithubId(
            repository.id.toString(),
            user.id
        );

        if (!monitoredRepo) {
            this.logger.log(`Repository ${repoFullName} not saved by user, ignoring push event.`);
            return {
                message: 'Repository not monitored',
                hint: 'User must add this repository from the dashboard to enable scanning'
            };
        }

        // Queue scan with latest commit info
        await this.tasksService.queueScan(
            monitoredRepo.id,
            user.id,
            5 // Priority level
        );

        this.logger.log(`Scan queued for ${repoFullName}`);

        return {
            message: 'Scan queued successfully.',
            repository: repoFullName,
            commits: commits.length
        }
    }
    verifySignature(payload: string, signature: string): boolean {
        const secret = process.env.GITHUB_WEBHOOK_SECRET;
        if (!secret) {
            this.logger.error('GITHUB_WEBHOOK_SECRET is not set');
            return false;
        }

        const hmac = createHmac('sha256', secret);
        const digest = 'sha256=' + hmac.update(payload).digest('hex');

        // Constant-time comparison to prevent timing attacks
        try {
            return timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
        } catch (err) {
            return false;
        }
    }

    async linkInstallationToUser(userId: string, installationId: number): Promise<User> {
        const user = await this.userRepository.findOne({ where: { id: userId } });

        if (!user) {
            throw new BadRequestException('User not found');
        }

        user.githubInstallationId = installationId;
        await this.userRepository.save(user);

        this.logger.log(`Linked installation ${installationId} to user ${userId}`);

        return user;
    }
}
