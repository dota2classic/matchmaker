import { MigrationInterface, QueryRunner } from "typeorm";

export class TurboMode1755092940382 implements MigrationInterface {
  name = "TurboMode1755092940382";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."party_queue_modes_enum" RENAME TO "party_queue_modes_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."party_queue_modes_enum" AS ENUM('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13')`,
    );
    await queryRunner.query(
      `ALTER TABLE "party" ALTER COLUMN "queue_modes" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "party" ALTER COLUMN "queue_modes" TYPE "public"."party_queue_modes_enum"[] USING "queue_modes"::"text"::"public"."party_queue_modes_enum"[]`,
    );
    await queryRunner.query(
      `ALTER TABLE "party" ALTER COLUMN "queue_modes" SET DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_settings" ALTER COLUMN "mode" TYPE "public"."party_queue_modes_enum" USING "mode"::"text"::"public"."party_queue_modes_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."party_queue_modes_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."party_queue_modes_enum_old" AS ENUM('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12')`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_settings" ALTER COLUMN "mode" TYPE "public"."party_queue_modes_enum_old" USING "mode"::"text"::"public"."party_queue_modes_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."party_queue_modes_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."party_queue_modes_enum_old" RENAME TO "party_queue_modes_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."party_queue_modes_enum_old" AS ENUM('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12')`,
    );
    await queryRunner.query(
      `ALTER TABLE "party" ALTER COLUMN "queue_modes" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "party" ALTER COLUMN "queue_modes" TYPE "public"."party_queue_modes_enum_old"[] USING "queue_modes"::"text"::"public"."party_queue_modes_enum_old"[]`,
    );
    await queryRunner.query(
      `ALTER TABLE "party" ALTER COLUMN "queue_modes" SET DEFAULT '{}'`,
    );
    await queryRunner.query(`DROP TYPE "public"."party_queue_modes_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."party_queue_modes_enum_old" RENAME TO "party_queue_modes_enum"`,
    );
  }
}
