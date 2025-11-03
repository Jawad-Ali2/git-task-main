import { BadRequestException, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiCookieAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { WebhooksService } from '@/webhooks/webhooks.service';
import { User } from '@/users/entities/user.entity';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService,
        private readonly webhooksService: WebhooksService
    ) { }

    @Get('github')
    @UseGuards(AuthGuard('github'))
    @ApiOperation({ summary: 'Initiate GitHub OAuth login' })
    @ApiResponse({ status: 302, description: 'Redirects to GitHub OAuth' })
    async githubAuth() { }

    @Get('github/callback')
    @UseGuards(AuthGuard('github'))
    @ApiOperation({ summary: 'GitHub OAuth callback' })
    @ApiResponse({ status: 302, description: 'Redirects to dashboard with auth cookies' })
    async githubCallback(@Req() req: Request, @Res() res: Response) {
        try {
            const result = req.user as any;

            // Set secure HTTP-only cookies
            this.setAuthCookies(res, result.accessToken, result.refreshToken);

            // ✅ Direct to dashboard - no GitHub App installation needed!
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            res.redirect(`${frontendUrl}/dashboard?auth=success`);
        } catch (error) {
            res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?auth=failed`);
        }
    }

    @Get('github-app/callback')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'GitHub App installation callback' })
    @ApiQuery({ name: 'installation_id', required: true })
    @ApiQuery({ name: 'setup_action', required: false })
    @ApiResponse({ status: 200, description: 'Installation linked successfully' })
    async githubAppCallback(
        @Query('installation_id') installationId: string,
        @Query('setup_action') setupAction: string,
        @Req() req: Request) {
        const user = (req as any).user;

        if (!installationId) {
            throw new BadRequestException('Missing installation_id');
        }

        await this.webhooksService.linkInstallationToUser(user.id, parseInt(installationId));

        return {
            status: 302,
            url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?installation_linked=success`
        }
    }

    @Get('profile')
    @UseGuards(AuthGuard('jwt'))
    @ApiCookieAuth('access_token')
    @ApiOperation({ summary: 'Get current user profile' })
    @ApiResponse({ status: 200, description: 'Returns authenticated user profile' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    getProfile(@Req() req: Request) {
        const user = (req as any).user as User;
        return { message: 'Authenticated', user }
    }

    @Post('refresh')
    @ApiCookieAuth('access_token')
    @ApiOperation({ summary: 'Refresh access token using refresh token' })
    @ApiResponse({ status: 200, description: 'Tokens refreshed successfully' })
    @ApiResponse({ status: 401, description: 'Invalid refresh token' })
    async refresh(@Req() req: Request, @Res() res: Response) {
        const refreshToken = req.cookies['refreshToken'];

        if (!refreshToken) {
            // TODO: should logout maybe instead this.clearAuthCookies(res); 
            return res.status(401).json({ message: 'No refresh token' });
        }

        try {
            const payload = await this.authService.validateRefreshToken(refreshToken);
            const tokens = await this.authService.refreshTokens(payload.sub, refreshToken);

            this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

            return res.json({ message: 'Tokens refreshed' });
        } catch (error) {
            this.clearAuthCookies(res);
            return res.status(401).json({ message: 'Invalid refresh token' });
        }
    }

    @Post('logout')
    @UseGuards(AuthGuard('jwt'))
    @ApiCookieAuth('access_token')
    @ApiOperation({ summary: 'Logout current user' })
    @ApiResponse({ status: 200, description: 'Logged out successfully' })
    async logout(@Req() req: Request, @Res() res: Response) {
        const user = (req as any).user;

        // Clear refresh token from DB
        await this.authService.logout(user.userId);

        this.clearAuthCookies(res);

        return res.json({ message: 'Logged out successfully' });
    }

    private setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
        const isProduction = process.env.NODE_ENV === 'production';

        // Access Token Cookie (15 minutes)
        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: isProduction, // HTTPS only in production
            sameSite: isProduction ? 'none' : 'lax',
            maxAge: 15 * 60 * 1000, // 15 minutes
            path: '/',
        });

        // Refresh Token Cookie (7 days)
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            path: '/',
        });
    }

    private clearAuthCookies(res: Response) {
        res.clearCookie('accessToken', { path: '/' });
        res.clearCookie('refreshToken', { path: '/' });
    }
}
