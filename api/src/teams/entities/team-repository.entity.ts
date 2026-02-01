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
import { Repository } from '../../repositories/entities/repository.entity';
import { User } from '../../users/entities/user.entity';

@Entity('team_repositories')
@Unique(['teamId', 'repositoryId'])
export class TeamRepository {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Team, (team) => team.repositories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @Column({ name: 'team_id' })
  @Index('idx_team_repos_team')
  teamId: string;

  @ManyToOne(() => Repository, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'repository_id' })
  repository: Repository;

  @Column({ name: 'repository_id' })
  repositoryId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'added_by' })
  addedBy: User;

  @Column({ name: 'added_by', nullable: true })
  addedById: string;

  @CreateDateColumn({ name: 'added_at' })
  addedAt: Date;
}
