import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import axios from 'axios';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly jwtService: JwtService, // Access token service
        @Inject('REFRESH_JWT_SERVICE')
        private readonly refreshJwtService: JwtService, // Refresh token service
    ) { }

    async validateOAuthLogin(profile: any, accessToken: string) {
        const githubId = profile.id?.toString();
        const email = (profile.emails && profile.emails[0] && profile.emails[0].value) || null;
        let user = await this.userRepo.findOne({ where: [{ githubId }, { email }] })

        if (!user) {
            user = this.userRepo.create({
                githubId,
                avatarUrl: profile.photos && profile.photos[0] && profile.photos[0].value,
                name: profile.username,
                email: email || `${profile.username}@github.com`,
                githubAccessToken: accessToken, // Will be encrypted by @BeforeInsert
            });
        } else {
            user.name = user.name || profile.displayName || profile.username;
            user.githubAccessToken = accessToken; // Update & re-encrypt
        }

        // Fetch Github App Installation ID
        const installationId = await this.fetchInstallationId(accessToken);
        if (installationId) {
            user.githubInstallationId = installationId;
            console.log(`Found Installation ID: ${installationId} for user ${user.name}`);
        } else {
            console.log(`No Installation ID found for user ${user.name}`);
        }

        await this.userRepo.save(user);

        const tokens = await this.generateTokens(user);
        await this.updateRefreshToken(user.id, tokens.refreshToken);

        return { user, ...tokens }
    }

    /**
     * Fetch the GitHub App Installation ID for the user
     * @param accessToken 
     */
    private async fetchInstallationId(accessToken: string): Promise<number | null> {
        try {
            const response = await axios.get('https://api.github.com/user/installations', {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: 'application/vnd.github+json',
                },
            });

            const appId = parseInt(process.env.GITHUB_APP_ID!);
            const installations = response.data?.installations || [];

            const installation = installations.find(
                (inst: any) => inst.app_id === appId,
            );

            return installation ? installation.id : null;
        } catch (error) {
            console.error('Error fetching installation ID:', error);
            return null;
        }
    }

    async generateTokens(user: User) {
        const payload = { sub: user.id, name: user.name, githubId: user.githubId, avatarUrl: user.avatarUrl };

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload), // Uses JWT_ACCESS_SECRET (15m)
            this.refreshJwtService.signAsync(payload), // Uses JWT_REFRESH_SECRET (7d)
        ]);

        return { accessToken, refreshToken };
    }

    async updateRefreshToken(userId: string, refreshToken: string) {
        const hashedToken = this.hashToken(refreshToken);
        await this.userRepo.update(userId, { refreshToken: hashedToken });
    }

    async refreshTokens(userId: string, refreshToken: string) {
        const user = await this.userRepo
            .createQueryBuilder('user')
            .addSelect('user.refreshToken')
            .where('user.id = :userId', { userId })
            .getOne();

        if (!user || !user.refreshToken) {
            throw new UnauthorizedException('Access Denied');
        }

        const hashedToken = this.hashToken(refreshToken);
        if (user.refreshToken !== hashedToken) {
            throw new UnauthorizedException('Invalid refresh token');
        }

        const tokens = await this.generateTokens(user);
        await this.updateRefreshToken(user.id, tokens.refreshToken);

        return tokens;
    }

    async logout(userId: string) {
        await this.userRepo.update(userId, { refreshToken: null as any });
    }

    private hashToken(token: string): string {
        return crypto.createHash('sha256').update(token).digest('hex');
    }

    async validateRefreshToken(token: string): Promise<any> {
        try {
            // Use refresh token service to verify
            return await this.refreshJwtService.verifyAsync(token);
        } catch {
            throw new UnauthorizedException('Invalid refresh token');
        }
    }
}
