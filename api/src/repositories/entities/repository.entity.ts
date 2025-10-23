import { User } from '../../users/entities/user.entity';
import { Task } from '../../tasks/entities/tasks.entity';
import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";


@Entity('repositories')
export class Repository {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    githubId: string;

    @Column()
    name: string;

    @Column()
    url: string;

    @Column({ default: false })
    private: boolean;

    @Column({type: 'text', nullable: true})
    ai_summary: string;

    @Column({type: 'float', nullable: true})
    debt_score: number;

    @ManyToOne(() => User, (user) => user.repositories)
    user: User;

    @OneToMany(() => Task, (task) => task.repository)
    tasks: Task[]
}