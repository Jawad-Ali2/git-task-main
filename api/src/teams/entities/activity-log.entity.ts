import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { Team } from './team.entity';
import { User } from '../../users/entities/user.entity';

export enum ActivityType {
  // Task activities
  TASK_CREATED = 'task_created',
  TASK_ASSIGNED = 'task_assigned',
  TASK_UNASSIGNED = 'task_unassigned',
  TASK_COMPLETED = 'task_completed',
  TASK_STATUS_CHANGED = 'task_status_changed',
  TASK_PRIORITY_CHANGED = 'task_priority_changed',
  
  // Member activities
  MEMBER_JOINED = 'member_joined',
  MEMBER_LEFT = 'member_left',
  MEMBER_REMOVED = 'member_removed',
  MEMBER_ROLE_CHANGED = 'member_role_changed',
  
  // Repository activities
  REPO_SHARED = 'repo_shared',
  REPO_UNSHARED = 'repo_unshared',
  REPO_SCANNED = 'repo_scanned',
  
  // Team activities
  TEAM_CREATED = 'team_created',
  TEAM_UPDATED = 'team_updated',
}

export interface ActivityMetadata {
  taskId?: string;
  taskDescription?: string;
  taskType?: string;
  repositoryId?: string;
  repositoryName?: string;
  assigneeId?: string;
  assigneeName?: string;
  assigneeAvatarUrl?: string;
  oldStatus?: string;
  newStatus?: string;
  oldPriority?: string;
  newPriority?: string;
  oldRole?: string;
  newRole?: string;
  memberName?: string;
  memberAvatarUrl?: string;
  tasksFound?: number;
  [key: string]: any;
}

@Entity('activity_logs')
export class ActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Team, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @Column({ name: 'team_id' })
  @Index('idx_activity_logs_team')
  teamId: string;

  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User; // Who performed the action

  @Column({ name: 'user_id', nullable: true })
  @Index('idx_activity_logs_user')
  userId: string;

  @Column({
    type: 'enum',
    enum: ActivityType,
  })
  @Index('idx_activity_logs_type')
  type: ActivityType;

  @Column({ type: 'jsonb', nullable: true })
  metadata: ActivityMetadata;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  @Index('idx_activity_logs_created')
  createdAt: Date;
}
