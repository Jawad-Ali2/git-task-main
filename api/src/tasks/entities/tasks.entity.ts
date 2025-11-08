import { Repository } from '../../repositories/entities/repository.entity';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';


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

  @ManyToOne(() => Repository, (repo) => repo.tasks)
  repository: Repository;

  @Column({ type: 'text', nullable: true })
  ai_summary: string;

  @Column({ type: 'float', nullable: true })
  debt_score: number;

  // Commit tracking fields
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
}
