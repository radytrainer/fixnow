import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';

function bool(value: string | undefined, fallback: boolean) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes'].includes(value.toLowerCase());
}

const jwtSecret = process.env.JWT_SECRET ?? '';
if (!jwtSecret && isProduction) throw new Error('JWT_SECRET must be set in production');
if (!jwtSecret) console.warn('[config] JWT_SECRET not set; using an insecure development-only secret.');

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://fixnow@localhost:5440/fixnow',
  jwtSecret: jwtSecret || 'dev-only-insecure-secret-change-me',
  /** Demo mode enables seeded demo sign-in and shows OTP codes on screen instead of sending SMS. */
  demoMode: bool(process.env.DEMO_MODE, true),
  storageDir: path.resolve(process.env.STORAGE_DIR ?? path.join(here, '..', 'storage')),
  schemaDir: path.resolve(here, '..', '..', '..', 'database', 'schema'),
  corsOrigins: (process.env.CORS_ORIGINS ?? '*').split(',').map((s) => s.trim()),
  expirySweepMs: Number(process.env.EXPIRY_SWEEP_MS ?? 5000),
};
