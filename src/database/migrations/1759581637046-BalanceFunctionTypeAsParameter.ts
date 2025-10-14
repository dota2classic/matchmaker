import { MigrationInterface, QueryRunner } from "typeorm";

export class BalanceFunctionTypeAsParameter1759581637046
  implements MigrationInterface
{
  name = "BalanceFunctionTypeAsParameter1759581637046";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."balance_function_type" AS ENUM('LOG_WAITING_SCORE', 'MULT_WAITING_SCORE')`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_settings" ADD "balance_function" "public"."balance_function_type" NOT NULL DEFAULT 'LOG_WAITING_SCORE'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "queue_settings" DROP COLUMN "balance_function"`,
    );
    await queryRunner.query(`DROP TYPE "public"."balance_function_type"`);
  }
}
