import { MigrationInterface, QueryRunner } from "typeorm";

export class MirrorShadow1793538000000 implements MigrationInterface {
  name = "MirrorShadow1793538000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "player_in_party"
      ADD "pvp_games" integer,
      ADD "season_mmr" double precision,
      ADD "balance_stats_at" timestamptz`);
    await queryRunner.query(`CREATE TABLE "mirror_shadow_evaluation" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "room_id" uuid NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "input" jsonb NOT NULL,
      "result" jsonb NOT NULL,
      CONSTRAINT "PK_mirror_shadow_evaluation" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_mirror_shadow_room" ON "mirror_shadow_evaluation" ("room_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mirror_shadow_created" ON "mirror_shadow_evaluation" ("created_at")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "mirror_shadow_evaluation"`);
    await queryRunner.query(`ALTER TABLE "player_in_party"
      DROP COLUMN "balance_stats_at", DROP COLUMN "season_mmr", DROP COLUMN "pvp_games"`);
  }
}
