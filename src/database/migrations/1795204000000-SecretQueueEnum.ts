import { MigrationInterface, QueryRunner } from "typeorm";

export class SecretQueueEnum1795204000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "party_queue_modes_enum" ADD VALUE IF NOT EXISTS '14'`);
  }

  async down(): Promise<void> {
    // Keep the additive enum value. The settings migration removes every active use.
  }
}
