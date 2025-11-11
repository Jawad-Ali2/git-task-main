import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './services/integrations.service';
import { TrelloApiService } from './services/trello-api.service';
import { Integration } from './entities/integration.entity';
import { Task } from '../tasks/entities/tasks.entity';
import { Repository } from '../repositories/entities/repository.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Integration, Task, Repository]),
  ],
  controllers: [IntegrationsController],
  providers: [
    IntegrationsService,
    TrelloApiService,
    {
      provide: 'IntegrationsService',
      useExisting: IntegrationsService,
    },
  ],
  exports: [IntegrationsService, TrelloApiService, 'IntegrationsService'],
})
export class IntegrationsModule {}
