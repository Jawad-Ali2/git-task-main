import { Module, forwardRef } from '@nestjs/common';
import { RepositoriesController } from './repositories.controller';
import { RepositoriesService } from './repositories.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@/users/entities/user.entity';
import { Repository } from './entities/repository.entity';
import { TasksModule } from '@/tasks/tasks.module';
import { NotificationsModule } from '@/notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Repository]),
    forwardRef(() => TasksModule),
    NotificationsModule,
  ],
  controllers: [RepositoriesController],
  providers: [RepositoriesService],
  exports: [RepositoriesService]
})
export class RepositoriesModule { }
