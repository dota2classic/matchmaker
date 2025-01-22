import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1737568135226 implements MigrationInterface {
  name = "Migration1737568135226";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "party" RENAME COLUMN "waiting_score" TO "enter_queue_time"`,
    );
    await queryRunner.query(
      `ALTER TABLE "party" DROP COLUMN "enter_queue_time"`,
    );
    await queryRunner.query(
      `ALTER TABLE "party" ADD "enter_queue_time" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "party" DROP COLUMN "enter_queue_time"`,
    );
    await queryRunner.query(
      `ALTER TABLE "party" ADD "enter_queue_time" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "party" RENAME COLUMN "enter_queue_time" TO "waiting_score"`,
    );
  }
}
