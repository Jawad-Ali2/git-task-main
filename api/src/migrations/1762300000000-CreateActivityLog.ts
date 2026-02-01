import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateActivityLog1762300000000 implements MigrationInterface {
  name = 'CreateActivityLog1762300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create activity type enum
    await queryRunner.query(`
      CREATE TYPE "activity_type_enum" AS ENUM (
        'task_created',
        'task_assigned',
        'task_unassigned',
        'task_completed',
        'task_status_changed',
        'task_priority_changed',
        'member_joined',
        'member_left',
        'member_removed',
        'member_role_changed',
        'repo_shared',
        'repo_unshared',
        'repo_scanned',
        'team_created',
        'team_updated'
      )
    `);

    // Create activity_logs table
    await queryRunner.query(`
      CREATE TABLE "activity_logs" (
        "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "team_id" UUID NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
        "user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
        "type" activity_type_enum NOT NULL,
        "metadata" JSONB,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for performance
    await queryRunner.query(`CREATE INDEX "idx_activity_logs_team" ON "activity_logs"("team_id")`);
    await queryRunner.query(`CREATE INDEX "idx_activity_logs_user" ON "activity_logs"("user_id")`);
    await queryRunner.query(`CREATE INDEX "idx_activity_logs_type" ON "activity_logs"("type")`);
    await queryRunner.query(`CREATE INDEX "idx_activity_logs_created" ON "activity_logs"("created_at" DESC)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_activity_logs_created"`);
    await queryRunner.query(`DROP INDEX "idx_activity_logs_type"`);
    await queryRunner.query(`DROP INDEX "idx_activity_logs_user"`);
    await queryRunner.query(`DROP INDEX "idx_activity_logs_team"`);
    await queryRunner.query(`DROP TABLE "activity_logs"`);
    await queryRunner.query(`DROP TYPE "activity_type_enum"`);
  }
}
