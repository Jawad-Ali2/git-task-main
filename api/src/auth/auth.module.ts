import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { GithubStrategy } from './strategies/github.strategy';
import { JWTStrategy } from './strategies/jwt.strategy';
import { ConfigService } from '@nestjs/config';
import { WebhooksModule } from '@/webhooks/webhooks.module';

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([User]),

    // Base JWT Module (for access tokens by default)
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_ACCESS_EXPIRES_IN') as any || '15m' as any },
      }),
    }),
    WebhooksModule
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    GithubStrategy,
    JWTStrategy,
    
    // Custom Refresh Token JWT Service Provider
    {
      provide: 'REFRESH_JWT_SERVICE',
      useFactory: (config: ConfigService) => {
        return new JwtService({
          secret: config.get<string>('JWT_REFRESH_SECRET'),
          signOptions: { expiresIn: config.get<string>('JWT_REFRESH_EXPIRES_IN') as any || '7d' as any },
        });
      },
      inject: [ConfigService],
    },
  ],
})
export class AuthModule { }
