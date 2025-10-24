import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAvatarURL1761328650971 implements MigrationInterface {
    name = 'AddAvatarURL1761328650971'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "avatarUrl" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "avatarUrl"`);
    }

}
