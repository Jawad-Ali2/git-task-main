import { IsString, IsOptional, IsEnum, MinLength, MaxLength } from 'class-validator';
import { TeamRole } from '../entities/team-member.entity';

export class CreateTeamDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateTeamDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class JoinTeamDto {
  @IsOptional()
  @IsEnum(['developer', 'tl'])
  role?: 'developer' | 'tl' = 'developer';
}

export class UpdateRoleDto {
  @IsEnum(TeamRole)
  role: TeamRole;
}
