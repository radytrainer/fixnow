// Manages a project-local PostgreSQL cluster (database/.pgdata, port 5440) using an installed PostgreSQL.
// Usage: node scripts/local-db.mjs init|start|stop|status
// Set PG_BIN to your PostgreSQL bin folder if auto-detection fails. Alternative: docker compose up -d (see docker-compose.yml).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'database', '.pgdata');
const port = process.env.PGPORT_LOCAL ?? '5440';
const exe = process.platform === 'win32' ? '.exe' : '';

function findBin() {
  if (process.env.PG_BIN) return process.env.PG_BIN;
  const candidates = process.platform === 'win32'
    ? fs.existsSync('C:/Program Files/PostgreSQL') ? fs.readdirSync('C:/Program Files/PostgreSQL').sort((a, b) => Number(b) - Number(a)).map((v) => `C:/Program Files/PostgreSQL/${v}/bin`) : []
    : ['/usr/lib/postgresql/16/bin', '/usr/local/bin', '/opt/homebrew/bin', '/usr/bin'];
  const hit = candidates.find((d) => fs.existsSync(path.join(d, `pg_ctl${exe}`)));
  if (!hit) throw new Error('PostgreSQL binaries not found. Set PG_BIN or use docker compose.');
  return hit;
}

const bin = findBin();
const run = (tool, args) => execFileSync(path.join(bin, `${tool}${exe}`), args, { stdio: 'inherit' });
const cmd = process.argv[2] ?? 'status';

if (cmd === 'init') {
  if (fs.existsSync(dataDir)) { console.log('Cluster already exists at', dataDir); process.exit(0); }
  run('initdb', ['-D', dataDir, '-U', 'fixnow', '--auth=trust', '-E', 'UTF8', '--locale=C']);
  run('pg_ctl', ['-D', dataDir, '-o', `-p ${port}`, '-l', path.join(dataDir, 'server.log'), 'start', '-w']);
  run('psql', ['-h', 'localhost', '-p', port, '-U', 'fixnow', '-d', 'postgres', '-c', 'CREATE DATABASE fixnow', '-c', 'CREATE DATABASE fixnow_test']);
} else if (cmd === 'start') {
  run('pg_ctl', ['-D', dataDir, '-o', `-p ${port}`, '-l', path.join(dataDir, 'server.log'), 'start', '-w']);
} else if (cmd === 'stop') {
  run('pg_ctl', ['-D', dataDir, 'stop']);
} else {
  run('pg_ctl', ['-D', dataDir, 'status']);
}
