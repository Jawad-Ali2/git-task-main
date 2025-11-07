import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddCommitTrackingFields1730844000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add addedBy column
        await queryRunner.addColumn('tasks', new TableColumn({
            name: 'addedBy',
            type: 'varchar',
            isNullable: true,
        }));

        // Add addedAt column
        await queryRunner.addColumn('tasks', new TableColumn({
            name: 'addedAt',
            type: 'timestamp',
            isNullable: true,
        }));

        // Add addedInCommit column
        await queryRunner.addColumn('tasks', new TableColumn({
            name: 'addedInCommit',
            type: 'varchar',
            isNullable: true,
        }));

        // Add completedBy column
        await queryRunner.addColumn('tasks', new TableColumn({
            name: 'completedBy',
            type: 'varchar',
            isNullable: true,
        }));

        // Add completedAt column
        await queryRunner.addColumn('tasks', new TableColumn({
            name: 'completedAt',
            type: 'timestamp',
            isNullable: true,
        }));

        // Add completedInCommit column
        await queryRunner.addColumn('tasks', new TableColumn({
            name: 'completedInCommit',
            type: 'varchar',
            isNullable: true,
        }));

        // Add lastModifiedBy column
        await queryRunner.addColumn('tasks', new TableColumn({
            name: 'lastModifiedBy',
            type: 'varchar',
            isNullable: true,
        }));

        // Add lastModifiedAt column
        await queryRunner.addColumn('tasks', new TableColumn({
            name: 'lastModifiedAt',
            type: 'timestamp',
            isNullable: true,
        }));

        // Add lastModifiedInCommit column
        await queryRunner.addColumn('tasks', new TableColumn({
            name: 'lastModifiedInCommit',
            type: 'varchar',
            isNullable: true,
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('tasks', 'addedBy');
        await queryRunner.dropColumn('tasks', 'addedAt');
        await queryRunner.dropColumn('tasks', 'addedInCommit');
        await queryRunner.dropColumn('tasks', 'completedBy');
        await queryRunner.dropColumn('tasks', 'completedAt');
        await queryRunner.dropColumn('tasks', 'completedInCommit');
        await queryRunner.dropColumn('tasks', 'lastModifiedBy');
        await queryRunner.dropColumn('tasks', 'lastModifiedAt');
        await queryRunner.dropColumn('tasks', 'lastModifiedInCommit');
    }
}
