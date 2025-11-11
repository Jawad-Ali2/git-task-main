import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateIntegrationEntity1761232472000 implements MigrationInterface {
    name = 'CreateIntegrationEntity1761232472000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "integrations" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "provider" character varying(50) NOT NULL,
                "accessToken" text NOT NULL,
                "refreshToken" text,
                "tokenExpiresAt" TIMESTAMP,
                "config" json,
                "status" character varying NOT NULL DEFAULT 'active',
                "lastError" text,
                "lastSyncAt" TIMESTAMP,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "userId" uuid NOT NULL,
                "repositoryId" uuid,
                CONSTRAINT "PK_integrations" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_integrations_user" ON "integrations" ("userId")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_integrations_repository" ON "integrations" ("repositoryId")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_integrations_provider" ON "integrations" ("provider")
        `);

        await queryRunner.query(`
            ALTER TABLE "integrations" 
            ADD CONSTRAINT "FK_integrations_user" 
            FOREIGN KEY ("userId") 
            REFERENCES "users"("id") 
            ON DELETE CASCADE 
            ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "integrations" 
            ADD CONSTRAINT "FK_integrations_repository" 
            FOREIGN KEY ("repositoryId") 
            REFERENCES "repositories"("id") 
            ON DELETE CASCADE 
            ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "integrations" DROP CONSTRAINT "FK_integrations_repository"`);
        await queryRunner.query(`ALTER TABLE "integrations" DROP CONSTRAINT "FK_integrations_user"`);
        await queryRunner.query(`DROP INDEX "IDX_integrations_provider"`);
        await queryRunner.query(`DROP INDEX "IDX_integrations_repository"`);
        await queryRunner.query(`DROP INDEX "IDX_integrations_user"`);
        await queryRunner.query(`DROP TABLE "integrations"`);
    }
}
