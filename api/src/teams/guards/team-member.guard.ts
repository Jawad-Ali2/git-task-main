import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeamMember } from '../entities/team-member.entity';

/**
 * Guard that checks if the user is a member of the team
 * Attaches the team member info to the request
 */
@Injectable()
export class TeamMemberGuard implements CanActivate {
  constructor(
    @InjectRepository(TeamMember)
    private teamMemberRepository: Repository<TeamMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const teamId = request.params.teamId;

    if (!teamId) {
      return true; // Let the controller handle missing teamId
    }

    const member = await this.teamMemberRepository.findOne({
      where: { teamId, userId: user.userId },
    });

    if (!member) {
      throw new NotFoundException('You are not a member of this team');
    }

    // Attach member info to request for later use
    request.teamMember = member;
    return true;
  }
}
