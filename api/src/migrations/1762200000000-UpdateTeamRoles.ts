import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateTeamRoles1762200000000 implements MigrationInterface {
  name = 'UpdateTeamRoles1762200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // First, update 'owner' roles to 'pm'
    await queryRunner.query(`
      UPDATE team_members SET role = 'pm' WHERE role = 'owner'
    `);

    // Update 'viewer' roles to 'developer' (removing viewer role)
    await queryRunner.query(`
      UPDATE team_members SET role = 'developer' WHERE role = 'viewer'
    `);

    // Rename owner_id column to created_by_id in teams table
    // Check if owner_id exists first
    const columns = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'teams' AND column_name = 'owner_id'
    `);

    if (columns.length > 0) {
      await queryRunner.query(`
        ALTER TABLE teams RENAME COLUMN owner_id TO created_by_id
      `);
    }

    // Update the enum constraint for team_members.role
    // This will vary depending on how TypeORM handles enums
    // For PostgreSQL, we may need to update the check constraint
    
    console.log('Migration UpdateTeamRoles completed: owner->pm, viewer->developer, owner_id->created_by_id');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert created_by_id to owner_id
    const columns = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'teams' AND column_name = 'created_by_id'
    `);

    if (columns.length > 0) {
      await queryRunner.query(`
        ALTER TABLE teams RENAME COLUMN created_by_id TO owner_id
      `);
    }

    // Note: We can't revert pm->owner or developer->viewer without knowing
    // which ones were originally which, so this is a one-way migration
    console.log('Partial revert: created_by_id->owner_id. Role changes cannot be reverted.');
  }
}
