import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Get('github')
    @UseGuards(AuthGuard('github'))
    async githubAuth() {}

    @Get('github/callback')
    @UseGuards(AuthGuard('github'))
    async githubCallback(@Req() req: Request, @Res() res: Response) {
        const result = req.user as any;

        // Set secure HTTP-only cookies
        this.setAuthCookies(res, result.accessToken, result.refreshToken);

        // Redirect to frontend with success
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(`${frontendUrl}/dashboard?auth=success`);
    }

    @Get('profile')
    @UseGuards(AuthGuard('jwt'))
    getProfile(@Req() req: Request) {
        return { message: 'Authenticated', user: (req as any).user }
    }

    @Post('refresh')
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
