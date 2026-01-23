import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './services/integrations.service';
import { TrelloApiService } from './services/trello-api.service';
import { TrelloWebhookSecurityService } from './services/trello-webhook-security.service';
import { Integration } from './entities/integration.entity';
import { Task } from '../tasks/entities/tasks.entity';
import { Repository } from '../repositories/entities/repository.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Integration, Task, Repository]),
    NotificationsModule,
  ],
  controllers: [IntegrationsController],
  providers: [
    IntegrationsService,
    TrelloApiService,
    TrelloWebhookSecurityService,
    {
      provide: 'IntegrationsService',
      useExisting: IntegrationsService,
    },
  ],
  exports: [IntegrationsService, TrelloApiService, TrelloWebhookSecurityService, 'IntegrationsService'],
})
export class IntegrationsModule {}
