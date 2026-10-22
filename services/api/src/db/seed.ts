import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import { DEMO_ADMIN, seedDemo } from '../../../../database/seed/demo-seed';
import { config } from '../config';
import { clearStorage } from '../storage';
import { dropAll, migrate } from './migrate';
import { pool } from './pool';

/** Drops everything, re-applies migrations and loads the demo scenario. Never run against production. */
export async function resetAndSeed(log = true) {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to reset a production database');
  await dropAll();
  await migrate(log);
  clearStorage();
  const makeDocument = async (label: string) => {
    // Placeholder document image (a QR encoding the label) so admin review has a real private file to open.
    const key = `seed/${label.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase()}.png`;
    const full = path.join(config.storageDir, key);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, await QRCode.toBuffer(label, { width: 240 }));
    return key;
  };
  const ids = await seedDemo((text, params) => pool.query(text, params), {
    adminPasswordHash: await bcrypt.hash(DEMO_ADMIN.password, 10), makeDocument,
  });
  if (log) console.log('[seed] demo data loaded. Admin:', DEMO_ADMIN.phone, '/', DEMO_ADMIN.password);
  return ids;
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('src/db/seed.ts')) {
  resetAndSeed().then(() => pool.end()).catch((err) => { console.error(err); process.exit(1); });
}
