import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

@Controller('auth')
export class AuthController {

    @Get('github')
    @UseGuards(AuthGuard('github'))
    async githubAuth() {

    }

    @Get('github/callback')
    @UseGuards(AuthGuard('github'))
    async githubCallback(@Req() req: Request) {
        const result = req.user as any;

        return result;
    }

    @Get('profile')
    @UseGuards(AuthGuard('jwt'))
    getProfile(@Req() req: Request) {
        return { message: 'This is protected', user: (req as any).user }
    }
}
