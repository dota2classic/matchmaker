import { MigrationInterface, QueryRunner } from "typeorm";

export class QueueSettings1745911710257 implements MigrationInterface {
  name = "QueueSettings1745911710257";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "queue_settings" ("mode" "public"."party_queue_modes_enum" NOT NULL, "check_interval" integer NOT NULL DEFAULT '60', "last_check_timestamp" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "in_progress" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_ec89f34f29582d560dfe75245f0" PRIMARY KEY ("mode"))`,
    );
    await queryRunner.query(
      `INSERT INTO "queue_settings" ("mode", "check_interval") VALUES ('1', 120), ('2', 30), ('7', 90), ('8', 120), ('12', 120)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "queue_settings"`);
  }
}
