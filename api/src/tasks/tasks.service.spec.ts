import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from './tasks.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository as RepoEntity } from '../repositories/entities/repository.entity';
import { Task } from './entities/tasks.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { AiService } from '../ai/ai.service';
import { DataSource } from 'typeorm';

describe('TasksService', () => {
  let service: TasksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: getRepositoryToken(RepoEntity), useValue: {} },
        { provide: getRepositoryToken(Task), useValue: {} },
        { provide: 'REDIS_CLIENT', useValue: {} },
        { provide: NotificationsService, useValue: {} },
        { provide: AiService, useValue: { isAvailable: () => false } },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
