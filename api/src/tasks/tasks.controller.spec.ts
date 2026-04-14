import { Test, TestingModule } from '@nestjs/testing';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { AiInsightsService } from './ai-insights.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Task } from './entities/tasks.entity';

describe('TasksController', () => {
  let controller: TasksController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        { provide: TasksService, useValue: {} },
        { provide: AiInsightsService, useValue: {} },
        { provide: getRepositoryToken(Task), useValue: {} },
      ],
    }).compile();

    controller = module.get<TasksController>(TasksController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
