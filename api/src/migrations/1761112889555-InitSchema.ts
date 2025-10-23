import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1761112889555 implements MigrationInterface {
    name = 'InitSchema1761112889555'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "repositories" ADD "ai_summary" text`);
        await queryRunner.query(`ALTER TABLE "repositories" ADD "debt_score" double precision`);
        await queryRunner.query(`ALTER TABLE "tasks" ADD "ai_summary" text`);
        await queryRunner.query(`ALTER TABLE "tasks" ADD "debt_score" double precision`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "debt_score"`);
        await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "ai_summary"`);
        await queryRunner.query(`ALTER TABLE "repositories" DROP COLUMN "debt_score"`);
        await queryRunner.query(`ALTER TABLE "repositories" DROP COLUMN "ai_summary"`);
    }

}
