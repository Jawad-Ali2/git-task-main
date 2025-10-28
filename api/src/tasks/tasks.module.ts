import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from '@/repositories/entities/repository.entity';
import { Task } from './entities/tasks.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Repository, Task])],
    providers: [TasksService],
    controllers: [TasksController],
    exports: [TasksService],
})
export class TasksModule { }
