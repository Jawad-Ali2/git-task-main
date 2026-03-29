import { Inject, Injectable, Logger, forwardRef, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as RepoEntity } from '../repositories/entities/repository.entity';
import { Repository, DataSource } from 'typeorm';
import { Task } from './entities/tasks.entity';
import Redis from 'ioredis';
import { Octokit } from '@octokit/rest';
import { NotificationsService, NotificationType } from '@/notifications/notifications.service';
import { AiService } from '@/ai/ai.service';
import type { IntegrationsService } from '@/integrations/services/integrations.service';

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

    // Security constants
    private readonly MAX_COMMITS_PER_PUSH = 50;
    private readonly MAX_FILES_PER_COMMIT = 100;
    private readonly MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
    private readonly MAX_STRING_LENGTH = 1000;
    private readonly MAX_DESCRIPTION_LENGTH = 500;
    private readonly MAX_USERNAME_LENGTH = 100;
    private readonly FUZZY_MATCH_THRESHOLD = 0.8;


    constructor(
        @InjectRepository(RepoEntity)
        private readonly repoEntity: Repository<RepoEntity>,

        @InjectRepository(Task)
        private readonly taskRepo: Repository<Task>,

        @Inject('REDIS_CLIENT')
        private readonly redis: Redis,

        private readonly notificationsService: NotificationsService,
        
        private readonly aiService: AiService,

        private readonly dataSource: DataSource,

        @Optional()
        @Inject(forwardRef(() => 'IntegrationsService'))
        private readonly integrationsService?: IntegrationsService,
    ) {
        this.startWorker();
    }

    /**
     * Delete all tasks associated with a repository
     */
    async deleteTasksByRepository(repoId: string): Promise<void> {
        await this.taskRepo.delete({ repository: { id: repoId } });
        this.logger.log(`Deleted all tasks for repository ${repoId}`);
    }

    /**
     * Auto-sync newly created task to Trello if integration is enabled
     */
    private async autoSyncTaskToTrello(task: Task): Promise<void> {
        if (!this.integrationsService) {
            return; // Integration service not available (avoid circular dependency issues)
        }

        try {
            // Call the integration service to sync the task
            await this.integrationsService.autoSyncNewTask(task.id, task.repository.user?.id);
            this.logger.log(`✨ Auto-synced new task ${task.id} to Trello`);
        } catch (error) {
            this.logger.warn(`Failed to auto-sync task to Trello: ${error.message}`);
            // Don't throw - auto-sync is best-effort
        }
    }

    // ==================== Security & Validation Helpers ====================

    /**
     * Sanitize string by removing control characters and limiting length
     */
    private sanitizeString(str: string | undefined | null, maxLength: number): string {
        if (!str) return '';
        // Remove null bytes, control characters (except newlines/tabs for descriptions)
        const cleaned = str.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
        return cleaned.trim().substring(0, maxLength);
    }

    /**
     * Redact sensitive patterns from strings before logging
     */
    private redactSensitive(text: string): string {
        if (!text) return '';
        return text
            .replace(/[A-Za-z0-9_-]{32,}/g, '***') // API keys, tokens
            .replace(/password[s]?[:\s=]+[^\s]+/gi, 'password=***')
            .replace(/token[s]?[:\s=]+[^\s]+/gi, 'token=***')
            .replace(/secret[s]?[:\s=]+[^\s]+/gi, 'secret=***')
            .replace(/key[s]?[:\s=]+[^\s]+/gi, 'key=***');
    }

    /**
     * Validate commit SHA format
     */
    private validateSHA(sha: string): string {
        if (!sha || !/^[a-f0-9]{40}$/i.test(sha)) {
            throw new Error('Invalid commit SHA format');
        }
        return sha;
    }

    /**
     * Validate timestamp and convert to Date
     */
    private validateTimestamp(timestamp: string): Date {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            throw new Error('Invalid timestamp format');
        }
        // Reject timestamps too far in the past or future
        const now = Date.now();
        const year = 365 * 24 * 60 * 60 * 1000;
        if (date.getTime() < now - 10 * year || date.getTime() > now + year) {
            throw new Error('Timestamp out of reasonable range');
        }
        return date;
    }

    /**
     * Validate line number
     */
    private validateLineNumber(line: number): number {
        if (!Number.isInteger(line) || line < 0 || line > 1_000_000) {
            throw new Error(`Invalid line number: ${line}`);
        }
        return line;
    }

    /**
     * Sanitize file path
     */
    private sanitizePath(path: string, maxLength: number): string {
        if (!path) return '';
        // Remove null bytes and excessive slashes
        const cleaned = path
            .replace(/\x00/g, '')
            .replace(/\/+/g, '/')
            .trim();
        return cleaned.substring(0, maxLength);
    }

    /**
     * Sanitize and validate commit data from webhook
     */
    private sanitizeCommitData(commit: any): {
        id: string;
        message: string;
        author: { name: string; username: string };
        timestamp: string;
    } {
        if (!commit) {
            throw new Error('Commit data is null or undefined');
        }

        return {
            id: this.validateSHA(commit.id),
            message: this.sanitizeString(commit.message, this.MAX_STRING_LENGTH),
            author: {
                name: this.sanitizeString(
                    commit.author?.name || 'Unknown',
                    this.MAX_USERNAME_LENGTH
                ),
                username: this.sanitizeString(
                    commit.author?.username || 
                    commit.committer?.username || 
                    commit.author?.name || 
                    'unknown',
                    this.MAX_USERNAME_LENGTH
                ),
            },
            timestamp: commit.timestamp, // Keep as string for now, validate when converting to Date
        };
    }

    // ==================== End Security Helpers ====================

    /**
     * Compute similarity between two normalized strings based on Levenshtein distance.
     * Returns value between 0 and 1 (1 = identical)
     */
    private similarity(a: string, b: string): number {
        if (!a && !b) return 1;
        if (!a || !b) return 0;
        const dist = this.levenshtein(a, b);
        const maxLen = Math.max(a.length, b.length);
        if (maxLen === 0) return 1;
        return 1 - dist / maxLen;
    }

    /**
     * Levenshtein distance implementation with performance optimization
     */
    private levenshtein(a: string, b: string): number {
        // Early exit for identical strings
        if (a === b) return 0;
        
        // Limit string length for performance (O(n*m) complexity)
        const MAX_COMPARE_LENGTH = 500;
        const a_trimmed = a.substring(0, MAX_COMPARE_LENGTH);
        const b_trimmed = b.substring(0, MAX_COMPARE_LENGTH);
        
        // Early exit if length difference is too large (not similar)
        const lengthDiff = Math.abs(a_trimmed.length - b_trimmed.length);
        if (lengthDiff > a_trimmed.length * 0.5) {
            return Math.max(a_trimmed.length, b_trimmed.length); // Max possible distance
        }

        const alen = a_trimmed.length;
        const blen = b_trimmed.length;
        const dp: number[][] = Array.from({ length: alen + 1 }, () => Array(blen + 1).fill(0));
        for (let i = 0; i <= alen; i++) dp[i][0] = i;
        for (let j = 0; j <= blen; j++) dp[0][j] = j;
        for (let i = 1; i <= alen; i++) {
            for (let j = 1; j <= blen; j++) {
                const cost = a_trimmed[i - 1] === b_trimmed[j - 1] ? 0 : 1;
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1,
                    dp[i][j - 1] + 1,
                    dp[i - 1][j - 1] + cost
                );
            }
        }
        return dp[alen][blen];
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
                        addedBy: repo.user?.name || owner,
                        addedAt: new Date(),
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
     * Normalize task descriptions for more robust matching
     * - lowercase
     * - collapse whitespace
     * - remove punctuation
     */
    private normalizeDescription(desc: string): string {
        if (!desc) return '';
        // Remove punctuation, collapse whitespace, lowercase
        return desc
            .replace(/[\p{P}$+<=>^`|~]/gu, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
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
    private async extractTasksFromFiles(files: any[], skipAI: boolean = false) {
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
                            codeSnippet: surroundingCode, // Persisted to DB
                            surroundingCode, // Store temporarily for AI analysis
                        } as any);
                    }
                }
            })
        }

        // Perform AI analysis on all tasks (unless skipAI is true)
        if (!skipAI && tasks.length > 0 && this.aiService.isAvailable()) {
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
        } else if (!skipAI) {
            // Remove temporary surroundingCode field if AI is not available (but only if not skipping)
            tasks.forEach(task => {
                delete (task as any).surroundingCode;
            });
        }
        // If skipAI is true, keep surroundingCode for later analysis

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

    /**
     * Incremental scan: analyze specific commits instead of full repository
     * Detects completed tasks, new tasks, and modified tasks
     */
    async scanCommits(
        repoId: string, 
        userId: string, 
        commits: Array<{ id: string; message: string; author: { name: string; username?: string }; timestamp: string }>,
        repoFullName: string
    ): Promise<{ 
        completed: number; 
        added: number; 
        modified: number; 
        details: any 
    }> {
        // ✅ Security: Sanitize and limit commits
        const sanitizedCommits = commits
            .slice(0, this.MAX_COMMITS_PER_PUSH)
            .map(c => this.sanitizeCommitData(c));

        if (commits.length > this.MAX_COMMITS_PER_PUSH) {
            this.logger.warn(
                `⚠️ Truncated ${commits.length} commits to ${this.MAX_COMMITS_PER_PUSH} for ${repoFullName}`
            );
        }

        this.logger.log(
            `🔄 Starting incremental scan for ${sanitizedCommits.length} commits in ${repoFullName}`
        );

        // ✅ Security: Acquire distributed lock to prevent race conditions
        const lockKey = `commit-scan:${repoId}`;
        const lockAcquired = await this.redis.set(lockKey, '1', 'EX', 300, 'NX');
        
        if (!lockAcquired) {
            this.logger.warn(`Repository ${repoId} is already being scanned, skipping`);
            return { 
                completed: 0, 
                added: 0, 
                modified: 0, 
                details: { skipped: true, reason: 'Scan already in progress' } 
            };
        }

        try {
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
            const [owner, repoName] = repoFullName.split('/');

            let completedCount = 0;
            let addedCount = 0;
            let modifiedCount = 0;
            const details: any = {
                completed: [],
                added: [],
                modified: []
            };

            // Process each commit
            for (const commit of sanitizedCommits) {
                try {
                    this.logger.log(
                        `Processing commit ${commit.id.substring(0, 7)} by ${this.redactSensitive(commit.author.name)}`
                    );

                    // Get commit details with file changes
                    const { data: commitData } = await octokit.repos.getCommit({
                        owner,
                        repo: repoName,
                        ref: commit.id,
                    });

                    // ✅ Security: Limit files per commit
                    const allFiles = commitData.files || [];
                    const relevantFiles = allFiles
                        .filter(file => this.shouldProcessFile(file.filename))
                        .filter(file => file.status === 'modified' || file.status === 'added' || file.status === 'removed')
                        .slice(0, this.MAX_FILES_PER_COMMIT);

                    if (allFiles.length > this.MAX_FILES_PER_COMMIT) {
                        this.logger.warn(
                            `⚠️ Truncated ${allFiles.length} files to ${this.MAX_FILES_PER_COMMIT} in commit ${commit.id.substring(0, 7)}`
                        );
                    }

                    this.logger.log(`Found ${relevantFiles.length} relevant files in commit ${commit.id.substring(0, 7)}`);

                    for (const file of relevantFiles) {
                        const filePath = this.sanitizePath(file.filename, this.MAX_STRING_LENGTH);

                        // Get existing tasks for this file
                        const existingTasks = await this.taskRepo.find({
                            where: { 
                                repository: { id: repoId },
                            filePath: filePath 
                        }
                    });

                    if (file.status === 'removed') {
                        // File was deleted - mark all tasks as completed
                        for (const task of existingTasks) {
                            task.status = 'done';
                            task.completedBy = commit.author.username || commit.author.name;
                            task.completedAt = new Date(commit.timestamp);
                            task.completedInCommit = commit.id;
                            await this.taskRepo.save(task);
                            completedCount++;
                            details.completed.push({
                                task: task.description,
                                file: filePath,
                                completedBy: task.completedBy,
                                commit: commit.id.substring(0, 7)
                            });
                        }
                        continue;
                    }

                    // Get current file content
                    let currentContent = '';
                    try {
                        const { data: fileData } = await octokit.repos.getContent({
                            owner,
                            repo: repoName,
                            path: filePath,
                            ref: commit.id,
                        });

                        if ('content' in fileData && fileData.content) {
                            // ✅ Security: Check file size before decoding
                            const contentSize = Buffer.from(fileData.content, 'base64').length;
                            
                            if (contentSize > this.MAX_FILE_SIZE_BYTES) {
                                this.logger.warn(
                                    `File ${filePath} exceeds size limit (${contentSize} bytes), skipping`
                                );
                                continue;
                            }
                            
                            currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
                        }
                    } catch (error) {
                        this.logger.warn(`Could not fetch content for ${filePath}: ${error.message}`);
                        continue;
                    }

                    // Extract tasks from current content (WITHOUT AI analysis for now)
                    const currentTasks = await this.extractTasksFromFiles([{
                        path: filePath,
                        content: currentContent
                    }], true); // ✅ Skip AI analysis initially (analyze only NEW tasks later)
                    // Reconcile tasks for this file (new method)
                    const fileResult = await this.reconcileFileTasks(filePath, existingTasks, currentTasks, commit, repo);
                    completedCount += fileResult.completed;
                    addedCount += fileResult.added;
                    modifiedCount += fileResult.modified;
                    details.completed.push(...fileResult.details.completed);
                    details.added.push(...fileResult.details.added);
                    details.modified.push(...fileResult.details.modified);
                }
            } catch (error) {
                this.logger.error(
                    `Error processing commit ${commit.id.substring(0, 7)}: ${error.message}`,
                    {
                        commit: commit.id,
                        repository: repoId,
                        error: error.stack,
                    }
                );
            }
        }

        // Send notification about changes
        await this.sendScanNotification(
            userId,
            NotificationType.SCAN_COMPLETED,
            'Commit Scan Completed',
            `${completedCount} completed, ${addedCount} added, ${modifiedCount} modified`,
            repoId,
            { completed: completedCount, added: addedCount, modified: modifiedCount, details }
        );

        this.logger.log(
            `✨ Incremental scan complete: ${completedCount} completed, ${addedCount} added, ${modifiedCount} modified`
        );

        return { completed: completedCount, added: addedCount, modified: modifiedCount, details };
        } finally {
            // ✅ Security: Always release lock
            await this.redis.del(lockKey);
        }
    }

    /**
     * Reconcile tasks for a single file given existing DB tasks and current file-extracted tasks
     * Uses transaction to ensure data consistency
     */
    private async reconcileFileTasks(
        filePath: string,
        existingTasks: Task[],
        currentTasks: Array<{ description: string; type: string; priority: string; filePath: string; lineNumber: number; status: string; surroundingCode?: string }>,
        commit: { id: string; message: string; author: { name: string; username?: string }; timestamp: string },
        repo: any
    ) {
        // ✅ Track truly new tasks for AI analysis
        const tasksNeedingAI: Task[] = [];
        
        // ✅ Security: Use transaction for atomic updates
        const result = await this.dataSource.transaction(async (manager) => {
            const taskRepo = manager.getRepository(Task);
            
            let completed = 0;
            let added = 0;
            let modified = 0;
            const details: any = { completed: [], added: [], modified: [] };

            // Build maps
            const existingTaskMap = new Map(
                existingTasks.map(task => [
                    `${task.filePath}:${task.lineNumber}:${task.type}:${this.normalizeDescription(task.description)}`,
                    task
                ])
            );

            const existingByDescType = new Map<string, Task[]>();
            for (const t of existingTasks) {
                const key = `${this.normalizeDescription(t.description)}||${t.type}`;
                if (!existingByDescType.has(key)) existingByDescType.set(key, []);
                existingByDescType.get(key)!.push(t);
            }

            const matchedExistingIds = new Set<string>();
            
            // Line shift tolerance: tasks can match if they're within ±5 lines of old position
            const LINE_SHIFT_TOLERANCE = 5;

        for (const currentTask of currentTasks) {
            const identifier = `${currentTask.filePath}:${currentTask.lineNumber}:${currentTask.type}:${this.normalizeDescription(currentTask.description)}`;
            const exactMatch = existingTaskMap.get(identifier);

            if (exactMatch) {
                matchedExistingIds.add(exactMatch.id);
                continue;
            }

            const descKey = `${this.normalizeDescription(currentTask.description)}||${currentTask.type}`;
            const candidates = existingByDescType.get(descKey) || [];

            let chosen: Task | undefined = candidates.find(c => c.filePath === filePath && !matchedExistingIds.has(c.id));
            
            // ✅ FIX: When no exact file match, prefer tasks with line numbers close to current position
            // This prevents line shifts from being incorrectly matched
            if (!chosen) {
                const candidatesInRange = candidates.filter(
                    c => !matchedExistingIds.has(c.id) && 
                         Math.abs(c.lineNumber - currentTask.lineNumber) <= LINE_SHIFT_TOLERANCE
                );
                if (candidatesInRange.length > 0) {
                    // Pick the one with the closest line number
                    chosen = candidatesInRange.reduce((closest, c) => 
                        Math.abs(c.lineNumber - currentTask.lineNumber) < Math.abs(closest.lineNumber - currentTask.lineNumber) 
                            ? c 
                            : closest
                    );
                }
            }
            
            if (!chosen) chosen = candidates.find(c => !matchedExistingIds.has(c.id));

            if (!chosen && candidates.length > 0) {
                let best: { candidate: Task; score: number } | null = null;
                const normCurrent = this.normalizeDescription(currentTask.description);
                for (const c of candidates) {
                    if (matchedExistingIds.has(c.id)) continue;
                    const normCandidate = this.normalizeDescription(c.description);
                    const score = this.similarity(normCurrent, normCandidate);
                    
                    // ✅ FIX: Only fuzzy match if line numbers are reasonably close
                    // This prevents matching tasks that just happened to be on nearby lines
                    const isLineClose = Math.abs(c.lineNumber - currentTask.lineNumber) <= LINE_SHIFT_TOLERANCE;
                    const adjustedScore = isLineClose ? score : score * 0.5; // Penalize distant line matches
                    
                    if (!best || adjustedScore > best.score) {
                        best = { candidate: c, score: adjustedScore };
                    }
                }
                if (best && best.score >= this.FUZZY_MATCH_THRESHOLD) {
                    chosen = best.candidate;
                    this.logger.log(
                        `🔎 Fuzzy matched task "${this.redactSensitive(currentTask.description)}" -> ` +
                        `"${this.redactSensitive(chosen.description)}" (score=${best.score.toFixed(2)}, ` +
                        `line ${chosen.lineNumber} → ${currentTask.lineNumber})`
                    );
                }
            }

            if (chosen) {
                const oldLine = chosen.lineNumber;
                // ✅ Security: Validate line number
                chosen.lineNumber = this.validateLineNumber(currentTask.lineNumber);
                chosen.lastModifiedBy = this.sanitizeString(
                    commit.author.username || commit.author.name,
                    this.MAX_USERNAME_LENGTH
                );
                chosen.lastModifiedAt = this.validateTimestamp(commit.timestamp);
                chosen.lastModifiedInCommit = commit.id;
                await taskRepo.save(chosen);
                modified++;
                matchedExistingIds.add(chosen.id);
                details.modified.push({
                    task: this.sanitizeString(currentTask.description, this.MAX_DESCRIPTION_LENGTH),
                    file: filePath,
                    oldLine,
                    newLine: currentTask.lineNumber,
                    modifiedBy: chosen.lastModifiedBy,
                    commit: commit.id.substring(0, 7)
                });
                this.logger.log(
                    `📝 Task moved/updated: ${this.redactSensitive(currentTask.description)} ` +
                    `(line ${oldLine} → ${currentTask.lineNumber})`
                );
                continue;
            }

            // ✅ Security: Validate and sanitize all task data before creating
            const newTask = taskRepo.create({
                description: this.sanitizeString(currentTask.description, this.MAX_DESCRIPTION_LENGTH),
                type: currentTask.type,
                priority: currentTask.priority,
                filePath: this.sanitizePath(currentTask.filePath, this.MAX_STRING_LENGTH),
                lineNumber: this.validateLineNumber(currentTask.lineNumber),
                status: currentTask.status,
                repository: repo,
                codeSnippet: currentTask.surroundingCode || undefined,
                addedBy: this.sanitizeString(
                    commit.author.username || commit.author.name,
                    this.MAX_USERNAME_LENGTH
                ),
                addedAt: this.validateTimestamp(commit.timestamp),
                addedInCommit: commit.id,
            });
            const savedTask: Task = await taskRepo.save(newTask);
            
            // ✅ Auto-sync to Trello if enabled (async, non-blocking)
            this.autoSyncTaskToTrello(savedTask).catch(err => {
                this.logger.warn(`Auto-sync failed for task ${savedTask.id}: ${err.message}`);
            });
            
            // ✅ Track for AI analysis (store surrounding code temporarily)
            (savedTask as any).surroundingCode = currentTask.surroundingCode;
            tasksNeedingAI.push(savedTask);
            
            added++;
            details.added.push({
                task: newTask.description,
                file: filePath,
                line: currentTask.lineNumber,
                addedBy: newTask.addedBy,
                commit: commit.id.substring(0, 7)
            });
            this.logger.log(
                `➕ New task added: ${this.redactSensitive(currentTask.description)} ` +
                `(line ${currentTask.lineNumber})`
            );
        }

        for (const task of existingTasks) {
            if (!matchedExistingIds.has(task.id)) {
                task.status = 'done';
                task.completedBy = this.sanitizeString(
                    commit.author.username || commit.author.name,
                    this.MAX_USERNAME_LENGTH
                );
                task.completedAt = this.validateTimestamp(commit.timestamp);
                task.completedInCommit = commit.id;
                await taskRepo.save(task);
                completed++;
                details.completed.push({
                    task: this.sanitizeString(task.description, this.MAX_DESCRIPTION_LENGTH),
                    file: filePath,
                    line: task.lineNumber,
                    completedBy: task.completedBy,
                    commit: commit.id.substring(0, 7)
                });
                this.logger.log(
                    `✅ Task completed: ${this.redactSensitive(task.description)} ` +
                    `(line ${task.lineNumber})`
                );
            }
        }

            return { completed, added, modified, details };
        });

        // ✅ AI Analysis: Only analyze truly NEW tasks (not line-shifted ones)
        if (tasksNeedingAI.length > 0 && this.aiService.isAvailable()) {
            this.logger.log(`🤖 Analyzing ${tasksNeedingAI.length} NEW tasks with AI...`);
            
            try {
                const analyses = await this.aiService.analyzeTasks(
                    tasksNeedingAI.map(task => ({
                        description: task.description,
                        type: task.type,
                        filePath: task.filePath,
                        lineNumber: task.lineNumber,
                        surroundingCode: (task as any).surroundingCode,
                    }))
                );

                // Update tasks with AI analysis results
                for (let i = 0; i < tasksNeedingAI.length; i++) {
                    tasksNeedingAI[i].ai_summary = analyses[i].summary;
                    tasksNeedingAI[i].debt_score = analyses[i].debtScore;
                    delete (tasksNeedingAI[i] as any).surroundingCode;
                }

                // Save AI results to database
                await this.taskRepo.save(tasksNeedingAI);
                this.logger.log(`✅ AI analysis completed for ${tasksNeedingAI.length} NEW tasks`);
            } catch (error) {
                this.logger.error(`Failed to analyze new tasks with AI: ${error.message}`);
                // Clean up temporary field
                tasksNeedingAI.forEach(task => {
                    delete (task as any).surroundingCode;
                });
            }
        }

        return result;
    }

    async onModuleDestroy() {
        this.isProcessing = false;
        this.logger.log('Worker stopped');
    }

}




