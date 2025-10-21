import { Repository } from 'src/repositories/entities/repository.entity';
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  githubId?: string;

  @Column({ nullable: true })
  accessToken?: string; // store access token (be cautious with security)

  @Column({ nullable: true })
  name?: string;

  @Column({ unique: true, nullable: true })
  email?: string;

  @Column({ default: 'developer' })
  role: string; // developer | manager | admin

  @OneToMany(() => Repository, (repo) => repo.user)
  repositories: Repository[];
}
