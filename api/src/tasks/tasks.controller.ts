import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiCookieAuth } from '@nestjs/swagger';
import { TasksService, ScanStatus } from './tasks.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Task } from './entities/tasks.entity';
import { Repository } from 'typeorm';
import { Request } from 'express';

@ApiTags('tasks')
@Controller('tasks')
@UseGuards(AuthGuard('jwt'))
@ApiCookieAuth('access_token')
export class TasksController {

    constructor(
        private readonly tasksService: TasksService,
        @InjectRepository(Task)
        private readonly taskRepo: Repository<Task>,
    ) { }


    /**
     * Trigger scan (instant response)
     */

    @Post('scan/:repoId')
    @ApiOperation({ summary: 'Queue a repository scan' })
    @ApiParam({ name: 'repoId', description: 'Repository UUID' })
    @ApiResponse({ status: 200, description: 'Scan queued successfully' })
    @ApiResponse({ status: 400, description: 'Scan already in progress' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async scanRepository(@Param('repoId') repoId: string, @Req() req: Request) {
        const user = (req as any).user;

        await this.tasksService.queueScan(repoId, user.userId);

        return {
            message: 'Scan queued successfully',
            repoId,
            status: 'queued',
        }
    }

    /**
     * Check scan status
     */
    @Get('scan/:repoId/status')
    @ApiOperation({ summary: 'Get scan status for a repository' })
    @ApiParam({ name: 'repoId', description: 'Repository UUID' })
    @ApiResponse({ status: 200, description: 'Returns scan status' })
    async getScanStatus(@Param('repoId') repoId: string): Promise<ScanStatus | { message: string; status: null }> {
        const status = await this.tasksService.getScanStatus(repoId);

        if (!status) {
            return { message: 'No scan found', status: null }
        }

        return status;
    }

    /**
     * Cancel ongoing scan
     */
    @Post('scan/:repoId/cancel')
    @ApiOperation({ summary: 'Cancel an ongoing scan' })
    @ApiParam({ name: 'repoId', description: 'Repository UUID' })
    @ApiResponse({ status: 200, description: 'Scan cancellation requested' })
    async cancelScan(@Param('repoId') repoId: string): Promise<{ message: string }> {
        await this.tasksService.cancelScan(repoId);

        return { message: 'Scan cancellation requested' };
    }

    /**
     * Get tasks for a repository
     */
    @Get('repository/:repoId')
    @ApiOperation({ summary: 'Get all tasks for a specific repository' })
    @ApiParam({ name: 'repoId', description: 'Repository UUID' })
    @ApiResponse({ status: 200, description: 'Returns list of tasks' })
    async getRepositoryTasks(@Param('repoId') repoId: string): Promise<Task[]> {
        const tasks = await this.taskRepo.find({
            where: { repository: { id: repoId } },
            relations: ['repository'],
            order: { filePath: 'ASC', lineNumber: 'ASC' },
        })

        return tasks;
    }


    /**
     * Get all tasks for user
     */
    @Get()
    @ApiOperation({ summary: 'Get all tasks for authenticated user' })
    @ApiResponse({ status: 200, description: 'Returns all user tasks' })
    async getAllUserTasks(@Req() req: Request): Promise<Task[]> {
        const user = (req as any).user;

        return await this.taskRepo
            .createQueryBuilder('task')
            .leftJoinAndSelect('task.repository', 'repository')
            .where('repository.userId = :userId', { userId: user.userId }) // Change this line
            .orderBy('repository.name', 'ASC')
            .addOrderBy('task.filePath', 'ASC')
            .getMany();
    }

    /**
     * Update task status
     */
    @Patch(':taskId/status')
    @ApiOperation({ summary: 'Update task status' })
    @ApiParam({ name: 'taskId', description: 'Task UUID' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                status: {
                    type: 'string',
                    enum: ['pending', 'in-progress', 'completed'],
                    example: 'in-progress'
                }
            }
        }
    })
    @ApiResponse({ status: 200, description: 'Task status updated' })
    async updateTaskStatus(
        @Param('taskId') taskId: string,
        @Body() body: { status: 'pending' | 'in-progress' | 'completed' }
    ): Promise<Task> {
        const task = await this.taskRepo.findOne({ where: { id: taskId } });

        if (!task) {
            throw new Error('Task not found');
        }

        task.status = body.status;
        return await this.taskRepo.save(task);
    }

    /**
     * Update task priority
     */
    @Patch(':taskId/priority')
    @ApiOperation({ summary: 'Update task priority' })
    @ApiParam({ name: 'taskId', description: 'Task UUID' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                priority: {
                    type: 'string',
                    enum: ['low', 'medium', 'high'],
                    example: 'high'
                }
            }
        }
    })
    @ApiResponse({ status: 200, description: 'Task priority updated' })
    async updateTaskPriority(
        @Param('taskId') taskId: string,
        @Body() body: { priority: 'low' | 'medium' | 'high' }
    ): Promise<Task> {
        const task = await this.taskRepo.findOne({ where: { id: taskId } });

        if (!task) {
            throw new Error('Task not found');
        }

        task.priority = body.priority;
        return await this.taskRepo.save(task);
    }

    /**
     * Get task statistics for user
     */
    @Get('stats')
    @ApiOperation({ summary: 'Get task statistics for authenticated user' })
    @ApiResponse({ status: 200, description: 'Returns task statistics' })
    async getTaskStats(@Req() req: Request) {
        const user = (req as any).user;

        const tasks = await this.taskRepo
            .createQueryBuilder('task')
            .leftJoinAndSelect('task.repository', 'repository')
            .where('repository.userId = :userId', { userId: user.userId })
            .getMany();

        const stats = {
            total: tasks.length,
            byStatus: {
                pending: tasks.filter(t => t.status === 'pending').length,
                'in-progress': tasks.filter(t => t.status === 'in-progress').length,
                completed: tasks.filter(t => t.status === 'completed').length,
            },
            byType: tasks.reduce((acc, task) => {
                acc[task.type] = (acc[task.type] || 0) + 1;
                return acc;
            }, {} as Record<string, number>),
            byPriority: {
                high: tasks.filter(t => t.priority === 'high').length,
                medium: tasks.filter(t => t.priority === 'medium').length,
                low: tasks.filter(t => t.priority === 'low').length,
            },
        };

        return stats;
    }

}
