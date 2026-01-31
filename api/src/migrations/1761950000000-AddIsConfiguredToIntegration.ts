import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsConfiguredToIntegration1761950000000 implements MigrationInterface {
  name = 'AddIsConfiguredToIntegration1761950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add isConfigured column with default false
    await queryRunner.query(
      `ALTER TABLE "integrations" ADD COLUMN IF NOT EXISTS "isConfigured" BOOLEAN NOT NULL DEFAULT false`
    );

    // Update existing integrations: if they have a boardId (Trello) or projectId (Jira), mark as configured
    await queryRunner.query(`
      UPDATE "integrations" 
      SET "isConfigured" = true 
      WHERE (config->>'boardId' IS NOT NULL AND config->>'boardId' != '')
         OR (config->>'projectId' IS NOT NULL AND config->>'projectId' != '')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "integrations" DROP COLUMN IF EXISTS "isConfigured"`);
  }
}
