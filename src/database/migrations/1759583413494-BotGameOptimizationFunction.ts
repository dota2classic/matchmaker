import { MigrationInterface, QueryRunner } from "typeorm";

export class BotGameOptimizationFunction1759583413494
  implements MigrationInterface
{
  name = "BotGameOptimizationFunction1759583413494";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
  ALTER TYPE "public"."balance_function_type"
  ADD VALUE IF NOT EXISTS 'OPTIMIZE_PLAYER_COUNT';
`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
