import { Router } from 'express';
import { z } from 'zod';
import { AREA_CODES, MAX_TECHNICIAN_DISTANCE_KM, SERVICE_AREAS, distanceKm, findArea, fromCents, toCents, type EarningsDto, type PublicTechnician } from '@fixnow/shared';
import { audit } from '../audit';
import { one, query, tx } from '../db/pool';
import { authenticate, currentUser, requireRole } from '../http/auth';
import { badRequest, conflict, forbidden, notFound } from '../http/errors';
import { signedUrl } from '../storage';
import { loadMe } from './me';

export const techniciansRouter = Router();
techniciansRouter.use(authenticate);

const PUBLIC_TECH_SELECT = `
  SELECT tp.id, u.name, tp.public_photo_key, tp.bio, tp.years_experience, tp.service_area, tp.certificate_summary,
         tp.base_lat, tp.base_lng, tp.is_available,
         (SELECT round(avg(score)::numeric, 2) FROM ratings r WHERE r.technician_id = tp.id) AS rating_avg,
         (SELECT count(*) FROM ratings r WHERE r.technician_id = tp.id) AS rating_count,
         (SELECT count(*) FROM bookings b WHERE b.technician_id = tp.id AND b.status IN ('PAID','RATED','CLOSED')) AS jobs_completed,
         ARRAY(SELECT ts.service_id FROM technician_services ts WHERE ts.technician_id = tp.id) AS service_ids
    FROM technician_profiles tp JOIN users u ON u.id = tp.user_id`;

function toPublicTechnician(t: any, from?: { lat: number; lng: number }): PublicTechnician {
  return {
    id: t.id, name: t.name ?? 'Technician', photoUrl: signedUrl(t.public_photo_key), bio: t.bio,
    yearsExperience: t.years_experience, serviceArea: t.service_area, certificateSummary: t.certificate_summary,
    ratingAvg: t.rating_avg === null ? null : Number(t.rating_avg), ratingCount: Number(t.rating_count),
    jobsCompleted: Number(t.jobs_completed), serviceIds: t.service_ids, isAvailable: t.is_available,
    distanceKm: from && t.base_lat !== null ? distanceKm(from.lat, from.lng, Number(t.base_lat), Number(t.base_lng)) : null,
  };
}

/** Customer discovery: approved, available technicians who offer the requested service. */
techniciansRouter.get('/technicians', requireRole('CUSTOMER', 'ADMIN'), async (req, res) => {
  const q = z.object({
    serviceId: z.uuid().optional(),
    serviceIds: z.string().optional().transform((v) => (v ? v.split(',').filter(Boolean) : [])).pipe(z.array(z.uuid()).max(5)),
    area: z.string().optional(),
    lat: z.coerce.number().optional(), lng: z.coerce.number().optional(),
    excludeId: z.uuid().optional(),
  }).parse(req.query);
  const params: unknown[] = [];
  const where = [`tp.status = 'APPROVED'`, `tp.is_available`, `u.is_active`];
  const wanted = [...new Set([...(q.serviceId ? [q.serviceId] : []), ...q.serviceIds])];
  if (wanted.length) {
    params.push(wanted, wanted.length);
    where.push(`(SELECT count(*) FROM technician_services ts WHERE ts.technician_id = tp.id AND ts.service_id = ANY($${params.length - 1}::uuid[])) = $${params.length}`);
  }
  if (q.excludeId) { params.push(q.excludeId); where.push(`tp.id <> $${params.length}`); }
  const rows = (await query(`${PUBLIC_TECH_SELECT} WHERE ${where.join(' AND ')}`, params)).rows;
  const areaCenter = findArea(q.area) ?? SERVICE_AREAS.find((a) => a.name_en === q.area);
  const from = q.lat !== undefined && q.lng !== undefined ? { lat: q.lat, lng: q.lng } : areaCenter ? { lat: areaCenter.lat, lng: areaCenter.lng } : undefined;
  // When we know where the job is, only offer technicians who can realistically get there.
  const items = rows.map((r) => toPublicTechnician(r, from))
    .filter((t) => !from || t.distanceKm === null || t.distanceKm <= MAX_TECHNICIAN_DISTANCE_KM)
    .sort((a, b) =>
    (a.distanceKm ?? 999) - (b.distanceKm ?? 999) || (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0));
  res.json({ items });
});

techniciansRouter.get('/technicians/:id', requireRole('CUSTOMER', 'ADMIN'), async (req, res) => {
  const t = await one(`${PUBLIC_TECH_SELECT} WHERE tp.id = $1 AND tp.status = 'APPROVED'`, [req.params.id]);
  if (!t) throw notFound('Technician');
  const reviews = (await query(
    `SELECT r.score, r.comment, r.created_at, cu.name AS customer_name FROM ratings r JOIN users cu ON cu.id = r.customer_id
      WHERE r.technician_id = $1 ORDER BY r.created_at DESC LIMIT 10`, [t.id],
  )).rows.map((r) => ({
    score: r.score, comment: r.comment, createdAt: r.created_at,
    // first name + initial only
    customerName: (r.customer_name ?? 'Customer').split(' ')[0],
  }));
  res.json({ ...toPublicTechnician(t), reviews });
});

/** Technician onboarding (or re-submission after rejection). Status is always set to PENDING by the server. */
techniciansRouter.post('/technicians/register', requireRole('TECHNICIAN'), async (req, res) => {
  const user = currentUser(req);
  const body = z.object({
    name: z.string().trim().min(2).max(80),
    bio: z.string().trim().max(500).optional().default(''),
    yearsExperience: z.number().int().min(0).max(60),
    serviceArea: z.enum(AREA_CODES),
    serviceIds: z.array(z.uuid()).min(1, 'Choose at least one service'),
    certificateSummary: z.string().trim().max(300).optional().default(''),
    idDocumentNumber: z.string().trim().min(4).max(40),
    idDocumentMediaId: z.uuid(),
    certificateMediaId: z.uuid().optional(),
    photoMediaId: z.uuid().optional(),
  }).parse(req.body);

  await tx(async (db) => {
    const existing = (await db.query(`SELECT * FROM technician_profiles WHERE user_id = $1 FOR UPDATE`, [user.id])).rows[0];
    if (existing && ['APPROVED', 'SUSPENDED'].includes(existing.status)) throw conflict('ALREADY_REVIEWED', 'Profile already reviewed; contact support to change verified details');
    const services = (await db.query(`SELECT id FROM services WHERE id = ANY($1) AND status = 'ACTIVE'`, [body.serviceIds])).rows;
    if (services.length !== body.serviceIds.length) throw badRequest('One or more services are not active');
    const media = async (id: string | undefined, purpose: string) => {
      if (!id) return null;
      const m = (await db.query(`SELECT storage_key FROM booking_media WHERE id = $1 AND uploaded_by = $2 AND purpose = $3`, [id, user.id, purpose])).rows[0];
      if (!m) throw badRequest(`Upload ${purpose} not found`);
      return m.storage_key as string;
    };
    const idKey = await media(body.idDocumentMediaId, 'ID_DOCUMENT');
    const certKey = await media(body.certificateMediaId, 'CERTIFICATE');
    const photoKey = await media(body.photoMediaId, 'PROFILE_PHOTO');
    const area = findArea(body.serviceArea)!;
    await db.query(`UPDATE users SET name = $2, updated_at = now() WHERE id = $1`, [user.id, body.name]);
    const profile = (await db.query(
      `INSERT INTO technician_profiles (user_id, bio, years_experience, service_area, base_lat, base_lng, certificate_summary,
                                        id_document_number, id_document_key, certificate_key, public_photo_key, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'PENDING')
       ON CONFLICT (user_id) DO UPDATE SET bio = EXCLUDED.bio, years_experience = EXCLUDED.years_experience,
         service_area = EXCLUDED.service_area, base_lat = EXCLUDED.base_lat, base_lng = EXCLUDED.base_lng,
         certificate_summary = EXCLUDED.certificate_summary, id_document_number = EXCLUDED.id_document_number,
         id_document_key = EXCLUDED.id_document_key,
         certificate_key = COALESCE(EXCLUDED.certificate_key, technician_profiles.certificate_key),
         public_photo_key = COALESCE(EXCLUDED.public_photo_key, technician_profiles.public_photo_key),
         status = 'PENDING', rejection_reason = NULL, reviewed_by = NULL, reviewed_at = NULL, updated_at = now()
       RETURNING id, status`,
      [user.id, body.bio, body.yearsExperience, body.serviceArea, area.lat, area.lng, body.certificateSummary,
        body.idDocumentNumber, idKey, certKey, photoKey],
    )).rows[0];
    await db.query(`DELETE FROM technician_services WHERE technician_id = $1`, [profile.id]);
    await db.query(`INSERT INTO technician_services (technician_id, service_id) SELECT $1, unnest($2::uuid[])`, [profile.id, body.serviceIds]);
    await audit(db, user.id, existing ? 'TECHNICIAN_RESUBMITTED' : 'TECHNICIAN_REGISTERED', 'technician_profile', profile.id,
      existing ? { status: existing.status } : null, { status: 'PENDING' });
  });
  res.status(201).json(await loadMe(user.id));
});

/** Technician self-service edits that do not require re-verification. */
techniciansRouter.patch('/technician/profile', requireRole('TECHNICIAN'), async (req, res) => {
  const user = currentUser(req);
  const body = z.object({
    isAvailable: z.boolean().optional(),
    bio: z.string().trim().max(500).optional(),
    photoMediaId: z.uuid().optional(),
  }).strict().parse(req.body);
  if (!user.technicianId) throw forbidden('Complete registration first');
  let photoKey: string | null = null;
  if (body.photoMediaId) {
    const m = await one(`SELECT storage_key FROM booking_media WHERE id = $1 AND uploaded_by = $2 AND purpose = 'PROFILE_PHOTO'`, [body.photoMediaId, user.id]);
    if (!m) throw badRequest('Upload PROFILE_PHOTO not found');
    photoKey = m.storage_key;
  }
  await query(
    `UPDATE technician_profiles SET is_available = COALESCE($2, is_available), bio = COALESCE($3, bio),
            public_photo_key = COALESCE($4, public_photo_key), updated_at = now() WHERE id = $1`,
    [user.technicianId, body.isAvailable ?? null, body.bio ?? null, photoKey],
  );
  res.json(await loadMe(user.id));
});

techniciansRouter.get('/technician/earnings', requireRole('TECHNICIAN'), async (req, res) => {
  const user = currentUser(req);
  if (!user.technicianId) throw forbidden('Complete registration first');
  const rows = (await query(
    `SELECT b.id AS booking_id, b.booking_code, s.name_en, s.name_km, p.confirmed_at, p.amount, p.commission_rate,
            p.commission_amount, p.technician_net, p.is_demo, p.status AS payment_status, po.status AS payout_status
       FROM payments p JOIN bookings b ON b.id = p.booking_id JOIN booking_service_summary s ON s.booking_id = b.id
       LEFT JOIN payouts po ON po.payment_id = p.id
      WHERE b.technician_id = $1 AND p.status = 'PAID' ORDER BY p.confirmed_at DESC`, [user.technicianId],
  )).rows;
  const payouts = (await query(`SELECT * FROM payouts WHERE technician_id = $1 ORDER BY created_at DESC`, [user.technicianId])).rows;
  const rate = await one(`SELECT value_json FROM app_settings WHERE key = 'commission_rate'`);
  const sum = (xs: string[]) => fromCents(xs.reduce((a, x) => a + toCents(x), 0));
  const body: EarningsDto = {
    totals: {
      gross: sum(rows.map((r) => r.amount)), commission: sum(rows.map((r) => r.commission_amount)), net: sum(rows.map((r) => r.technician_net)),
      paidOut: sum(payouts.filter((p) => p.status === 'PAID').map((p) => p.amount)),
      pendingPayout: sum(payouts.filter((p) => p.status === 'PENDING' || p.status === 'PROCESSING').map((p) => p.amount)),
      jobs: rows.length,
    },
    commissionRate: String(rate?.value_json ?? '15'),
    items: rows.map((r) => ({
      bookingId: r.booking_id, bookingCode: r.booking_code, serviceNameEn: r.name_en, serviceNameKm: r.name_km,
      paidAt: r.confirmed_at?.toISOString() ?? null, gross: r.amount, commissionRate: r.commission_rate,
      commission: r.commission_amount, net: r.technician_net, payoutStatus: r.payout_status, isDemo: r.is_demo,
    })),
    payouts: payouts.map((p) => ({
      id: p.id, amount: p.amount, status: p.status, method: p.method, reference: p.reference,
      paidAt: p.paid_at?.toISOString() ?? null, createdAt: p.created_at.toISOString(),
    })),
  };
  res.json(body);
});

techniciansRouter.get('/technician/reviews', requireRole('TECHNICIAN'), async (req, res) => {
  const user = currentUser(req);
  const rows = (await query(
    `SELECT r.score, r.comment, r.created_at, b.booking_code, cu.name AS customer_name
       FROM ratings r JOIN bookings b ON b.id = r.booking_id JOIN users cu ON cu.id = r.customer_id
      WHERE r.technician_id = $1 ORDER BY r.created_at DESC`, [user.technicianId],
  )).rows;
  const avg = rows.length ? Math.round((rows.reduce((a, r) => a + r.score, 0) / rows.length) * 100) / 100 : null;
  res.json({
    average: avg, count: rows.length,
    items: rows.map((r) => ({ score: r.score, comment: r.comment, createdAt: r.created_at, bookingCode: r.booking_code, customerName: (r.customer_name ?? 'Customer').split(' ')[0] })),
  });
});
