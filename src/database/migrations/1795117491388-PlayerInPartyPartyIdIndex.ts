import { MigrationInterface, QueryRunner } from "typeorm";

const INDEX = "IDX_player_in_party_party_id";

export class PlayerInPartyPartyIdIndex1795117491388
  implements MigrationInterface
{
  name = "PlayerInPartyPartyIdIndex1795117491388";
  public transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    const invalid = await queryRunner.query(
      `SELECT 1 FROM pg_index i INNER JOIN pg_class c ON c.oid = i.indexrelid WHERE c.relname = $1 AND NOT i.indisvalid`,
      [INDEX],
    );
    if (invalid.length > 0) {
      await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "${INDEX}"`);
    }
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "${INDEX}" ON "player_in_party" ("party_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "${INDEX}"`);
  }
}
