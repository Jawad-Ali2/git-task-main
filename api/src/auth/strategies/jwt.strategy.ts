import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Request } from 'express';


@Injectable()
export class JWTStrategy extends PassportStrategy(Strategy, 'jwt') {
    constructor(private readonly configService: ConfigService) {
        const secret = configService.get<string>('JWT_ACCESS_SECRET');
        
        if (!secret) {
            throw new Error('JWT_ACCESS_SECRET is not defined in environment variables');
        }

        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                (req: Request) => {
                    return req?.cookies?.accessToken;
                },
                ExtractJwt.fromAuthHeaderAsBearerToken(), // Fallback for API calls
            ]),
            ignoreExpiration: false,
            secretOrKey: secret,
        });
    }

    async validate(payload: any) {
        if (!payload || !payload.sub) {
            throw new UnauthorizedException('Invalid token payload');
        }

        return {
            userId: payload.sub,
            githubId: payload.githubId,
            email: payload.email,
        };
    }
}