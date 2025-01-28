import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1737567975564 implements MigrationInterface {
  name = "Migration1737567975564";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."party_queue_modes_enum" AS ENUM('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."player_in_room_ready_state_enum" AS ENUM('0', '1', '2', '3')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."player_in_room_team_enum" AS ENUM('2', '3')`,
    );

    await queryRunner.query(
      `CREATE TABLE "player_in_party" ("steam_id" character varying NOT NULL, "party_id" uuid NOT NULL, "leader" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_525e4ed572fe057f9a637a399b8" PRIMARY KEY ("steam_id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "only_one_leader" ON "player_in_party" ("party_id") WHERE leader`,
    );
    await queryRunner.query(
      `CREATE TABLE "party_invite" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "party_id" uuid NOT NULL, "inviter" character varying NOT NULL, "invited" character varying NOT NULL, CONSTRAINT "PK_db38c387630c10c32fa42fd4d40" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "player_pair_invite" ON "party_invite" ("inviter", "invited", "party_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "party" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "score" double precision NOT NULL DEFAULT '0', "waiting_score" integer default 0, "queue_modes" "public"."party_queue_modes_enum" array NOT NULL DEFAULT '{}', "in_queue" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_e6189b3d533e140bb33a6d2cec1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "queue_meta" ("version" character varying NOT NULL, "locked" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_7fddb038be726f084d6bc1c3ba6" PRIMARY KEY ("version"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "player_in_room" ("room_id" uuid NOT NULL, "party_id" uuid NOT NULL, "steam_id" character varying NOT NULL, "ready_state" "public"."player_in_room_ready_state_enum" NOT NULL DEFAULT '3', "team" "public"."player_in_room_team_enum" NOT NULL, CONSTRAINT "PK_45fa2b3a4ca89d0539d0e596e26" PRIMARY KEY ("room_id", "party_id", "steam_id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "max_one_room_for_player" ON "player_in_room" ("steam_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "room" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "lobby_type" integer NOT NULL, "ready_check_started_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ready_check_finished_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_c6d46db005d623e691b2fbcba23" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "player_in_party" ADD CONSTRAINT "FK_9a118e2655920f8b528b305de91" FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "party_invite" ADD CONSTRAINT "FK_9de980f95dff7b120598bbae90a" FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "player_in_room" ADD CONSTRAINT "FK_0043e55f4eb28bc682cc1e1a140" FOREIGN KEY ("room_id") REFERENCES "room"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "player_in_room" ADD CONSTRAINT "FK_a37b9e3201354878cee8e4fbbd0" FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TYPE "public"."player_in_room_team_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."player_in_room_ready_state_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."party_queue_modes_enum"`);
    await queryRunner.query(
      `ALTER TABLE "player_in_room" DROP CONSTRAINT "FK_a37b9e3201354878cee8e4fbbd0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "player_in_room" DROP CONSTRAINT "FK_0043e55f4eb28bc682cc1e1a140"`,
    );
    await queryRunner.query(
      `ALTER TABLE "party_invite" DROP CONSTRAINT "FK_9de980f95dff7b120598bbae90a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "player_in_party" DROP CONSTRAINT "FK_9a118e2655920f8b528b305de91"`,
    );
    await queryRunner.query(`DROP TABLE "room"`);
    await queryRunner.query(`DROP INDEX "public"."max_one_room_for_player"`);
    await queryRunner.query(`DROP TABLE "player_in_room"`);
    await queryRunner.query(`DROP TABLE "queue_meta"`);
    await queryRunner.query(`DROP TABLE "party"`);
    await queryRunner.query(`DROP INDEX "public"."player_pair_invite"`);
    await queryRunner.query(`DROP TABLE "party_invite"`);
    await queryRunner.query(`DROP INDEX "public"."only_one_leader"`);
    await queryRunner.query(`DROP TABLE "player_in_party"`);
  }
}
