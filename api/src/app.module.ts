import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisController } from './redis/redis.controller';
import { RedisModule } from './redis/redis.module';
import { User } from './users/entities/user.entity';
import { Repository } from './repositories/entities/repository.entity';
import { Task } from './tasks/entities/tasks.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST,
      port: +process.env.DATABASE_PORT!,
      username: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      entities: [User, Repository, Task],
      synchronize: false,
      ssl: {
        rejectUnauthorized: false
      }
    }),

    RedisModule
  ],
  controllers: [AppController, RedisController],
  providers: [AppService],
})
export class AppModule { }
