import { MigrationInterface, QueryRunner } from "typeorm";

export class AddGithubAppField1761730474838 implements MigrationInterface {
    name = 'AddGithubAppField1761730474838'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "githubInstallationId" integer`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_d66ab1a9dafa06f5aded7da28ad" UNIQUE ("githubInstallationId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_d66ab1a9dafa06f5aded7da28ad"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "githubInstallationId"`);
    }

}
