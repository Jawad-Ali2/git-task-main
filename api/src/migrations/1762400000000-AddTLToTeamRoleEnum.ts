import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTLToTeamRoleEnum1762400000000 implements MigrationInterface {
  name = 'AddTLToTeamRoleEnum1762400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add 'tl' value to team_role_enum if it doesn't exist
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'tl' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'team_role_enum')) THEN
          ALTER TYPE "team_role_enum" ADD VALUE 'tl';
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL doesn't support removing enum values directly
    // Would need to recreate the enum type to remove 'tl'
    console.log('Cannot remove enum value in PostgreSQL without recreating the type');
  }
}
