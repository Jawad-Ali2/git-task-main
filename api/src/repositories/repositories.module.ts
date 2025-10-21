import { Module } from '@nestjs/common';
import { RepositoriesController } from './repositories.controller';
import { RepositoriesService } from './repositories.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { Repository } from './entities/repository.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Repository])],
  controllers: [RepositoriesController],
  providers: [RepositoriesService]
})
export class RepositoriesModule { }
