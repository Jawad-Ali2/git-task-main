import { Repository } from '../../repositories/entities/repository.entity';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";


@Entity('users')
export class User{
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column({unique: true})
    email: string;

    @Column()
    role: string;

    @OneToMany(( ) => Repository, (repo) => repo.user)
    repositories: Repository[];
}