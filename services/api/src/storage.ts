import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { MAX_UPLOAD_BYTES } from '@fixnow/shared';
import { config } from './config';
import { badRequest } from './http/errors';

/**
 * Private local object storage. Files are never served by a public path: callers
 * receive a short-lived HMAC-signed URL, issued only after an authorization check.
 */

export const ALLOWED_MIME: Record<string, { ext: string; mediaType: 'PHOTO' | 'VIDEO' }> = {
  'image/jpeg': { ext: 'jpg', mediaType: 'PHOTO' },
  'image/png': { ext: 'png', mediaType: 'PHOTO' },
  'image/webp': { ext: 'webp', mediaType: 'PHOTO' },
  'video/mp4': { ext: 'mp4', mediaType: 'VIDEO' },
  'video/quicktime': { ext: 'mov', mediaType: 'VIDEO' },
  'application/pdf': { ext: 'pdf', mediaType: 'PHOTO' },
};

const SIGNED_URL_TTL_SECONDS = 15 * 60;

export function saveBase64(base64: string, mimeType: string) {
  const allowed = ALLOWED_MIME[mimeType];
  if (!allowed) throw badRequest(`Unsupported file type ${mimeType}`);
  const data = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ''), 'base64');
  if (data.length === 0) throw badRequest('Empty file');
  if (data.length > MAX_UPLOAD_BYTES) throw badRequest(`File exceeds ${MAX_UPLOAD_BYTES / 1024 / 1024} MB limit`);
  const key = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${allowed.ext}`;
  const full = path.join(config.storageDir, key);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, data);
  return { key, size: data.length, mediaType: allowed.mediaType };
}

function sign(key: string, exp: number) {
  return crypto.createHmac('sha256', config.jwtSecret).update(`${key}|${exp}`).digest('base64url');
}

/** Relative URL (prefix with the API origin on clients). */
export function signedUrl(key: string | null | undefined) {
  if (!key) return null;
  const exp = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS;
  return `/api/files/${key}?exp=${exp}&sig=${sign(key, exp)}`;
}

export function resolveSigned(key: string, exp: string, sig: string) {
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum < Date.now() / 1000) return null;
  const expected = sign(key, expNum);
  if (expected.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  const full = path.resolve(config.storageDir, key);
  if (!full.startsWith(config.storageDir + path.sep) || !fs.existsSync(full)) return null;
  return full;
}

export function clearStorage() {
  fs.rmSync(config.storageDir, { recursive: true, force: true });
}
