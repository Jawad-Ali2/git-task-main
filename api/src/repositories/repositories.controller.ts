import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { RepositoriesService } from './repositories.service';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

@Controller('repositories')
export class RepositoriesController {
    constructor(private readonly reposService: RepositoriesService) { }

    @Get('list')
    @UseGuards(AuthGuard('jwt'))
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
    async saveSelectedRepos(
        @Req() req: Request,
        @Body() body: { repositoryIds: string[] }
    ) {
        const user = (req as any).user;
        const { repositoryIds } = body;

        if (!repositoryIds || !Array.isArray(repositoryIds)) {
            return { error: 'Invalid repository IDs' };
        }

        await this.reposService.saveSelectedRepos(user.userId, repositoryIds);

        return { message: 'Repositories saved successfully', count: repositoryIds.length };
    }

    @Get()
    @UseGuards(AuthGuard('jwt'))
    async getSavedRepos(@Req() req: Request) {
        const user = (req as any).user;
        const repos = await this.reposService.getSavedRepos(user.userId);
        return repos;
    }
}
