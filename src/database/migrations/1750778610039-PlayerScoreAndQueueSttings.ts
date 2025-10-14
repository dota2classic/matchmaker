import { MigrationInterface, QueryRunner } from "typeorm";

export class PlayerScoreAndQueueSttings1750778610039
  implements MigrationInterface
{
  name = "PlayerScoreAndQueueSttings1750778610039";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "player_in_party" ADD "score" double precision NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_settings" ADD "max_team_score_difference" integer NOT NULL DEFAULT '1000000'`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_settings" ADD "max_player_score_difference" integer NOT NULL DEFAULT '1000000'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "queue_settings" DROP COLUMN "max_player_score_difference"`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_settings" DROP COLUMN "max_team_score_difference"`,
    );
    await queryRunner.query(
      `ALTER TABLE "player_in_party" DROP COLUMN "score"`,
    );
  }
}
