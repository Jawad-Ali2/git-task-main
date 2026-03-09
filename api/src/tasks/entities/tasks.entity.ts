import { Repository } from '../../repositories/entities/repository.entity';
import { User } from '../../users/entities/user.entity';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';


@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  description: string;

  @Column({ default: 'TODO', length: 50 })
  type: string; // TODO | FIXME | HACK | NOTE | BUG

  @Column({ default: 'open' })
  status: string; // open | in-progress | done

  @Column({ default: 'medium', length: 20 })
  priority: string; // low | medium | high

  @Column()
  filePath: string;

  @Column()
  lineNumber: number;

  @ManyToOne(() => Repository, (repo) => repo.tasks, { onDelete: 'CASCADE' })
  repository: Repository;

  @Column({ type: 'text', nullable: true })
  ai_summary: string;

  @Column({ type: 'float', nullable: true })
  debt_score: number;

  @Column({ type: 'text', nullable: true })
  codeSnippet: string;

  // ========== TASK ASSIGNMENT FIELDS ==========

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_to' })
  assignedTo: User | null;

  @Column({ name: 'assigned_to', nullable: true })
  assignedToId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_by' })
  assignedBy: User | null;

  @Column({ name: 'assigned_by', nullable: true })
  assignedById: string | null;

  @Column({ name: 'assigned_at', type: 'timestamp', nullable: true })
  assignedAt: Date | null;

  @Column({ name: 'due_date', type: 'timestamp', nullable: true })
  dueDate: Date | null;

  // ========== COMMIT TRACKING FIELDS ==========
  @Column({ type: 'varchar', nullable: true })
  addedBy: string; // GitHub username who added this task

  @Column({ type: 'timestamp', nullable: true })
  addedAt: Date; // When the task was added

  @Column({ type: 'varchar', nullable: true })
  addedInCommit: string; // SHA of commit that added this task

  @Column({ type: 'varchar', nullable: true })
  completedBy: string; // GitHub username who completed/removed this task

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date; // When the task was completed

  @Column({ type: 'varchar', nullable: true })
  completedInCommit: string; // SHA of commit that removed this task

  @Column({ type: 'varchar', nullable: true })
  lastModifiedBy: string; // Last person to modify this task's comment

  @Column({ type: 'timestamp', nullable: true })
  lastModifiedAt: Date; // When the task comment was last modified

  @Column({ type: 'varchar', nullable: true })
  lastModifiedInCommit: string; // SHA of commit that last modified this task

  // Trello integration fields
  @Column({ type: 'varchar', nullable: true })
  trelloCardId?: string; // Trello card ID

  @Column({ type: 'varchar', nullable: true })
  trelloCardUrl?: string; // Direct URL to Trello card

  @Column({ type: 'varchar', nullable: true, default: 'pending' })
  trelloSyncStatus?: string; // 'pending', 'synced', 'error', 'disabled'

  @Column({ type: 'timestamp', nullable: true })
  trelloLastSyncedAt?: Date; // When was this task last synced with Trello

  @Column({ type: 'text', nullable: true })
  trelloSyncError?: string; // Store last sync error if any

  // Jira integration fields
  @Column({ type: 'varchar', nullable: true })
  jiraIssueId?: string; // Jira issue ID

  @Column({ type: 'varchar', nullable: true })
  jiraIssueKey?: string; // Jira issue key (e.g., "PROJ-123")

  @Column({ type: 'varchar', nullable: true })
  jiraIssueUrl?: string; // Direct URL to Jira issue

  @Column({ type: 'varchar', nullable: true, default: 'pending' })
  jiraSyncStatus?: string; // 'pending', 'synced', 'error', 'disabled'

  @Column({ type: 'timestamp', nullable: true })
  jiraLastSyncedAt?: Date; // When was this task last synced with Jira

  @Column({ type: 'text', nullable: true })
  jiraSyncError?: string; // Store last sync error if any
}
