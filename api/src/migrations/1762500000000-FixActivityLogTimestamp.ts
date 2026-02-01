import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixActivityLogTimestamp1762500000000 implements MigrationInterface {
  name = 'FixActivityLogTimestamp1762500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Change created_at column to use TIMESTAMPTZ (timestamp with time zone)
    await queryRunner.query(`
      ALTER TABLE "activity_logs" 
      ALTER COLUMN "created_at" TYPE TIMESTAMPTZ USING "created_at" AT TIME ZONE 'UTC',
      ALTER COLUMN "created_at" SET DEFAULT NOW()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert to TIMESTAMP without timezone
    await queryRunner.query(`
      ALTER TABLE "activity_logs" 
      ALTER COLUMN "created_at" TYPE TIMESTAMP,
      ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP
    `);
  }
}
