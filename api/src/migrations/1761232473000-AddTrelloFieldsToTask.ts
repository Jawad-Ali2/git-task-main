import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTrelloFieldsToTask1761232473000 implements MigrationInterface {
    name = 'AddTrelloFieldsToTask1761232473000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "tasks" 
            ADD COLUMN "trelloCardId" character varying,
            ADD COLUMN "trelloCardUrl" character varying,
            ADD COLUMN "trelloSyncStatus" character varying DEFAULT 'pending',
            ADD COLUMN "trelloLastSyncedAt" TIMESTAMP,
            ADD COLUMN "trelloSyncError" text
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_tasks_trello_card_id" ON "tasks" ("trelloCardId")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_tasks_trello_sync_status" ON "tasks" ("trelloSyncStatus")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_tasks_trello_sync_status"`);
        await queryRunner.query(`DROP INDEX "IDX_tasks_trello_card_id"`);
        await queryRunner.query(`
            ALTER TABLE "tasks" 
            DROP COLUMN "trelloSyncError",
            DROP COLUMN "trelloLastSyncedAt",
            DROP COLUMN "trelloSyncStatus",
            DROP COLUMN "trelloCardUrl",
            DROP COLUMN "trelloCardId"
        `);
    }
}
