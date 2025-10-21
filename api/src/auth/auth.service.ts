import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly jwtService: JwtService
    ) { }

    async validateOAuthLogin(profile: any, accessToken: string) {
        // profile fields: profile.id, profile.username, profile.emails, profile.displayName
        const githubId = profile.id?.toString();
        const email = (profile.emails && profile.emails[0] && profile.emails[0].value) || null;
        let user = await this.userRepo.findOne({ where: [{ githubId }, { email }] })

        if (!user) {
            user = this.userRepo.create({
                githubId,
                name: profile.username,
                email: email || `${profile.username}@github.com`,
                accessToken,
            });
        }else{
            user.accessToken = accessToken;
            user.name = user.name || profile.displayName || profile.username;
        }

        await this.userRepo.save(user);

        const payload = {sub: user.id, githubId: user.githubId, email: user.email};
        const token = this.jwtService.sign(payload);

        return {user, token}

    }
}
