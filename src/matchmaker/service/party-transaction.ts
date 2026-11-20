import { DataSource, EntityManager } from "typeorm";

export const partyTransaction = <T>(
  ds: DataSource,
  partyId: string,
  work: (em: EntityManager) => Promise<T>,
): Promise<T> =>
  ds.transaction(async (em) => {
    await em.query(`SELECT 1 FROM party WHERE id = $1 FOR UPDATE`, [partyId]);
    return work(em);
  });
