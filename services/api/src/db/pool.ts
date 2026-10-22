import pg from 'pg';
import { config } from '../config';

// Return NUMERIC as string (exact decimal) and keep timestamps as Date.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => v);
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });

export type Db = pg.Pool | pg.PoolClient;

export async function query<T extends pg.QueryResultRow = any>(text: string, params: unknown[] = [], db: Db = pool) {
  return db.query<T>(text, params);
}

export async function one<T extends pg.QueryResultRow = any>(text: string, params: unknown[] = [], db: Db = pool): Promise<T | undefined> {
  const r = await db.query<T>(text, params);
  return r.rows[0];
}

export async function tx<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Runs `sql` (which must not already contain LIMIT/OFFSET) as one page plus a total count. */
export async function paginate<T extends pg.QueryResultRow = any>(sql: string, params: unknown[], page: number, pageSize: number, db: Db = pool) {
  const total = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM (${sql}) AS counted`, params)).rows[0].n;
  const rows = (await db.query<T>(`${sql} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pageSize, (page - 1) * pageSize])).rows;
  return { rows, total, page, pageSize };
}
