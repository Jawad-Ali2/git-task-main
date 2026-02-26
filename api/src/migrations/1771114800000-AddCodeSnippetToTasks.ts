import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddCodeSnippetToTasks1771114800000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn('tasks', new TableColumn({
            name: 'codeSnippet',
            type: 'text',
            isNullable: true,
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('tasks', 'codeSnippet');
    }
}
