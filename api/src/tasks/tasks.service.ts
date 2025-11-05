import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as RepoEntity } from '../repositories/entities/repository.entity';
import { Repository } from 'typeorm';
import { Task } from './entities/tasks.entity';
import Redis from 'ioredis';
import { Octokit } from '@octokit/rest';
import { NotificationsService, NotificationType } from '@/notifications/notifications.service';
import { AiService } from '@/ai/ai.service';

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
    private readonly SCAN_LOCK_PREFIX = 'scan:lock:'; // Redis key for scan locks
    private isProcessing = false;


    constructor(
        @InjectRepository(RepoEntity)
        private readonly repoEntity: Repository<RepoEntity>,

        @InjectRepository(Task)
        private readonly taskRepo: Repository<Task>,

        @Inject('REDIS_CLIENT')
        private readonly redis: Redis,

        private readonly notificationsService: NotificationsService,
        
        private readonly aiService: AiService,
    ) {
        this.startWorker();
    }

    /**
     * Acquire scan lock (prevents duplicate scans)
     */
    private async acquireScanLock(repoId: string): Promise<boolean> {
        return await this.notificationsService.acquireLock(`scan:${repoId}`, 3600);
    }

    /**
     * Release scan lock
     */
    private async releaseScanLock(repoId: string): Promise<void> {
        await this.notificationsService.releaseLock(`scan:${repoId}`);
    }

    /**
     * Send scan notification to user
     */
    private async sendScanNotification(
        userId: string,
        type: NotificationType,
        title: string,
        message: string,
        repoId: string,
        data?: any
    ): Promise<void> {
        await this.notificationsService.emit(userId, {
            type,
            title,
            message,
            data: { repoId, ...data },
            timestamp: new Date(),
        });
    }

    /**
    *   Queue a repository scan (instant response)
    *  */
    async queueScan(repoId: string, userId: string, priority: number = 5): Promise<void> {
        // ✅ Check if scan is already in progress
        const canScan = await this.acquireScanLock(repoId);
        if (!canScan) {
            this.logger.warn(`⚠️  Scan already in progress for repo ${repoId}`);
            throw new Error('Scan already in progress for this repository');
        }

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

        // ✅ Send real-time notification
        await this.notificationsService.emit(userId, {
            type: NotificationType.SCAN_STARTED,
            title: 'Scan Queued',
            message: 'Repository scan has been queued and will start shortly',
            data: { repoId, status: 'queued' },
            timestamp: new Date(),
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

            // ✅ Send notification: scan started
            await this.sendScanNotification(
                userId,
                NotificationType.SCAN_STARTED,
                'Scan Started',
                'Repository scan has begun',
                repoId,
                { status: 'processing' }
            );

            // Check for cancellation
            if (await this.isCancelled(repoId)) {
                throw new Error('Scan cancelled by user');
            }


            // Step 1: Get Repository (10%)
            await this.updateProgress(repoId, 10);
            // Progress notification

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
            // Progress notification

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
                .slice(0, 100) // TODO: Limit to first 100 files for demo

            this.logger.log(`Processing ${relevantFiles.length} files for repo ${repoName}`);

            await this.sendScanNotification(
                userId,
                NotificationType.SCAN_PROGRESS,
                'Scanning Files',
                `Found ${relevantFiles.length} files to scan`,
                repoId,
                { progress: 40 }
            );

            // Step 4: Fetch File Contents (60%)
            await this.updateProgress(repoId, 60);
            // Progress notification

            const filesWithContent = await this.fetchFileContents(relevantFiles,
                owner, repoName, octokit, repoId
            );

            // Step 5: Extract Tasks (80%)
            await this.updateProgress(repoId, 80);
            // Progress notification

            const extractedTasks = await this.extractTasksFromFiles(filesWithContent);

            // Step 6: Save to database (90%)
            await this.updateProgress(repoId, 90);
            // Progress notification

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

            // ✅ Send completion notification
            await this.sendScanNotification(
                userId,
                NotificationType.SCAN_COMPLETED,
                'Scan Completed',
                `Found ${extractedTasks.length} tasks`,
                repoId,
                { tasksFound: extractedTasks.length }
            );

            // ✅ Release scan lock
            await this.releaseScanLock(repoId);

            this.logger.log(`Scan completed for repo ${repoId}. Found ${extractedTasks.length} tasks.`);

        } catch (err) {
            this.logger.error(`Scan failed for repo ${repoId}: ${err.message}`, err.message);

            await this.setStatus(repoId, {
                status: 'failed',
                progress: { current: 0, total: 0 },
                error: err.message,
                completedAt: Date.now(),
            });

            // ✅ Send failure notification
            await this.sendScanNotification(
                userId,
                NotificationType.SCAN_FAILED,
                'Scan Failed',
                err.message,
                repoId,
                { error: err.message }
            );

            // ✅ Release scan lock on failure too
            await this.releaseScanLock(repoId);
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
    private async extractTasksFromFiles(files: any[]) {
        const tasks: Array<{ 
            description: string; 
            type: string;
            priority: string;
            filePath: any; 
            lineNumber: number; 
            status: string;
            ai_summary?: string;
            debt_score?: number;
        }> = [];
        
        const taskPatterns = [
            { pattern: /\/\/\s*TODO:?\s*(.+)/gi, type: 'TODO', priority: 'medium' },
            { pattern: /\/\/\s*FIXME:?\s*(.+)/gi, type: 'FIXME', priority: 'high' },
            { pattern: /\/\/\s*HACK:?\s*(.+)/gi, type: 'HACK', priority: 'medium' },
            { pattern: /#\s*TODO:?\s*(.+)/gi, type: 'TODO', priority: 'medium' },
            { pattern: /#\s*FIXME:?\s*(.+)/gi, type: 'FIXME', priority: 'high' },
            { pattern: /\/\/\s*BUG:?\s*(.+)/gi, type: 'BUG', priority: 'high' },
            { pattern: /\/\/\s*NOTE:?\s*(.+)/gi, type: 'NOTE', priority: 'low' },
        ];

        for (const file of files) {
            const lines = file.content.split('\n');

            lines.forEach((line, index) => {
                for (const { pattern, type, priority } of taskPatterns) {
                    const matches = line.matchAll(pattern);
                    for (const match of matches) {
                        // Get surrounding code context (5 lines before and after)
                        const startLine = Math.max(0, index - 5);
                        const endLine = Math.min(lines.length, index + 6);
                        const surroundingCode = lines.slice(startLine, endLine).join('\n');

                        tasks.push({
                            description: match[1].trim(),
                            type,
                            priority,
                            filePath: file.path,
                            lineNumber: index + 1,
                            status: 'open',
                            surroundingCode, // Store temporarily for AI analysis
                        } as any);
                    }
                }
            })
        }

        // Perform AI analysis on all tasks
        if (tasks.length > 0 && this.aiService.isAvailable()) {
            this.logger.log(`🤖 Analyzing ${tasks.length} tasks with AI...`);
            
            try {
                const analyses = await this.aiService.analyzeTasks(
                    tasks.map(task => ({
                        description: task.description,
                        type: task.type,
                        filePath: task.filePath,
                        lineNumber: task.lineNumber,
                        surroundingCode: (task as any).surroundingCode,
                    }))
                );

                // Merge AI analysis results with tasks
                tasks.forEach((task, index) => {
                    task.ai_summary = analyses[index].summary;
                    task.debt_score = analyses[index].debtScore;
                    delete (task as any).surroundingCode; // Remove temporary field
                });

                this.logger.log(`✅ AI analysis completed for ${tasks.length} tasks`);
            } catch (error) {
                this.logger.error(`Failed to analyze tasks with AI: ${error.message}`);
                // Continue without AI analysis
                tasks.forEach(task => {
                    delete (task as any).surroundingCode;
                });
            }
        } else {
            // Remove temporary surroundingCode field if AI is not available
            tasks.forEach(task => {
                delete (task as any).surroundingCode;
            });
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




