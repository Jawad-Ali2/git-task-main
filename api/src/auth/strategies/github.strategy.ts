import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-github2";
import { AuthService } from "../auth.service";



@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
    constructor(private readonly authService: AuthService) {
        super({
            clientID: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
            callbackURL: process.env.GITHUB_CALLBACK_URL!,
            scope: ['read:user', 'repo', 'user:email'],
        })
    }

    async validate(accessToken: string, refreshToken: string, profile: any, done: Function) {
        try{
            const user = await this.authService.validateOAuthLogin(profile, accessToken);

            done(null, user);
        }catch(err){
            done(err, false)
        }
    }
}
