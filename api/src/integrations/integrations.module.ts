import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationsController } from './integrations.controller';
import { JiraController } from './controllers/jira.controller';
import { IntegrationsService } from './services/integrations.service';
import { TrelloApiService } from './services/trello-api.service';
import { TrelloWebhookSecurityService } from './services/trello-webhook-security.service';
import { JiraApiService } from './services/jira/jira-api.service';
import { JiraWebhookSecurityService } from './services/jira/jira-webhook-security.service';
import { BaseWebhookSecurityService } from './services/base/base-webhook-security.service';
import { Integration } from './entities/integration.entity';
import { Task } from '../tasks/entities/tasks.entity';
import { Repository } from '../repositories/entities/repository.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Integration, Task, Repository]),
    NotificationsModule,
  ],
  controllers: [IntegrationsController, JiraController],
  providers: [
    IntegrationsService,
    // Trello services
    TrelloApiService,
    TrelloWebhookSecurityService,
    // Jira services
    JiraApiService,
    JiraWebhookSecurityService,
    // Base services
    BaseWebhookSecurityService,
    {
      provide: 'IntegrationsService',
      useExisting: IntegrationsService,
    },
  ],
  exports: [
    IntegrationsService, 
    TrelloApiService, 
    TrelloWebhookSecurityService,
    JiraApiService,
    JiraWebhookSecurityService,
    'IntegrationsService',
  ],
})
export class IntegrationsModule {}
