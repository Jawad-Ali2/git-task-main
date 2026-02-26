import { Module, forwardRef } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { AiInsightsService } from './ai-insights.service';
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
    providers: [TasksService, AiInsightsService],
    controllers: [TasksController],
    exports: [TasksService, AiInsightsService],
})
export class TasksModule { }
