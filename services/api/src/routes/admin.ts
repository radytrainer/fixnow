import { Router, type Response } from 'express';
import { z } from 'zod';
import { PAYOUT_STATUSES, TECHNICIAN_STATUSES, TICKET_STATUSES, fromCents, toCents } from '@fixnow/shared';
import { audit } from '../audit';
import { one, paginate, pool, query, tx } from '../db/pool';
import { expireOverdueBookings } from '../domain/bookings';
import { authenticate, currentUser, maskPhone, requireRole } from '../http/auth';
import { badRequest, conflict, notFound } from '../http/errors';
import { signedUrl } from '../storage';
import { notify, notifyBooking } from '../domain/notify';
import { loadCatalog, toServiceDto } from './catalog';

export const adminRouter = Router();
adminRouter.use('/admin', authenticate, requireRole('ADMIN'));

const page = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});

// ---------- Technicians ----------

adminRouter.get('/admin/technicians', async (req, res) => {
  const q = page.extend({ status: z.enum(TECHNICIAN_STATUSES).optional(), q: z.string().trim().max(60).optional() }).parse(req.query);
  const params: unknown[] = [];
  const where: string[] = [];
  if (q.status) { params.push(q.status); where.push(`tp.status = $${params.length}`); }
  if (q.q) { params.push(`%${q.q}%`); where.push(`(u.name ILIKE $${params.length})`); }
  const { rows, total } = await paginate(
    `SELECT tp.*, u.name, u.phone_e164, u.is_active, u.created_at AS user_created_at,
            (SELECT round(avg(score)::numeric,2) FROM ratings r WHERE r.technician_id = tp.id) AS rating_avg,
            (SELECT count(*) FROM bookings b WHERE b.technician_id = tp.id) AS booking_count,
            ARRAY(SELECT s.name_en FROM technician_services ts JOIN services s ON s.id = ts.service_id WHERE ts.technician_id = tp.id) AS services
       FROM technician_profiles tp JOIN users u ON u.id = tp.user_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY (tp.status = 'PENDING') DESC, tp.created_at DESC`, params, q.page, q.pageSize,
  );
  res.json({
    total, page: q.page, pageSize: q.pageSize,
    items: rows.map((t) => ({
      id: t.id, userId: t.user_id, name: t.name, phoneMasked: maskPhone(t.phone_e164), status: t.status, isAvailable: t.is_available,
      isActive: t.is_active, serviceArea: t.service_area, yearsExperience: t.years_experience, services: t.services,
      ratingAvg: t.rating_avg === null ? null : Number(t.rating_avg), bookingCount: Number(t.booking_count), createdAt: t.created_at,
      reviewedAt: t.reviewed_at,
    })),
  });
});

adminRouter.get('/admin/technicians/:id', async (req, res) => {
  const t = await one(
    `SELECT tp.*, u.name, u.phone_e164, u.is_active, ru.name AS reviewed_by_name,
            ARRAY(SELECT s.name_en FROM technician_services ts JOIN services s ON s.id = ts.service_id WHERE ts.technician_id = tp.id) AS services
       FROM technician_profiles tp JOIN users u ON u.id = tp.user_id LEFT JOIN users ru ON ru.id = tp.reviewed_by WHERE tp.id = $1`,
    [req.params.id],
  );
  if (!t) throw notFound('Technician');
  // Verification needs the phone and documents; only admins reach this endpoint.
  res.json({
    id: t.id, userId: t.user_id, name: t.name, phone: t.phone_e164, status: t.status, isAvailable: t.is_available, isActive: t.is_active,
    bio: t.bio, yearsExperience: t.years_experience, serviceArea: t.service_area, services: t.services,
    certificateSummary: t.certificate_summary, idDocumentNumber: t.id_document_number,
    idDocumentUrl: signedUrl(t.id_document_key), certificateUrl: signedUrl(t.certificate_key), photoUrl: signedUrl(t.public_photo_key),
    rejectionReason: t.rejection_reason, reviewedBy: t.reviewed_by_name, reviewedAt: t.reviewed_at, createdAt: t.created_at,
  });
});

const techTransitions = {
  approve: { from: ['PENDING', 'REJECTED'], to: 'APPROVED' },
  reject: { from: ['PENDING'], to: 'REJECTED' },
  suspend: { from: ['APPROVED'], to: 'SUSPENDED' },
  reinstate: { from: ['SUSPENDED'], to: 'APPROVED' },
} as const;

adminRouter.post('/admin/technicians/:id/:action', async (req, res) => {
  const admin = currentUser(req);
  const action = z.enum(['approve', 'reject', 'suspend', 'reinstate']).parse(req.params.action);
  const { reason } = z.object({ reason: z.string().trim().max(300).optional() }).parse(req.body ?? {});
  if ((action === 'reject' || action === 'suspend') && !reason) throw badRequest('A reason is required');
  const { from, to } = techTransitions[action];
  const result = await tx(async (db) => {
    const before = (await db.query(`SELECT id, status FROM technician_profiles WHERE id = $1 FOR UPDATE`, [req.params.id])).rows[0];
    if (!before) throw notFound('Technician');
    if (!(from as readonly string[]).includes(before.status)) throw conflict('INVALID_STATE', `Cannot ${action} a technician who is ${before.status}`);
    const after = (await db.query(
      `UPDATE technician_profiles SET status = $2, rejection_reason = $3, reviewed_by = $4, reviewed_at = now(), updated_at = now()
        WHERE id = $1 RETURNING id, status`,
      [before.id, to, action === 'reject' || action === 'suspend' ? reason : null, admin.id],
    )).rows[0];
    await audit(db, admin.id, `TECHNICIAN_${to}`, 'technician_profile', before.id, { status: before.status }, { status: to, reason: reason ?? null });
    const typeMap = { approve: 'TECHNICIAN_APPROVED', reject: 'TECHNICIAN_REJECTED', suspend: 'TECHNICIAN_SUSPENDED', reinstate: 'TECHNICIAN_REINSTATED' } as const;
    const owner = (await db.query(`SELECT user_id FROM technician_profiles WHERE id = $1`, [before.id])).rows[0];
    await notify(db, owner.user_id, typeMap[action], { reason: reason ?? null });
    return after;
  });
  res.json(result);
});

// ---------- Customers / users ----------

adminRouter.get('/admin/customers', async (req, res) => {
  const q = page.extend({ q: z.string().trim().max(60).optional() }).parse(req.query);
  const params: unknown[] = [];
  let where = `WHERE u.role = 'CUSTOMER'`;
  if (q.q) { params.push(`%${q.q}%`); where += ` AND u.name ILIKE $1`; }
  const { rows, total } = await paginate(
    `SELECT u.id, u.name, u.phone_e164, u.is_active, u.created_at, u.preferred_language, cp.home_area,
            (SELECT count(*) FROM bookings b WHERE b.customer_id = u.id) AS booking_count,
            (SELECT coalesce(sum(p.amount),0) FROM payments p JOIN bookings b ON b.id = p.booking_id WHERE b.customer_id = u.id AND p.status = 'PAID') AS total_paid
       FROM users u LEFT JOIN customer_profiles cp ON cp.user_id = u.id ${where} ORDER BY u.created_at DESC`, params, q.page, q.pageSize,
  );
  res.json({
    total, page: q.page, pageSize: q.pageSize,
    items: rows.map((c) => ({
      id: c.id, name: c.name, phoneMasked: maskPhone(c.phone_e164), isActive: c.is_active, createdAt: c.created_at,
      language: c.preferred_language, homeArea: c.home_area, bookingCount: Number(c.booking_count), totalPaid: fromCents(toCents(c.total_paid)),
    })),
  });
});

/** Reveals a full phone number for an operational need; every reveal is audited. */
adminRouter.post('/admin/users/:id/reveal-phone', async (req, res) => {
  const admin = currentUser(req);
  const u = await one(`SELECT id, phone_e164, role FROM users WHERE id = $1`, [req.params.id]);
  if (!u) throw notFound('User');
  await audit(pool, admin.id, 'PHONE_REVEALED', 'user', u.id, null, { role: u.role });
  res.json({ phone: u.phone_e164 });
});

adminRouter.post('/admin/users/:id/active', async (req, res) => {
  const admin = currentUser(req);
  const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
  const result = await tx(async (db) => {
    const before = (await db.query(`SELECT id, role, is_active FROM users WHERE id = $1 FOR UPDATE`, [req.params.id])).rows[0];
    if (!before) throw notFound('User');
    if (before.role === 'ADMIN') throw badRequest('Admin accounts cannot be disabled here');
    await db.query(`UPDATE users SET is_active = $2, updated_at = now() WHERE id = $1`, [before.id, isActive]);
    await audit(db, admin.id, isActive ? 'USER_ENABLED' : 'USER_DISABLED', 'user', before.id, { isActive: before.is_active }, { isActive });
    return { id: before.id, isActive };
  });
  res.json(result);
});

// ---------- Bookings (admin-only actions; listing uses GET /api/bookings) ----------

adminRouter.get('/admin/bookings/:id/timeline', async (req, res) => {
  const b = await one(
    `SELECT b.*, cu.name AS customer_name, cu.phone_e164 AS customer_phone, tu.name AS technician_name, tu.phone_e164 AS technician_phone
       FROM bookings b JOIN users cu ON cu.id = b.customer_id JOIN technician_profiles tp ON tp.id = b.technician_id JOIN users tu ON tu.id = tp.user_id
      WHERE b.id = $1`, [req.params.id],
  );
  if (!b) throw notFound('Booking');
  const logs = (await query(
    `SELECT a.*, u.name AS actor_name FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id
      WHERE (a.entity_type = 'booking' AND a.entity_id = $1::text)
         OR (a.entity_type IN ('payment','payout') AND a.entity_id IN (
              SELECT p.id::text FROM payments p WHERE p.booking_id = $1::uuid
              UNION SELECT po.id::text FROM payouts po JOIN payments p ON p.id = po.payment_id WHERE p.booking_id = $1::uuid))
      ORDER BY a.created_at`, [b.id],
  )).rows;
  const events = [
    { at: b.created_at, label: 'Request created', detail: `Deadline ${new Date(b.response_deadline_at).toISOString()}` },
    b.accepted_at && { at: b.accepted_at, label: 'Accepted by technician' },
    b.declined_at && { at: b.declined_at, label: 'Declined by technician' },
    b.expired_at && { at: b.expired_at, label: 'Expired (no response in 5 minutes)' },
    b.started_at && { at: b.started_at, label: 'Job started' },
    b.finished_at && { at: b.finished_at, label: 'Marked finished', detail: b.final_amount ? `Amount $${b.final_amount}` : undefined },
    b.paid_at && { at: b.paid_at, label: 'Payment confirmed' },
    b.cancelled_at && { at: b.cancelled_at, label: 'Cancelled', detail: b.cancel_reason ?? undefined },
    ...logs.map((l) => ({ at: l.created_at, label: l.action, detail: `by ${l.actor_name ?? 'system'}` })),
  ].filter(Boolean).sort((x: any, y: any) => new Date(x.at).getTime() - new Date(y.at).getTime());
  res.json({
    customer: { id: b.customer_id, name: b.customer_name, phoneMasked: maskPhone(b.customer_phone) },
    technician: { id: b.technician_id, name: b.technician_name, phoneMasked: maskPhone(b.technician_phone) },
    events,
  });
});

adminRouter.post('/admin/bookings/:id/:action', async (req, res) => {
  const admin = currentUser(req);
  const action = z.enum(['dispute', 'close']).parse(req.params.action);
  const { reason } = z.object({ reason: z.string().trim().max(300).optional() }).parse(req.body ?? {});
  const map = {
    dispute: { from: ['ACCEPTED', 'CONFIRMED', 'FINISHED', 'PAID', 'RATED'], to: 'DISPUTED' },
    close: { from: ['PAID', 'RATED', 'DISPUTED', 'CUSTOMER_NOT_AVAILABLE'], to: 'CLOSED' },
  } as const;
  const { from, to } = map[action];
  const r = await tx(async (db) => {
    const before = (await db.query(`SELECT id, status FROM bookings WHERE id = $1 FOR UPDATE`, [req.params.id])).rows[0];
    if (!before) throw notFound('Booking');
    if (!(from as readonly string[]).includes(before.status)) throw conflict('INVALID_STATE', `Cannot ${action} a booking that is ${before.status}`);
    await db.query(`UPDATE bookings SET status = $2, updated_at = now() WHERE id = $1`, [before.id, to]);
    await audit(db, admin.id, `BOOKING_${to}`, 'booking', before.id, { status: before.status }, { status: to, reason: reason ?? null });
    return { id: before.id, status: to };
  });
  if (action === 'dispute') await notifyBooking(r.id, 'both', 'BOOKING_DISPUTED');
  res.json(r);
});

// ---------- Services catalogue ----------

adminRouter.get('/admin/services', async (_req, res) => {
  res.json({ items: await loadCatalog(true) });
});

const priceSchema = z.string().regex(/^\d{1,6}(\.\d{1,2})?$/).nullable();
const serviceSchema = z.object({
  categoryId: z.uuid(),
  nameEn: z.string().trim().min(2).max(80), nameKm: z.string().trim().min(1).max(80),
  descriptionEn: z.string().trim().max(500).nullable().optional(), descriptionKm: z.string().trim().max(500).nullable().optional(),
  minPrice: priceSchema.optional(), maxPrice: priceSchema.optional(),
  status: z.enum(['ACTIVE', 'COMING_SOON']),
});

function checkRange(min?: string | null, max?: string | null) {
  if (min && max && toCents(min) > toCents(max)) throw badRequest('Minimum price cannot exceed maximum price');
}

adminRouter.post('/admin/services', async (req, res) => {
  const admin = currentUser(req);
  const b = serviceSchema.parse(req.body);
  checkRange(b.minPrice, b.maxPrice);
  const row = await tx(async (db) => {
    const s = (await db.query(
      `INSERT INTO services (category_id, name_en, name_km, description_en, description_km, min_price, max_price, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [b.categoryId, b.nameEn, b.nameKm, b.descriptionEn ?? null, b.descriptionKm ?? null, b.minPrice ?? null, b.maxPrice ?? null, b.status],
    )).rows[0];
    await audit(db, admin.id, 'SERVICE_CREATED', 'service', s.id, null, toServiceDto(s));
    return s;
  });
  res.status(201).json(toServiceDto(row));
});

adminRouter.patch('/admin/services/:id', async (req, res) => {
  const admin = currentUser(req);
  const b = serviceSchema.partial().parse(req.body);
  const row = await tx(async (db) => {
    const before = (await db.query(`SELECT * FROM services WHERE id = $1 FOR UPDATE`, [req.params.id])).rows[0];
    if (!before) throw notFound('Service');
    const merged = {
      category_id: b.categoryId ?? before.category_id, name_en: b.nameEn ?? before.name_en, name_km: b.nameKm ?? before.name_km,
      description_en: b.descriptionEn !== undefined ? b.descriptionEn : before.description_en,
      description_km: b.descriptionKm !== undefined ? b.descriptionKm : before.description_km,
      min_price: b.minPrice !== undefined ? b.minPrice : before.min_price, max_price: b.maxPrice !== undefined ? b.maxPrice : before.max_price,
      status: b.status ?? before.status,
    };
    checkRange(merged.min_price, merged.max_price);
    const s = (await db.query(
      `UPDATE services SET category_id=$2, name_en=$3, name_km=$4, description_en=$5, description_km=$6, min_price=$7, max_price=$8, status=$9, updated_at=now()
        WHERE id = $1 RETURNING *`,
      [before.id, merged.category_id, merged.name_en, merged.name_km, merged.description_en, merged.description_km, merged.min_price, merged.max_price, merged.status],
    )).rows[0];
    await audit(db, admin.id, 'SERVICE_UPDATED', 'service', s.id, toServiceDto(before), toServiceDto(s));
    return s;
  });
  res.json(toServiceDto(row));
});

adminRouter.patch('/admin/categories/:id', async (req, res) => {
  const admin = currentUser(req);
  const b = z.object({
    nameEn: z.string().trim().min(2).max(80).optional(), nameKm: z.string().trim().min(1).max(80).optional(),
    status: z.enum(['ACTIVE', 'COMING_SOON']).optional(), sortOrder: z.number().int().optional(),
  }).parse(req.body);
  const r = await tx(async (db) => {
    const before = (await db.query(`SELECT * FROM service_categories WHERE id = $1 FOR UPDATE`, [req.params.id])).rows[0];
    if (!before) throw notFound('Category');
    const after = (await db.query(
      `UPDATE service_categories SET name_en = COALESCE($2, name_en), name_km = COALESCE($3, name_km), status = COALESCE($4, status),
              sort_order = COALESCE($5, sort_order) WHERE id = $1 RETURNING *`,
      [before.id, b.nameEn ?? null, b.nameKm ?? null, b.status ?? null, b.sortOrder ?? null],
    )).rows[0];
    await audit(db, admin.id, 'CATEGORY_UPDATED', 'service_category', before.id, before, after);
    return after;
  });
  res.json({ id: r.id, status: r.status });
});

// ---------- Payments & payouts ----------

adminRouter.get('/admin/payments', async (req, res) => {
  const q = page.extend({ status: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']).optional(), q: z.string().trim().max(40).optional() }).parse(req.query);
  const params: unknown[] = [];
  let where = '';
  if (q.status) { params.push(q.status); where = `WHERE p.status = $1`; }
  if (q.q) { params.push(`%${q.q}%`); where += `${where ? ' AND' : 'WHERE'} b.booking_code ILIKE $${params.length}`; }
  const { rows, total } = await paginate(
    `SELECT p.*, b.booking_code, b.status AS booking_status, s.name_en AS service_name, cu.name AS customer_name, tu.name AS technician_name,
            cb.name AS confirmed_by_name, po.status AS payout_status
       FROM payments p JOIN bookings b ON b.id = p.booking_id JOIN booking_service_summary s ON s.booking_id = b.id
       JOIN users cu ON cu.id = b.customer_id JOIN technician_profiles tp ON tp.id = b.technician_id JOIN users tu ON tu.id = tp.user_id
       LEFT JOIN users cb ON cb.id = p.confirmed_by LEFT JOIN payouts po ON po.payment_id = p.id
       ${where} ORDER BY p.created_at DESC`, params, q.page, q.pageSize,
  );
  res.json({
    total, page: q.page, pageSize: q.pageSize,
    items: rows.map((p) => ({
      id: p.id, bookingId: p.booking_id, bookingCode: p.booking_code, bookingStatus: p.booking_status, serviceName: p.service_name,
      customerName: p.customer_name, technicianName: p.technician_name, amount: p.amount, currency: p.currency, status: p.status,
      commissionRate: p.commission_rate, commissionAmount: p.commission_amount, technicianNet: p.technician_net, isDemo: p.is_demo,
      provider: p.provider, qrPayload: p.qr_payload, confirmedBy: p.confirmed_by_name, confirmedAt: p.confirmed_at,
      refundedAt: p.refunded_at, refundReason: p.refund_reason, payoutStatus: p.payout_status, createdAt: p.created_at,
    })),
  });
});

/** Demo-only payment confirmation. Requires FINISHED booking + PENDING payment; audited; creates a payout record. */
adminRouter.post('/admin/payments/:id/confirm-demo', async (req, res) => {
  const admin = currentUser(req);
  const result = await tx(async (db) => {
    const p = (await db.query(
      `SELECT p.*, b.status AS booking_status, b.technician_id FROM payments p JOIN bookings b ON b.id = p.booking_id WHERE p.id = $1 FOR UPDATE OF p, b`,
      [req.params.id],
    )).rows[0];
    if (!p) throw notFound('Payment');
    if (!p.is_demo) throw conflict('NOT_DEMO', 'Real gateway payments must be confirmed by a verified provider callback');
    if (p.status !== 'PENDING') throw conflict('INVALID_STATE', `Payment is already ${p.status}`);
    if (p.booking_status !== 'FINISHED') throw conflict('NOT_PAYABLE', 'Payment can only be confirmed after the job is FINISHED');
    await db.query(`UPDATE payments SET status = 'PAID', confirmed_by = $2, confirmed_at = now(), provider_reference = $3 WHERE id = $1`,
      [p.id, admin.id, `DEMO-CONFIRM-${Date.now()}`]);
    await db.query(`UPDATE bookings SET status = 'PAID', paid_at = now(), updated_at = now() WHERE id = $1 AND status = 'FINISHED'`, [p.booking_id]);
    const payout = (await db.query(
      `INSERT INTO payouts (technician_id, payment_id, amount, status) VALUES ($1, $2, $3, 'PENDING') RETURNING id`,
      [p.technician_id, p.id, p.technician_net],
    )).rows[0];
    await audit(db, admin.id, 'PAYMENT_CONFIRMED_DEMO', 'payment', p.id, { status: 'PENDING' },
      { status: 'PAID', simulated: true, amount: p.amount, commission: p.commission_amount, technicianNet: p.technician_net });
    await audit(db, admin.id, 'PAYOUT_CREATED', 'payout', payout.id, null, { status: 'PENDING', amount: p.technician_net });
    return { id: p.id, status: 'PAID', simulated: true, bookingId: p.booking_id as string };
  });
  await notifyBooking(result.bookingId, 'both', 'PAYMENT_CONFIRMED', {}, 'PAYMENT_CONFIRMED_TECH');
  res.json(result);
});

adminRouter.post('/admin/payments/:id/refund', async (req, res) => {
  const admin = currentUser(req);
  const { reason } = z.object({ reason: z.string().trim().min(3).max(300) }).parse(req.body);
  const result = await tx(async (db) => {
    const p = (await db.query(`SELECT * FROM payments WHERE id = $1 FOR UPDATE`, [req.params.id])).rows[0];
    if (!p) throw notFound('Payment');
    if (p.status !== 'PAID') throw conflict('INVALID_STATE', `Only PAID payments can be refunded (this one is ${p.status})`);
    await db.query(`UPDATE payments SET status = 'REFUNDED', refunded_by = $2, refunded_at = now(), refund_reason = $3 WHERE id = $1`, [p.id, admin.id, reason]);
    const b = (await db.query(`SELECT status FROM bookings WHERE id = $1`, [p.booking_id])).rows[0];
    await db.query(`UPDATE bookings SET status = 'REFUNDED', updated_at = now() WHERE id = $1`, [p.booking_id]);
    const po = (await db.query(
      `UPDATE payouts SET status = 'FAILED', reference = 'Cancelled: payment refunded', updated_at = now()
        WHERE payment_id = $1 AND status IN ('PENDING','PROCESSING') RETURNING id`, [p.id],
    )).rows[0];
    await audit(db, admin.id, 'PAYMENT_REFUNDED', 'payment', p.id, { status: 'PAID', bookingStatus: b.status }, { status: 'REFUNDED', reason, simulated: p.is_demo });
    if (po) await audit(db, admin.id, 'PAYOUT_CANCELLED', 'payout', po.id, null, { status: 'FAILED', reason: 'payment refunded' });
    return { id: p.id, status: 'REFUNDED', payoutCancelled: !!po, bookingId: p.booking_id as string };
  });
  await notifyBooking(result.bookingId, 'both', 'PAYMENT_REFUNDED');
  res.json(result);
});

adminRouter.get('/admin/payouts', async (req, res) => {
  const q = page.extend({ status: z.enum(PAYOUT_STATUSES).optional() }).parse(req.query);
  const params: unknown[] = [];
  let where = '';
  if (q.status) { params.push(q.status); where = 'WHERE po.status = $1'; }
  const { rows, total } = await paginate(
    `SELECT po.*, tu.name AS technician_name, b.booking_code, p.amount AS gross, p.commission_amount
       FROM payouts po JOIN technician_profiles tp ON tp.id = po.technician_id JOIN users tu ON tu.id = tp.user_id
       JOIN payments p ON p.id = po.payment_id JOIN bookings b ON b.id = p.booking_id ${where} ORDER BY po.created_at DESC`, params, q.page, q.pageSize,
  );
  const sums = (await query(`SELECT status, coalesce(sum(amount),0) AS amount FROM payouts GROUP BY status`)).rows;
  res.json({
    total, page: q.page, pageSize: q.pageSize,
    totalsByStatus: Object.fromEntries(sums.map((x) => [x.status, x.amount])),
    items: rows.map((p) => ({
      id: p.id, technicianId: p.technician_id, technicianName: p.technician_name, bookingCode: p.booking_code, gross: p.gross,
      commission: p.commission_amount, amount: p.amount, status: p.status, method: p.method, reference: p.reference,
      paidAt: p.paid_at, createdAt: p.created_at,
    })),
  });
});

const payoutTransitions: Record<string, string[]> = {
  PENDING: ['PROCESSING', 'FAILED', 'PAID'], PROCESSING: ['PAID', 'FAILED'], FAILED: ['PENDING'], PAID: [],
};

adminRouter.patch('/admin/payouts/:id', async (req, res) => {
  const admin = currentUser(req);
  const b = z.object({ status: z.enum(PAYOUT_STATUSES), reference: z.string().trim().max(100).optional() }).parse(req.body);
  const r = await tx(async (db) => {
    const before = (await db.query(`SELECT po.*, p.status AS payment_status FROM payouts po JOIN payments p ON p.id = po.payment_id WHERE po.id = $1 FOR UPDATE OF po`, [req.params.id])).rows[0];
    if (!before) throw notFound('Payout');
    if (!payoutTransitions[before.status].includes(b.status)) throw conflict('INVALID_STATE', `Cannot move payout from ${before.status} to ${b.status}`);
    if (b.status !== 'FAILED' && before.payment_status !== 'PAID') throw conflict('INVALID_STATE', 'Payment for this payout is not PAID');
    if (b.status === 'PAID' && !b.reference && !before.reference) throw badRequest('A transfer reference is required to mark a payout paid');
    const after = (await db.query(
      `UPDATE payouts SET status = $2::text::payout_status, reference = COALESCE($3, reference), paid_at = CASE WHEN $2::text = 'PAID' THEN now() ELSE paid_at END, updated_at = now()
        WHERE id = $1 RETURNING *`, [before.id, b.status, b.reference ?? null],
    )).rows[0];
    await audit(db, admin.id, `PAYOUT_${b.status}`, 'payout', before.id, { status: before.status }, { status: b.status, reference: after.reference, recordOnly: true });
    if (b.status === 'PAID') {
      const owner = (await db.query(`SELECT user_id FROM technician_profiles WHERE id = $1`, [before.technician_id])).rows[0];
      await notify(db, owner.user_id, 'PAYOUT_PAID', { amount: after.amount, reference: after.reference });
    }
    return { id: after.id, status: after.status };
  });
  res.json(r);
});

// ---------- Settings ----------

adminRouter.get('/admin/settings', async (_req, res) => {
  const rows = (await query(`SELECT s.*, u.name AS updated_by_name FROM app_settings s LEFT JOIN users u ON u.id = s.updated_by ORDER BY key`)).rows;
  res.json({ items: rows.map((s) => ({ key: s.key, value: s.value_json, updatedBy: s.updated_by_name, updatedAt: s.updated_at })) });
});

const settingValidators: Record<string, z.ZodType> = {
  commission_rate: z.number().min(0).max(50).multipleOf(0.01),
  demo_payment_label: z.string().trim().min(1).max(80),
};

adminRouter.put('/admin/settings/:key', async (req, res) => {
  const admin = currentUser(req);
  const key = String(req.params.key);
  const validator = settingValidators[key];
  if (!validator) throw badRequest(`Setting ${key} is not editable`);
  const value = validator.parse(req.body?.value);
  const r = await tx(async (db) => {
    const before = (await db.query(`SELECT value_json FROM app_settings WHERE key = $1 FOR UPDATE`, [key])).rows[0];
    await db.query(
      `INSERT INTO app_settings (key, value_json, updated_by, updated_at) VALUES ($1, $2, $3, now())
       ON CONFLICT (key) DO UPDATE SET value_json = EXCLUDED.value_json, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [key, JSON.stringify(value), admin.id],
    );
    await audit(db, admin.id, 'SETTING_UPDATED', 'app_setting', key, before?.value_json ?? null, value);
    return { key, value };
  });
  res.json(r);
});

// ---------- Support ----------

adminRouter.get('/admin/support-tickets', async (req, res) => {
  const q = page.extend({ status: z.enum(TICKET_STATUSES).optional() }).parse(req.query);
  const params: unknown[] = [];
  let where = '';
  if (q.status) { params.push(q.status); where = 'WHERE t.status = $1'; }
  const { rows, total } = await paginate(
    `SELECT t.*, u.name AS created_by_name, u.role AS created_by_role, b.booking_code, b.status AS booking_status, a.name AS assigned_name
       FROM support_tickets t JOIN users u ON u.id = t.created_by LEFT JOIN bookings b ON b.id = t.booking_id
       LEFT JOIN users a ON a.id = t.assigned_admin ${where} ORDER BY (t.status = 'OPEN') DESC, t.created_at DESC`, params, q.page, q.pageSize,
  );
  res.json({
    total, page: q.page, pageSize: q.pageSize,
    items: rows.map((t) => ({
      id: t.id, ticketCode: t.ticket_code, category: t.category, description: t.description, status: t.status,
      createdBy: t.created_by_name, createdByRole: t.created_by_role, bookingId: t.booking_id, bookingCode: t.booking_code,
      bookingStatus: t.booking_status, adminNote: t.admin_note, assignedTo: t.assigned_name, createdAt: t.created_at, resolvedAt: t.resolved_at,
    })),
  });
});

adminRouter.patch('/admin/support-tickets/:id', async (req, res) => {
  const admin = currentUser(req);
  const b = z.object({ status: z.enum(TICKET_STATUSES).optional(), adminNote: z.string().trim().max(1000).optional() }).parse(req.body);
  const r = await tx(async (db) => {
    const before = (await db.query(`SELECT * FROM support_tickets WHERE id = $1 FOR UPDATE`, [req.params.id])).rows[0];
    if (!before) throw notFound('Ticket');
    const after = (await db.query(
      `UPDATE support_tickets SET status = COALESCE($2::text::ticket_status, status), admin_note = COALESCE($3, admin_note), assigned_admin = $4,
              resolved_at = CASE WHEN $2::text IN ('RESOLVED','CLOSED') THEN now() ELSE resolved_at END WHERE id = $1 RETURNING *`,
      [before.id, b.status ?? null, b.adminNote ?? null, admin.id],
    )).rows[0];
    await audit(db, admin.id, 'TICKET_UPDATED', 'support_ticket', before.id, { status: before.status }, { status: after.status, note: b.adminNote ?? null });
    await notify(db, before.created_by, 'TICKET_UPDATED', { ticketCode: before.ticket_code, status: after.status }, before.booking_id);
    return { id: after.id, status: after.status };
  });
  res.json(r);
});

// ---------- Reports ----------

adminRouter.get('/admin/reports/summary', async (_req, res) => {
  await expireOverdueBookings();
  const users = (await query(`SELECT role, count(*)::int AS n FROM users GROUP BY role`)).rows;
  const techs = (await query(`SELECT status, count(*)::int AS n FROM technician_profiles GROUP BY status`)).rows;
  const bookings = (await query(`SELECT status, count(*)::int AS n FROM bookings GROUP BY status`)).rows;
  const money = (await one(
    `SELECT coalesce(sum(amount),0) AS gross, coalesce(sum(commission_amount),0) AS commission, coalesce(sum(technician_net),0) AS net, count(*)::int AS n
       FROM payments WHERE status = 'PAID'`,
  ))!;
  const pending = (await one(`SELECT coalesce(sum(amount),0) AS amount, count(*)::int AS n FROM payments WHERE status = 'PENDING'`))!;
  const payouts = (await query(`SELECT status, coalesce(sum(amount),0) AS amount, count(*)::int AS n FROM payouts GROUP BY status`)).rows;
  const daily = (await query(
    `SELECT to_char(d::date, 'YYYY-MM-DD') AS day,
            (SELECT count(*)::int FROM bookings b WHERE b.created_at::date = d::date) AS bookings,
            (SELECT coalesce(sum(p.amount),0) FROM payments p WHERE p.status = 'PAID' AND p.confirmed_at::date = d::date) AS gross
       FROM generate_series(current_date - 13, current_date, interval '1 day') d ORDER BY d`,
  )).rows;
  const waiting = (await query(
    `SELECT b.id, b.booking_code, b.response_deadline_at, tu.name AS technician_name, s.name_en AS service_name
       FROM bookings b JOIN technician_profiles tp ON tp.id = b.technician_id JOIN users tu ON tu.id = tp.user_id JOIN booking_service_summary s ON s.booking_id = b.id
      WHERE b.status = 'REQUESTED' ORDER BY b.response_deadline_at`,
  )).rows;
  const byKey = (rows: any[], key: string) => Object.fromEntries(rows.map((r) => [r[key], r.n]));
  const totalDecided = (await one(
    `SELECT count(*) FILTER (WHERE accepted_at IS NOT NULL)::int AS accepted, count(*) FILTER (WHERE status = 'EXPIRED')::int AS expired,
            count(*) FILTER (WHERE status = 'DECLINED')::int AS declined, count(*)::int AS total FROM bookings WHERE status <> 'REQUESTED'`,
  ))!;
  res.json({
    users: byKey(users, 'role'), technicians: byKey(techs, 'status'), bookingsByStatus: byKey(bookings, 'status'),
    money: { gross: money.gross, commission: money.commission, net: money.net, paidCount: money.n, pendingAmount: pending.amount, pendingCount: pending.n },
    payouts: payouts.map((p) => ({ status: p.status, amount: p.amount, count: p.n })),
    daily: daily.map((d) => ({ day: d.day, bookings: d.bookings, gross: d.gross })),
    responses: totalDecided,
    waitingRequests: waiting.map((w) => ({ id: w.id, bookingCode: w.booking_code, deadline: w.response_deadline_at, technicianName: w.technician_name, serviceName: w.service_name })),
    serverNow: new Date().toISOString(),
  });
});

function sendCsv(res: Response, name: string, header: string[], rows: unknown[][]) {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : v instanceof Date ? v.toISOString() : String(v);
    // Guard against spreadsheet formula injection.
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.send('﻿' + [header, ...rows].map((r) => r.map(esc).join(',')).join('\n'));
}

adminRouter.get('/admin/reports/bookings.csv', async (_req, res) => {
  const rows = (await query(
    `SELECT b.booking_code, b.status, s.name_en, b.service_area, cu.name AS customer, tu.name AS technician, b.created_at, b.response_deadline_at,
            b.accepted_at, b.finished_at, b.paid_at, p.amount, p.commission_rate, p.commission_amount, p.technician_net, p.status AS payment_status, p.is_demo
       FROM bookings b JOIN booking_service_summary s ON s.booking_id = b.id JOIN users cu ON cu.id = b.customer_id
       JOIN technician_profiles tp ON tp.id = b.technician_id JOIN users tu ON tu.id = tp.user_id LEFT JOIN payments p ON p.booking_id = b.id
      ORDER BY b.created_at DESC`,
  )).rows;
  sendCsv(res, 'fixnow-bookings.csv',
    ['booking_code', 'status', 'service', 'area', 'customer', 'technician', 'created_at', 'response_deadline_at', 'accepted_at', 'finished_at', 'paid_at', 'amount_usd', 'commission_rate', 'commission_usd', 'technician_net_usd', 'payment_status', 'is_demo_payment'],
    rows.map((r) => Object.values(r)));
});

adminRouter.get('/admin/reports/payments.csv', async (_req, res) => {
  const rows = (await query(
    `SELECT b.booking_code, p.status, p.amount, p.currency, p.commission_rate, p.commission_amount, p.technician_net, p.is_demo, p.provider,
            p.confirmed_at, cb.name AS confirmed_by, po.status AS payout_status, po.reference AS payout_reference
       FROM payments p JOIN bookings b ON b.id = p.booking_id LEFT JOIN users cb ON cb.id = p.confirmed_by LEFT JOIN payouts po ON po.payment_id = p.id
      ORDER BY p.created_at DESC`,
  )).rows;
  sendCsv(res, 'fixnow-payments.csv',
    ['booking_code', 'payment_status', 'amount', 'currency', 'commission_rate', 'commission', 'technician_net', 'is_demo', 'provider', 'confirmed_at', 'confirmed_by', 'payout_status', 'payout_reference'],
    rows.map((r) => Object.values(r)));
});

adminRouter.get('/admin/audit-logs', async (req, res) => {
  const q = page.extend({ entityType: z.string().max(40).optional() }).parse(req.query);
  const params: unknown[] = [];
  let where = '';
  if (q.entityType) { params.push(q.entityType); where = 'WHERE a.entity_type = $1'; }
  const total = (await one(`SELECT count(*)::int AS n FROM audit_logs a ${where}`, params))!.n;
  params.push(q.pageSize, (q.page - 1) * q.pageSize);
  const rows = (await query(
    `SELECT a.*, u.name AS actor_name, u.role AS actor_role FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id
       ${where} ORDER BY a.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params,
  )).rows;
  res.json({
    total, page: q.page, pageSize: q.pageSize,
    items: rows.map((a) => ({
      id: a.id, actor: a.actor_name, actorRole: a.actor_role, action: a.action, entityType: a.entity_type, entityId: a.entity_id,
      before: a.before_json, after: a.after_json, createdAt: a.created_at,
    })),
  });
});
