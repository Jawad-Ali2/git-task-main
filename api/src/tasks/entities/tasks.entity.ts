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
}
