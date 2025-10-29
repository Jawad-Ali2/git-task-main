import { Module } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { WebhooksController } from './webhooks.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from '@/repositories/entities/repository.entity';
import { User } from '@/users/entities/user.entity';
import { TasksModule } from '@/tasks/tasks.module';
import { RepositoriesModule } from '@/repositories/repositories.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Repository]),
    TasksModule,
    RepositoriesModule
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule { }
