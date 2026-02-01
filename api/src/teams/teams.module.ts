import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { ActivityLogService } from './activity-log.service';
import { Team } from './entities/team.entity';
import { TeamMember } from './entities/team-member.entity';
import { TeamRepository } from './entities/team-repository.entity';
import { ActivityLog } from './entities/activity-log.entity';
import { Repository } from '../repositories/entities/repository.entity';
import { Task } from '../tasks/entities/tasks.entity';
import { User } from '../users/entities/user.entity';
import { TeamRolesGuard } from './guards/team-roles.guard';
import { TeamMemberGuard } from './guards/team-member.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Team, TeamMember, TeamRepository, ActivityLog, Repository, Task, User]),
  ],
  controllers: [TeamsController],
  providers: [
    TeamsService,
    ActivityLogService,
    TeamRolesGuard,
    TeamMemberGuard,
  ],
  exports: [TeamsService, ActivityLogService],
})
export class TeamsModule {}
