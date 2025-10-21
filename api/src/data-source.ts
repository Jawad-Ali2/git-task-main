import { DataSource } from 'typeorm';
import 'dotenv/config';
import { User } from './users/entities/user.entity';
import { Repository } from './repositories/entities/repository.entity';
import { Task } from './tasks/entities/tasks.entity';
import 'dotenv/config';

export default new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST,
    port: +process.env.DATABASE_PORT!,
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    entities: [User, Repository, Task],
    migrations: ['src/migrations/*.ts'],
});
