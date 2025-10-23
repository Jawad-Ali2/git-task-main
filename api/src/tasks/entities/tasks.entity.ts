import { Repository } from '../../repositories/entities/repository.entity';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';


@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  description: string;

  @Column({ default: 'open' })
  status: string; // open | in-progress | done

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
