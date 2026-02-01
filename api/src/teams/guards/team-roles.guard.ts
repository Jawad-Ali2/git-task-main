import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeamMember, TeamRole } from '../entities/team-member.entity';
import { TEAM_ROLES_KEY } from './team-roles.decorator';

@Injectable()
export class TeamRolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(TeamMember)
    private teamMemberRepository: Repository<TeamMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<TeamRole[]>(TEAM_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const teamId = request.params.teamId;

    if (!teamId) {
      throw new ForbiddenException('Team ID is required');
    }

    const member = await this.teamMemberRepository.findOne({
      where: { teamId, userId: user.userId },
    });

    if (!member) {
      throw new NotFoundException('You are not a member of this team');
    }

    // Attach member info to request for later use
    request.teamMember = member;

    return requiredRoles.includes(member.role);
  }
}
