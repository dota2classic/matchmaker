import { MigrationInterface, QueryRunner } from "typeorm";

export class DropQueueMeta1737585131797 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "queue_meta"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "queue_meta" ("version" character varying NOT NULL, "locked" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_7fddb038be726f084d6bc1c3ba6" PRIMARY KEY ("version"))`,
    );
  }
}
