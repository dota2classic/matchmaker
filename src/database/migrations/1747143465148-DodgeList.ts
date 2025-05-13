import { MigrationInterface, QueryRunner } from "typeorm";

export class DodgeList1747143465148 implements MigrationInterface {
  name = "DodgeList1747143465148";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "party" ADD "dodge_list" text array NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "party" DROP COLUMN "dodge_list"`);
  }
}
