import { SetMetadata } from '@nestjs/common';
import { TeamRole } from '../entities/team-member.entity';

export const TEAM_ROLES_KEY = 'teamRoles';
export const TeamRoles = (...roles: TeamRole[]) => SetMetadata(TEAM_ROLES_KEY, roles);
