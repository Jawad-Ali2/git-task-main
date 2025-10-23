import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterGithubAccessTokenType1761232260774 implements MigrationInterface {
    name = 'AlterGithubAccessTokenType1761232260774'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "githubAccessToken" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "githubAccessToken"`);
    }

}
