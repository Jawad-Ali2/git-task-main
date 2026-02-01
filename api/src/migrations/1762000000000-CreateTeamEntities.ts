import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTeamEntities1762000000000 implements MigrationInterface {
  name = 'CreateTeamEntities1762000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create team_role_enum type
    await queryRunner.query(`
      CREATE TYPE "team_role_enum" AS ENUM ('owner', 'pm', 'developer', 'viewer')
    `);

    // Create teams table
    await queryRunner.query(`
      CREATE TABLE "teams" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(100) NOT NULL,
        "description" character varying(500),
        "invite_code" character varying(8) NOT NULL,
        "owner_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_teams_invite_code" UNIQUE ("invite_code"),
        CONSTRAINT "PK_teams" PRIMARY KEY ("id")
      )
    `);

    // Create team_members table
    await queryRunner.query(`
      CREATE TABLE "team_members" (
        "id" SERIAL NOT NULL,
        "team_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "role" "team_role_enum" NOT NULL DEFAULT 'developer',
        "joined_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_team_members_team_user" UNIQUE ("team_id", "user_id"),
        CONSTRAINT "PK_team_members" PRIMARY KEY ("id")
      )
    `);

    // Create team_repositories table
    await queryRunner.query(`
      CREATE TABLE "team_repositories" (
        "id" SERIAL NOT NULL,
        "team_id" uuid NOT NULL,
        "repository_id" uuid NOT NULL,
        "added_by" uuid,
        "added_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_team_repos_team_repo" UNIQUE ("team_id", "repository_id"),
        CONSTRAINT "PK_team_repositories" PRIMARY KEY ("id")
      )
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX "idx_team_members_team" ON "team_members" ("team_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_team_members_user" ON "team_members" ("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_team_repos_team" ON "team_repositories" ("team_id")
    `);

    // Add foreign key constraints for teams
    await queryRunner.query(`
      ALTER TABLE "teams"
      ADD CONSTRAINT "FK_teams_owner"
      FOREIGN KEY ("owner_id")
      REFERENCES "users"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);

    // Add foreign key constraints for team_members
    await queryRunner.query(`
      ALTER TABLE "team_members"
      ADD CONSTRAINT "FK_team_members_team"
      FOREIGN KEY ("team_id")
      REFERENCES "teams"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "team_members"
      ADD CONSTRAINT "FK_team_members_user"
      FOREIGN KEY ("user_id")
      REFERENCES "users"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);

    // Add foreign key constraints for team_repositories
    await queryRunner.query(`
      ALTER TABLE "team_repositories"
      ADD CONSTRAINT "FK_team_repos_team"
      FOREIGN KEY ("team_id")
      REFERENCES "teams"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "team_repositories"
      ADD CONSTRAINT "FK_team_repos_repository"
      FOREIGN KEY ("repository_id")
      REFERENCES "repositories"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "team_repositories"
      ADD CONSTRAINT "FK_team_repos_added_by"
      FOREIGN KEY ("added_by")
      REFERENCES "users"("id")
      ON DELETE SET NULL
      ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    await queryRunner.query(`ALTER TABLE "team_repositories" DROP CONSTRAINT "FK_team_repos_added_by"`);
    await queryRunner.query(`ALTER TABLE "team_repositories" DROP CONSTRAINT "FK_team_repos_repository"`);
    await queryRunner.query(`ALTER TABLE "team_repositories" DROP CONSTRAINT "FK_team_repos_team"`);
    await queryRunner.query(`ALTER TABLE "team_members" DROP CONSTRAINT "FK_team_members_user"`);
    await queryRunner.query(`ALTER TABLE "team_members" DROP CONSTRAINT "FK_team_members_team"`);
    await queryRunner.query(`ALTER TABLE "teams" DROP CONSTRAINT "FK_teams_owner"`);

    // Drop indexes
    await queryRunner.query(`DROP INDEX "idx_team_repos_team"`);
    await queryRunner.query(`DROP INDEX "idx_team_members_user"`);
    await queryRunner.query(`DROP INDEX "idx_team_members_team"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "team_repositories"`);
    await queryRunner.query(`DROP TABLE "team_members"`);
    await queryRunner.query(`DROP TABLE "teams"`);

    // Drop enum type
    await queryRunner.query(`DROP TYPE "team_role_enum"`);
  }
}
