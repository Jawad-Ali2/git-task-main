import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskAssignmentFields1762100000000 implements MigrationInterface {
  name = 'AddTaskAssignmentFields1762100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add assignment columns to tasks table
    await queryRunner.query(`
      ALTER TABLE "tasks" 
      ADD COLUMN IF NOT EXISTS "assigned_to" UUID REFERENCES "users"("id") ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS "assigned_by" UUID REFERENCES "users"("id") ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS "assigned_at" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "due_date" TIMESTAMP
    `);

    // Create indexes for efficient queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tasks_assigned_to" ON "tasks"("assigned_to")
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tasks_assigned_by" ON "tasks"("assigned_by")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tasks_due_date" ON "tasks"("due_date")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tasks_due_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tasks_assigned_by"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tasks_assigned_to"`);

    // Drop columns
    await queryRunner.query(`
      ALTER TABLE "tasks" 
      DROP COLUMN IF EXISTS "due_date",
      DROP COLUMN IF EXISTS "assigned_at",
      DROP COLUMN IF EXISTS "assigned_by",
      DROP COLUMN IF EXISTS "assigned_to"
    `);
  }
}
