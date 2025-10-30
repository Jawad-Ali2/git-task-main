import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
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
    async getSavedRepos(@Req() req: Request) {
        const user = (req as any).user;
        const repos = await this.reposService.getSavedRepos(user.userId);
        return repos;
    }

    @Delete(':repoId')
    @UseGuards(AuthGuard('jwt'))
    async deleteRepository(@Req() req: Request, @Param('repoId') repoId: string) {
        const user = (req as any).user;
        await this.reposService.deleteRepository(user.userId, repoId);
        return { message: 'Repository removed successfully' };
    }

}
