import { MigrationInterface, QueryRunner } from "typeorm";

export class QueueEntry1760000000000 implements MigrationInterface {
  name = "QueueEntry1760000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "queue_result_type" AS ENUM ('MATCHED', 'LEFT_QUEUE', 'MATCHED_OTHER_MODE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "ready_check_result_type" AS ENUM ('ALL_READY', 'DECLINE', 'TIMEOUT')`,
    );
    await queryRunner.query(`
      CREATE TABLE "queue_entry" (
        "id"                                   uuid NOT NULL DEFAULT uuid_generate_v4(),
        "party_id"                             character varying NOT NULL,
        "room_id"                              character varying DEFAULT NULL,
        "queue_mode"                           integer NOT NULL,
        "party_size"                           integer NOT NULL,
        "party_score"                          double precision NOT NULL,
        "avg_player_score"                     double precision NOT NULL,
        "score_std_dev"                        double precision NOT NULL,
        "dodge_list_size"                      integer NOT NULL,
        "entered_at"                           TIMESTAMP WITH TIME ZONE NOT NULL,
        "utc_hour"                             integer NOT NULL,
        "day_of_week"                          integer NOT NULL,
        "snapshot_player_count"                integer NOT NULL,
        "snapshot_party_count"                 integer NOT NULL,
        "snapshot_avg_wait_time_seconds"       double precision NOT NULL,
        "snapshot_max_team_score_difference"   double precision NOT NULL,
        "snapshot_max_player_score_difference" double precision NOT NULL,
        "snapshot_balance_function_type"       "balance_function_type" NOT NULL,
        "result_type"                          "queue_result_type" DEFAULT NULL,
        "wait_time_seconds"                    integer DEFAULT NULL,
        "ready_check_result"                   "ready_check_result_type" DEFAULT NULL,
        "ready_check_duration_seconds"         integer DEFAULT NULL,
        CONSTRAINT "PK_queue_entry" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_queue_entry_party_id" ON "queue_entry" ("party_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_queue_entry_room_id" ON "queue_entry" ("room_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_queue_entry_room_id"`);
    await queryRunner.query(`DROP INDEX "IDX_queue_entry_party_id"`);
    await queryRunner.query(`DROP TABLE "queue_entry"`);
    await queryRunner.query(`DROP TYPE "ready_check_result_type"`);
    await queryRunner.query(`DROP TYPE "queue_result_type"`);
  }
}
