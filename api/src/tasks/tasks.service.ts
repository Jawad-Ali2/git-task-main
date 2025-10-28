import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as RepoEntity } from '../repositories/entities/repository.entity';
import { Repository } from 'typeorm';
import { Task } from './entities/tasks.entity';
import Redis from 'ioredis';
import { Octokit } from '@octokit/rest';

interface ScanJob {
    repoId: string;
    userId: string;
    queuedAt: number;
    priority?: number;
}

export interface ScanStatus {
    status: 'queued' | 'processing' | 'completed' | 'failed';
    progress: { current: number; total: number; };
    error?: string;
    startedAt?: number;
    completedAt?: number;
    tasksFound?: number;
}

@Injectable()
export class TasksService {
    private readonly logger = new Logger(TasksService.name);
    private readonly QUEUE_KEY = 'tasks_queue';
    private isProcessing = false;


    constructor(
        @InjectRepository(RepoEntity)
        private readonly repoEntity: Repository<RepoEntity>,

        @InjectRepository(Task)
        private readonly taskRepo: Repository<Task>,

        @Inject('REDIS_CLIENT')
        private readonly redis: Redis,
    ) {
        this.startWorker();
    }

    /**
    *   Queue a repository scan (instant response)
    *  */
    async queueScan(repoId: string, userId: string, priority: number = 5): Promise<void> {
        const job: ScanJob = {
            repoId,
            userId,
            queuedAt: Date.now(),
            priority,
        }

        await this.redis.zadd(this.QUEUE_KEY, priority, JSON.stringify(job));

        await this.setStatus(repoId, {
            status: 'queued',
            progress: { current: 0, total: 0 },
        });

        this.logger.log(`Queued scan for repo ${repoId} by user ${userId} with priority ${priority}`);
    }


    /**
     * Get Scan status
     */
    async getScanStatus(repoId: string): Promise<ScanStatus | null> {
        const data = await this.redis.get(`scan:${repoId}:status`);
        return data ? JSON.parse(data) : null;
    }


    /** * Cancel a scan */
    async cancelScan(repoId: string): Promise<void> {
        await this.redis.set(`scan:${repoId}:cancel`, '1', 'EX', 3600);
        this.logger.log(`Cancelled scan for repo ${repoId}`);
    }

    /**
     * Background worker to process the scan queue
     */
    private async startWorker() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        this.logger.log('Task Extraction Worker Started');

        while (this.isProcessing) {
            try {
                const result = await this.redis.zpopmin(this.QUEUE_KEY);
                if (result.length === 0) {
                    await new Promise(res => setTimeout(res, 2000));
                    continue;
                }

                const jobData = result[0];
                const job: ScanJob = JSON.parse(jobData);

                await this.processScan(job);
            } catch (error) {
                this.logger.error('Error processing scan job', error);
                await new Promise(resolve => setTimeout(resolve, 1000));

            }
        }
    }

    /**
     * Main Scan Processing Logic
     */
    private async processScan(job: ScanJob): Promise<void> {
        const { repoId, userId } = job;

        try {
            await this.setStatus(repoId, {
                status: 'processing',
                progress: { current: 0, total: 100 },
                startedAt: Date.now(),
            });

            // Check for cancellation
            if (await this.isCancelled(repoId)) {
                throw new Error('Scan cancelled by user');
            }


            // Step 1: Get Repository (10%)
            await this.updateProgress(repoId, 10);
            // const repo = await this.repoEntity.findOne({ where: { id: repoId, user: { id: userId } }, relations: ['user'] });

            const repo = await this.repoEntity.createQueryBuilder('repository')
                .leftJoinAndSelect('repository.user', 'user')
                .addSelect('user.githubAccessToken')
                .where('repository.id = :repoId', { repoId })
                .andWhere('user.id = :userId', { userId })
                .getOne();

            if (!repo?.user) {
                throw new Error('Repository not found');
            }

            const token = repo.user.decryptGithubToken();
            console.log(token, repo.user);
            if (!token) {
                throw new Error('Invalid GitHub token');
            }

            const octokit = new Octokit({ auth: token });
            
            // Parse owner and repo name from URL
            const urlParts = repo.url.replace('https://github.com/', '').split('/');
            const owner = urlParts[0];
            const repoName = urlParts[1];

            this.logger.log(`Scanning ${owner}/${repoName} (UUID: ${repoId})`);

            // Step 2: Fetch File Tree (30%)
            await this.updateProgress(repoId, 30);
            const { data: tree } = await octokit.git.getTree({
                owner,
                repo: repoName,
                tree_sha: 'HEAD', // TODO: Handle default branch dynamically
                recursive: '1',
            });

            // Step 3: Fileter files (40%)
            await this.updateProgress(repoId, 40);
            const relevantFiles = tree.tree
                .filter(item => item.type === 'blob')
                .filter(item => this.shouldProcessFile(item.path || ''))
                .slice(0, 100) // Limit to first 100 files for demo

            this.logger.log(`Processing ${relevantFiles.length} files for repo ${repoName}`);

            // Step 4: Fetch File Contents (60%)
            await this.updateProgress(repoId, 60);
            const filesWithContent = await this.fetchFileContents(relevantFiles,
                owner, repoName, octokit, repoId
            );

            // Step 5: Extract Tasks (80%)
            await this.updateProgress(repoId, 80);
            const extractedTasks = this.extractTasksFromFiles(filesWithContent);

            // Step 6: Save to database (90%)
            await this.updateProgress(repoId, 90);

            // Clear old tasks
            await this.taskRepo.delete({ repository: { id: repoId } });

            // Save new tasks
            if (extractedTasks.length > 0) {
                const tasksEntities = extractedTasks.map(task =>
                    this.taskRepo.create({
                        ...task,
                        repository: repo,
                    })
                );

                await this.taskRepo.save(tasksEntities);
            };

            // Complete Scan (100%)
            await this.setStatus(repoId, {
                status: 'completed',
                progress: { current: 100, total: 100 },
                completedAt: Date.now(),
                tasksFound: extractedTasks.length,
            });

            this.logger.log(`Scan completed for rpo ${repoId}. Found ${extractedTasks.length} tasks.`);

        } catch (err) {
            this.logger.error(`Scan failed for repo ${repoId}: ${err.message}`, err.message);

            await this.setStatus(repoId, {
                status: 'failed',
                progress: { current: 0, total: 0 },
                error: err.message,
                completedAt: Date.now(),
            });
        }
    }

    /**
     * Should we Process this file based on its extension
     */
    private shouldProcessFile(path: string): boolean {
        const RELEVANT_EXTENSIONS = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.cpp', '.c', '.go', '.rb'];
        const IGNORE_PATTERNS = ['node_modules/', 'dist/', 'build/', '.git/', 'vendor/', '__pycache__/'];

        if (IGNORE_PATTERNS.some(pattern => path.includes(pattern))) {
            return false;
        }

        return RELEVANT_EXTENSIONS.some(ext => path.endsWith(ext));
    }

    /**
     * Fetch file contents in batch
     */
    private async fetchFileContents(
        files: any[],
        owner: string,
        repo: string,
        octokit: Octokit,
        repoId: string
    ) {
        const results: { path: any; content: string }[] = [];
        const batchSize = 10;

        for (let i = 0; i < files.length; i += batchSize) {
            if (await this.isCancelled(repoId)) {
                throw new Error('Scan cancelled by user');
            }

            const batch = files.slice(i, i + batchSize);
            const contents = await Promise.all(
                batch.map(async file => {
                    try {
                        const { data } = await octokit.repos.getContent({
                            owner,
                            repo,
                            path: file.path || '',
                        });

                        if ('content' in data && data.content) {
                            return {
                                path: file.path,
                                content: Buffer.from(data.content, 'base64').toString('utf-8')
                            }
                        }
                    } catch (err) {
                        this.logger.warn(`Failed to fetch content for file ${file.path}: ${err.message}`);
                    }
                    return null;
                }),
            );

            results.push(...contents.filter((c): c is { path: any; content: string } => c !== null));
        }

        return results;
    }

    /**
     * Extract tasks using regex (simple parser for now)
     */
    private extractTasksFromFiles(files: any[]) {
        const tasks: Array<{ description: string; filePath: any; lineNumber: number; status: string }> = [];
        const taskPatterns = [
            /\/\/\s*TODO:?\s*(.+)/gi,
            /\/\/\s*FIXME:?\s*(.+)/gi,
            /\/\/\s*HACK:?\s*(.+)/gi,
            /#\s*TODO:?\s*(.+)/gi,
            /#\s*FIXME:?\s*(.+)/gi,
        ];

        for (const file of files) {
            const lines = file.content.split('\n');

            lines.forEach((line, index) => {

                for (const pattern of taskPatterns) {
                    const matches = line.matchAll(pattern);
                    for (const match of matches) {
                        tasks.push({
                            description: match[1].trim(),
                            filePath: file.path,
                            lineNumber: index + 1,
                            status: 'open',
                        })
                    }
                }
            })
        }

        return tasks;
    }

    private async setStatus(repoId: string, status: ScanStatus): Promise<void> {
        await this.redis.set(`scan:${repoId}:status`, JSON.stringify(status), 'EX', 3600);
    }

    private async updateProgress(repoId: string, percentage: number) {
        const status = await this.getScanStatus(repoId);

        if (status) {
            status.progress = { current: percentage, total: 100 };
            await this.setStatus(repoId, status);
        }
    }

    private async isCancelled(repoId: string): Promise<boolean> {
        const cancelled = await this.redis.get(`scan:${repoId}:cancel`);
        return cancelled === '1';
    }

    async onModuleDestroy() {
        this.isProcessing = false;
        this.logger.log('Worker stopped');
    }

}
