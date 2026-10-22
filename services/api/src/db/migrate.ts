import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config';
import { pool } from './pool';

/** Applies database/schema/*.sql in filename order, recording each in schema_migrations. */
export async function migrate(log = true) {
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const applied = new Set((await pool.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  const files = fs.readdirSync(config.schemaDir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(config.schemaDir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      if (log) console.log(`[migrate] applied ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

export async function dropAll() {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('src/db/migrate.ts')) {
  migrate().then(() => pool.end()).catch((err) => { console.error(err); process.exit(1); });
}
