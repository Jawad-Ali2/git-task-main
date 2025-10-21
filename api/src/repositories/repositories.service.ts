import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import { Repository as RepoEntity } from './entities/repository.entity';
import { Octokit } from '@octokit/rest';

@Injectable()
export class RepositoriesService {
    constructor(
        @InjectRepository(User)
        private readonly user: Repository<User>,

        @InjectRepository(RepoEntity)
        private readonly repoEntity: Repository<RepoEntity>,
    ) { }


    async fetchAndStoreUserRepos(userId: string) {
        const user = await this.user.findOne({ where: { id: userId } });

        if (!user || !user.accessToken) {
            throw new UnauthorizedException('User not found or missing token!');
        }

        const octokit = new Octokit({ auth: user.accessToken });

        const repos = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
            per_page: 20
        });


        for (const repo of repos) {
            const exists = await this.repoEntity.findOne({
                where: { githubId: repo.id.toString(), user: { id: user.id } }
            })

            if (!exists) {

                const newRepo = await this.repoEntity.create({
                    githubId: repo.id.toString(),
                    name: repo.name,
                    url: repo.html_url,
                    private: repo.private,
                    user,
                });
                await this.repoEntity.save(newRepo);
            }
        }

        return repos.map(r => ({
            name: r.name,
            url: r.html_url,
            private: r.private
        }));
    }

    getUserRepos(userId: any) {
        return this.repoEntity.find({ where: { user: { id: userId } } });
    }
}
