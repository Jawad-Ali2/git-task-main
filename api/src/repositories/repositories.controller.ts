import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody, ApiParam, ApiCookieAuth } from '@nestjs/swagger';
import { RepositoriesService } from './repositories.service';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

@ApiTags('repositories')
@Controller('repositories')
export class RepositoriesController {
    constructor(private readonly reposService: RepositoriesService) { }

    @Get('list')
    @UseGuards(AuthGuard('jwt'))
    @ApiCookieAuth('access_token')
    @ApiOperation({ summary: 'List GitHub repositories for authenticated user' })
    @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
    @ApiQuery({ name: 'per_page', required: false, type: Number, description: 'Items per page' })
    @ApiQuery({ name: 'search', required: false, type: String, description: 'Search term' })
    @ApiResponse({ status: 200, description: 'Returns paginated list of repositories' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async listGithubRepos(
        @Req() req: Request,
        @Query('page') page?: string,
        @Query('per_page') perPage?: string,
        @Query('search') search?: string
    ) {
        const user = (req as any).user;
        const pageNum = page ? parseInt(page) : 1;
        const perPageNum = perPage ? parseInt(perPage) : 30;

        const result = await this.reposService.fetchGithubRepos(
            user.userId,
            pageNum,
            perPageNum,
            search
        );

        return result;
    }

    @Post('save')
    @UseGuards(AuthGuard('jwt'))
    @ApiCookieAuth('access_token')
    @ApiOperation({ summary: 'Save selected repositories to database' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                repositoryIds: {
                    type: 'array',
                    items: { type: 'string' },
                    example: ['123456789', '987654321'],
                    description: 'Array of GitHub repository IDs'
                }
            }
        }
    })
    @ApiResponse({ status: 200, description: 'Repositories saved successfully' })
    @ApiResponse({ status: 400, description: 'Repository limit exceeded or invalid IDs' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async saveSelectedRepos(
        @Req() req: Request,
        @Body() body: { repositoryIds: string[] }
    ) {
        const user = (req as any).user;
        const { repositoryIds } = body;

        const currentCount = await this.reposService.countMonitoredRepos(user.userId);
        const limit = 20; //! CHANGE
        const availableSlots = limit - currentCount;

        if (availableSlots <= 0) {
            throw new BadRequestException(
                `You've reached the maximum limit of ${limit} monitored repositories. Please remove some before adding new ones.`
            );
        }

            if (!repositoryIds || !Array.isArray(repositoryIds)) {
                return { error: 'Invalid repository IDs' };
            }
        if (repositoryIds.length > availableSlots) {
            throw new BadRequestException(
                `You can only add ${availableSlots} more repositories. Current: ${currentCount}/${limit}`
            );
        }


        const savedRepos = await this.reposService.saveSelectedRepos(user.userId, repositoryIds);

        // Return saved repositories with metadata for scan notifications
        return {
            message: 'Repositories saved successfully',
            count: savedRepos.length,
            repositories: savedRepos.map(repo => ({
                id: repo.id,
                githubId: repo.githubId,
                name: repo.name,
                fullName: repo.name, // You might want to add fullName to the entity
                needsScan: true,
            })),
        };
    }

    @Get()
    @UseGuards(AuthGuard('jwt'))
    @ApiCookieAuth('access_token')
    @ApiOperation({ summary: 'Get all saved repositories' })
    @ApiResponse({ status: 200, description: 'Returns list of saved repositories' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async getSavedRepos(@Req() req: Request) {
        const user = (req as any).user;
        const repos = await this.reposService.getSavedRepos(user.userId);
        return repos;
    }

    @Get(':repoId')
    @UseGuards(AuthGuard('jwt'))
    @ApiCookieAuth('access_token')
    @ApiOperation({ summary: 'Get a single repository by ID' })
    @ApiParam({ name: 'repoId', description: 'Repository UUID' })
    @ApiResponse({ status: 200, description: 'Returns repository details' })
    @ApiResponse({ status: 404, description: 'Repository not found' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async getRepository(@Req() req: Request, @Param('repoId') repoId: string) {
        const user = (req as any).user;
        const repo = await this.reposService.getRepositoryById(user.userId, repoId);
        return repo;
    }

    @Delete(':repoId')
    @UseGuards(AuthGuard('jwt'))
    @ApiCookieAuth('access_token')
    @ApiOperation({ summary: 'Delete a repository by ID' })
    @ApiParam({ name: 'repoId', description: 'Repository UUID' })
    @ApiResponse({ status: 200, description: 'Repository removed successfully' })
    @ApiResponse({ status: 404, description: 'Repository not found' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async deleteRepository(@Req() req: Request, @Param('repoId') repoId: string) {
        const user = (req as any).user;
        await this.reposService.deleteRepository(user.userId, repoId);
        return { message: 'Repository removed successfully' };
    }

}
