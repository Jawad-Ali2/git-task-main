import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddTaskTypeAndPriority1761830000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add type column
        await queryRunner.addColumn('tasks', new TableColumn({
            name: 'type',
            type: 'varchar',
            length: '50',
            default: "'TODO'",
        }));

        // Add priority column
        await queryRunner.addColumn('tasks', new TableColumn({
            name: 'priority',
            type: 'varchar',
            length: '20',
            default: "'medium'",
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('tasks', 'type');
        await queryRunner.dropColumn('tasks', 'priority');
    }
}
