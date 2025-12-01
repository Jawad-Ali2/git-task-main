import { Module, forwardRef } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from '@/repositories/entities/repository.entity';
import { Task } from './entities/tasks.entity';
import { NotificationsModule } from '@/notifications/notifications.module';
import { AiModule } from '@/ai/ai.module';
import { IntegrationsModule } from '@/integrations/integrations.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Repository, Task]),
        NotificationsModule,
        AiModule,
        forwardRef(() => IntegrationsModule),
    ],
    providers: [TasksService],
    controllers: [TasksController],
    exports: [TasksService],
})
export class TasksModule { }
