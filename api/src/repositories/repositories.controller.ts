import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { RepositoriesService } from './repositories.service';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

@Controller('repositories')
export class RepositoriesController {
    constructor(private readonly reposService: RepositoriesService) { }


    @Get('sync')
    @UseGuards(AuthGuard('jwt'))
    async syncRepos(@Req() req: Request) {
        const user = (req as any).user;

        console.log(user);
        const repos = await this.reposService.fetchAndStoreUserRepos(user.userId);

        return { message: 'Repositories synced', repos };
    }

    @Get()
    @UseGuards(AuthGuard('jwt'))
    async getRepos(@Req() req: Request){
        const user = (req as any).user;

        const repos = await this.reposService.getUserRepos(user.userId);

        return repos;
    }


}
