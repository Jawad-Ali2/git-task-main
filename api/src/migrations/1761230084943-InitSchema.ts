import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1761230084943 implements MigrationInterface {
    name = 'InitSchema1761230084943'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "accessToken" TO "refreshToken"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "refreshToken" TO "accessToken"`);
    }

}
