import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config';
import { one, query } from '../db/pool';
import { signToken } from '../http/auth';
import { AppError, badRequest, forbidden, unauthorized } from '../http/errors';
import { rateLimit } from '../http/rateLimit';

export const authRouter = Router();

const phoneKey = (req: { body?: any }) => String(req.body?.phone ?? '').replace(/\D/g, '');
// Brute-force protection: per IP + phone for credential checks, per IP for code requests.
const adminLoginLimit = rateLimit({ name: 'admin-login', windowMs: 15 * 60_000, max: 10, key: phoneKey });
const otpVerifyLimit = rateLimit({ name: 'otp-verify', windowMs: 15 * 60_000, max: 20, key: phoneKey });
const otpRequestLimit = rateLimit({ name: 'otp-request', windowMs: 60 * 60_000, max: 30 });
const demoLoginLimit = rateLimit({ name: 'demo-login', windowMs: 60_000, max: 60 });

const phone = z.string().trim().transform((s) => s.replace(/[\s-]/g, '')).transform((s) => (s.startsWith('0') ? `+855${s.slice(1)}` : s))
  .pipe(z.string().regex(/^\+855[0-9]{8,9}$/, 'Phone must be a Cambodian number (+855)'));

const hashCode = (p: string, code: string) => crypto.createHmac('sha256', config.jwtSecret).update(`${p}|${code}`).digest('hex');

/** Lists seeded demo accounts so judges can sign in without SMS. Disabled when DEMO_MODE=false. */
authRouter.get('/demo-accounts', async (_req, res) => {
  if (!config.demoMode) throw forbidden('Demo mode is disabled');
  // Public-safe summary so presenters can tell accounts apart: specialty/area/rating for technicians,
  // area and open bookings for customers. Featured accounts first.
  const r = await query(
    `SELECT u.phone_e164, u.name, u.role, u.demo_rank, tp.status AS technician_status,
            coalesce(tp.service_area, cp.home_area) AS area,
            ARRAY(SELECT DISTINCT c.code FROM technician_services ts JOIN services s ON s.id = ts.service_id
                    JOIN service_categories c ON c.id = s.category_id WHERE ts.technician_id = tp.id ORDER BY c.code) AS categories,
            (SELECT round(avg(score)::numeric, 1) FROM ratings r WHERE r.technician_id = tp.id) AS rating,
            (SELECT count(*)::int FROM bookings b WHERE (b.customer_id = u.id OR b.technician_id = tp.id)
                AND b.status IN ('REQUESTED','ACCEPTED','CONFIRMED','FINISHED')) AS active_bookings
       FROM users u LEFT JOIN technician_profiles tp ON tp.user_id = u.id LEFT JOIN customer_profiles cp ON cp.user_id = u.id
      WHERE u.is_demo_account AND u.role <> 'ADMIN' AND u.is_active
      ORDER BY u.role, u.demo_rank NULLS LAST, u.name`,
  );
  res.json({
    items: r.rows.map((u) => ({
      phone: u.phone_e164, name: u.name, role: u.role, technicianStatus: u.technician_status, featured: u.demo_rank !== null,
      area: u.area, categories: u.categories, rating: u.rating === null ? null : Number(u.rating), activeBookings: u.active_bookings,
    })),
  });
});

authRouter.post('/demo-login', demoLoginLimit, async (req, res) => {
  if (!config.demoMode) throw forbidden('Demo mode is disabled');
  const body = z.object({ phone }).parse(req.body);
  const user = await one(`SELECT id, role FROM users WHERE phone_e164 = $1 AND is_demo_account AND is_active`, [body.phone]);
  if (!user || user.role === 'ADMIN') throw unauthorized('Not a demo account');
  res.json({ token: signToken(user.id, user.role), role: user.role });
});

authRouter.post('/otp/request', otpRequestLimit, async (req, res) => {
  const body = z.object({ phone }).parse(req.body);
  const recent = await one<{ n: number }>(
    `SELECT count(*)::int AS n FROM otp_codes WHERE phone_e164 = $1 AND created_at > now() - interval '15 minutes'`, [body.phone],
  );
  if ((recent?.n ?? 0) >= 5) throw new AppError(429, 'RATE_LIMITED', 'Too many codes requested. Try again in 15 minutes.');
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await query(`INSERT INTO otp_codes (phone_e164, code_hash, expires_at) VALUES ($1, $2, now() + interval '5 minutes')`, [body.phone, hashCode(body.phone, code)]);
  // No SMS provider is configured. In demo mode the code is returned to the client and labelled as simulated.
  if (config.demoMode) {
    res.json({ sent: false, simulated: true, demoCode: code, message: 'DEMO: SMS not sent. Use the code shown.' });
  } else {
    console.log(`[otp] SMS provider not configured; code for ${body.phone.slice(0, 6)}… generated`);
    res.json({ sent: false, simulated: false, message: 'SMS provider not configured' });
  }
});

authRouter.post('/otp/verify', otpVerifyLimit, async (req, res) => {
  const body = z.object({
    phone, code: z.string().regex(/^\d{6}$/),
    role: z.enum(['CUSTOMER', 'TECHNICIAN']).optional(),
    name: z.string().trim().min(1).max(80).optional(),
  }).parse(req.body);
  const otp = await one(
    `SELECT * FROM otp_codes WHERE phone_e164 = $1 AND consumed_at IS NULL AND expires_at > now() ORDER BY created_at DESC LIMIT 1`,
    [body.phone],
  );
  if (!otp) throw unauthorized('Code expired. Request a new one.');
  if (otp.attempts >= 5) throw new AppError(429, 'RATE_LIMITED', 'Too many attempts. Request a new code.');
  if (otp.code_hash !== hashCode(body.phone, body.code)) {
    await query(`UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1`, [otp.id]);
    throw unauthorized('Incorrect code');
  }
  let user = await one(`SELECT id, role, is_active FROM users WHERE phone_e164 = $1`, [body.phone]);
  if (user?.role === 'ADMIN') throw forbidden('Admins sign in on the admin dashboard');
  if (user && !user.is_active) throw forbidden('Account is disabled');
  // Ask a new number for its role before consuming the code, so the same code can be resubmitted with a role.
  if (!user && !body.role) throw badRequest('New account: choose CUSTOMER or TECHNICIAN', { needsRole: true });
  const consumed = await query(`UPDATE otp_codes SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL`, [otp.id]);
  if (consumed.rowCount !== 1) throw unauthorized('Code already used. Request a new one.');
  let isNew = false;
  if (!user) {
    // One role per phone number. The server only ever creates CUSTOMER or TECHNICIAN here.
    user = await one(`INSERT INTO users (phone_e164, role, name) VALUES ($1, $2, $3) RETURNING id, role`, [body.phone, body.role, body.name ?? null]);
    if (body.role === 'CUSTOMER') await query(`INSERT INTO customer_profiles (user_id) VALUES ($1)`, [user.id]);
    isNew = true;
  }
  res.json({ token: signToken(user.id, user.role), role: user.role, isNew });
});

authRouter.post('/admin-login', adminLoginLimit, async (req, res) => {
  const body = z.object({ phone, password: z.string().min(1).max(200) }).parse(req.body);
  const user = await one(`SELECT id, role, password_hash, is_active FROM users WHERE phone_e164 = $1`, [body.phone]);
  const ok = user?.password_hash ? await bcrypt.compare(body.password, user.password_hash) : false;
  if (!user || !ok || user.role !== 'ADMIN' || !user.is_active) throw unauthorized('Invalid admin credentials');
  res.json({ token: signToken(user.id, 'ADMIN'), role: 'ADMIN' });
});
