import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { Team } from './team.entity';
import { User } from '../../users/entities/user.entity';

export enum TeamRole {
  PM = 'pm',           // Project Manager - full control
  TL = 'tl',           // Team Lead - can assign tasks, invite
  DEVELOPER = 'developer', // Developer - can only work on tasks
}

@Entity('team_members')
@Unique(['teamId', 'userId'])
export class TeamMember {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Team, (team) => team.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @Column({ name: 'team_id' })
  @Index('idx_team_members_team')
  teamId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  @Index('idx_team_members_user')
  userId: string;

  @Column({
    type: 'enum',
    enum: TeamRole,
    default: TeamRole.DEVELOPER,
  })
  role: TeamRole;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;
}
