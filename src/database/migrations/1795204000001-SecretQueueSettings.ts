import { MigrationInterface, QueryRunner } from "typeorm";

export class SecretQueueSettings1795204000001 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO queue_settings (mode, check_interval, balance_function,
                                  max_team_score_difference, max_player_score_difference)
      SELECT '14', 30, balance_function, max_team_score_difference, max_player_score_difference
      FROM queue_settings WHERE mode = '1'
      ON CONFLICT (mode) DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE party SET queue_modes = array_remove(queue_modes, '14'), in_queue = false,
                       enter_queue_time = NULL
      WHERE '14' = ANY(queue_modes)
    `);
    await queryRunner.query(`DELETE FROM queue_settings WHERE mode = '14'`);
  }
}
