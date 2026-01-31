import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissingJiraFields1761900000000 implements MigrationInterface {
  name = 'AddMissingJiraFields1761900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check which columns exist and add missing ones
    const table = await queryRunner.getTable('tasks');
    
    // Add jiraIssueId if it doesn't exist
    if (!table?.columns.find(c => c.name === 'jiraIssueId')) {
      await queryRunner.query(
        `ALTER TABLE "tasks" ADD COLUMN "jiraIssueId" VARCHAR NULL`
      );
    }

    // Add jiraIssueKey if it doesn't exist
    if (!table?.columns.find(c => c.name === 'jiraIssueKey')) {
      await queryRunner.query(
        `ALTER TABLE "tasks" ADD COLUMN "jiraIssueKey" VARCHAR NULL`
      );
    }

    // Add jiraIssueUrl if it doesn't exist
    if (!table?.columns.find(c => c.name === 'jiraIssueUrl')) {
      await queryRunner.query(
        `ALTER TABLE "tasks" ADD COLUMN "jiraIssueUrl" VARCHAR NULL`
      );
    }

    // Add jiraSyncStatus if it doesn't exist
    if (!table?.columns.find(c => c.name === 'jiraSyncStatus')) {
      await queryRunner.query(
        `ALTER TABLE "tasks" ADD COLUMN "jiraSyncStatus" VARCHAR NULL DEFAULT 'pending'`
      );
    }

    // Add jiraLastSyncedAt if it doesn't exist
    if (!table?.columns.find(c => c.name === 'jiraLastSyncedAt')) {
      await queryRunner.query(
        `ALTER TABLE "tasks" ADD COLUMN "jiraLastSyncedAt" TIMESTAMP NULL`
      );
    }

    // Add jiraSyncError if it doesn't exist
    if (!table?.columns.find(c => c.name === 'jiraSyncError')) {
      await queryRunner.query(
        `ALTER TABLE "tasks" ADD COLUMN "jiraSyncError" TEXT NULL`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Only drop columns if they exist
    const table = await queryRunner.getTable('tasks');
    
    if (table?.columns.find(c => c.name === 'jiraSyncError')) {
      await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "jiraSyncError"`);
    }
    if (table?.columns.find(c => c.name === 'jiraLastSyncedAt')) {
      await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "jiraLastSyncedAt"`);
    }
    if (table?.columns.find(c => c.name === 'jiraSyncStatus')) {
      await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "jiraSyncStatus"`);
    }
    if (table?.columns.find(c => c.name === 'jiraIssueUrl')) {
      await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "jiraIssueUrl"`);
    }
    if (table?.columns.find(c => c.name === 'jiraIssueKey')) {
      await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "jiraIssueKey"`);
    }
    if (table?.columns.find(c => c.name === 'jiraIssueId')) {
      await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "jiraIssueId"`);
    }
  }
}
