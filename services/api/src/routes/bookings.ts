import crypto from 'node:crypto';
import { Router } from 'express';
import QRCode from 'qrcode';
import { z } from 'zod';
import { AREA_CODES, BOOKING_RESPONSE_SECONDS, BOOKING_STATUSES, WARRANTY_DAYS, splitCommission, toCents, type BookingStatus } from '@fixnow/shared';
import { audit } from '../audit';
import { one, pool, query, tx, type Db } from '../db/pool';
import {
  BOOKING_SELECT, canViewBooking, expireOverdueBookings, loadBookingForViewer, loadBookingRow, toBookingDto,
} from '../domain/bookings';
import { authenticate, currentUser, requireRole, type AuthUser } from '../http/auth';
import { badRequest, conflict, forbidden, notFound } from '../http/errors';
import { signedUrl } from '../storage';
import { notifyBooking } from '../domain/notify';

export const bookingsRouter = Router();
bookingsRouter.use(authenticate);

const areaCodes = AREA_CODES;

const createSchema = z.object({
  // One visit can cover several services from the same technician. `serviceId` is accepted for older clients.
  serviceIds: z.array(z.uuid()).min(1).max(5).optional(),
  serviceId: z.uuid().optional(),
  technicianId: z.uuid(),
  problemDescription: z.string().trim().min(5, 'Describe the problem (at least 5 characters)').max(1000),
  scheduledAt: z.iso.datetime({ offset: true }),
  serviceArea: z.enum(areaCodes),
  serviceAddressText: z.string().trim().min(5).max(300),
  serviceLat: z.number().min(-90).max(90).nullable().optional(),
  serviceLng: z.number().min(-180).max(180).nullable().optional(),
  mediaIds: z.array(z.uuid()).max(5).optional().default([]),
}).transform((b, ctx) => {
  const ids = [...new Set(b.serviceIds ?? (b.serviceId ? [b.serviceId] : []))];
  if (!ids.length) ctx.addIssue({ code: 'custom', path: ['serviceIds'], message: 'Choose at least one service' });
  return { ...b, serviceIds: ids };
});
type CreateBooking = z.infer<typeof createSchema>;

/** Every requested service must be bookable, and the technician must offer all of them. */
async function assertBookable(db: Db, serviceIds: string[], technicianId: string) {
  const services = (await db.query(
    `SELECT s.id, s.status, c.status AS category_status FROM services s JOIN service_categories c ON c.id = s.category_id WHERE s.id = ANY($1)`,
    [serviceIds],
  )).rows;
  if (services.length !== serviceIds.length) throw notFound('Service');
  if (services.some((s) => s.status !== 'ACTIVE' || s.category_status !== 'ACTIVE')) {
    throw conflict('SERVICE_NOT_ACTIVE', 'This service is coming soon and cannot be booked yet');
  }
  const tech = (await db.query(
    `SELECT tp.id, tp.status, tp.is_available, u.is_active,
            (SELECT count(*)::int FROM technician_services ts WHERE ts.technician_id = tp.id AND ts.service_id = ANY($2)) = $3 AS offers
       FROM technician_profiles tp JOIN users u ON u.id = tp.user_id WHERE tp.id = $1`,
    [technicianId, serviceIds, serviceIds.length],
  )).rows[0];
  if (!tech) throw notFound('Technician');
  if (tech.status !== 'APPROVED' || !tech.is_active) throw conflict('TECHNICIAN_NOT_ELIGIBLE', 'This technician is not approved to receive jobs');
  if (!tech.is_available) throw conflict('TECHNICIAN_UNAVAILABLE', 'This technician is currently unavailable');
  if (!tech.offers) throw conflict('TECHNICIAN_NOT_ELIGIBLE', serviceIds.length > 1
    ? 'This technician does not offer all of the selected services' : 'This technician does not offer that service');
}

async function insertBooking(db: Db, customerId: string, b: CreateBooking, previousBookingId: string | null) {
  const scheduled = new Date(b.scheduledAt).getTime();
  if (scheduled < Date.now() - 10 * 60_000) throw badRequest('Preferred time must be in the future');
  if (scheduled > Date.now() + 30 * 86400_000) throw badRequest('Preferred time must be within 30 days');
  const open = (await db.query(`SELECT count(*)::int AS n FROM bookings WHERE customer_id = $1 AND status = 'REQUESTED'`, [customerId])).rows[0];
  if (open.n >= 3) throw conflict('TOO_MANY_REQUESTS', 'You already have 3 requests waiting for a response');
  // The deadline is computed by the database clock, never by the client.
  const id = (await db.query(
    `INSERT INTO bookings (customer_id, technician_id, service_id, problem_description, scheduled_at, service_area,
                           service_address_text, service_lat, service_lng, previous_booking_id, response_deadline_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now() + make_interval(secs => $11))
     RETURNING id`,
    [customerId, b.technicianId, b.serviceIds[0], b.problemDescription, b.scheduledAt, b.serviceArea, b.serviceAddressText,
      b.serviceLat ?? null, b.serviceLng ?? null, previousBookingId, BOOKING_RESPONSE_SECONDS],
  )).rows[0].id as string;
  // The primary service (position 0) is added by a trigger; add the rest in the customer's order.
  if (b.serviceIds.length > 1) {
    await db.query(
      `INSERT INTO booking_services (booking_id, service_id, position)
       SELECT $1, sid, ord::int FROM unnest($2::uuid[]) WITH ORDINALITY AS t(sid, ord) WHERE ord > 1`,
      [id, b.serviceIds],
    );
  }
  return id;
}

bookingsRouter.post('/bookings', requireRole('CUSTOMER'), async (req, res) => {
  const user = currentUser(req);
  const body = createSchema.parse(req.body);
  const id = await tx(async (db) => {
    await assertBookable(db, body.serviceIds, body.technicianId);
    const bookingId = await insertBooking(db, user.id, body, null);
    if (body.mediaIds.length) {
      const r = await db.query(
        `UPDATE booking_media SET booking_id = $1 WHERE id = ANY($2) AND uploaded_by = $3 AND booking_id IS NULL AND purpose = 'PROBLEM'`,
        [bookingId, body.mediaIds, user.id],
      );
      if (r.rowCount !== body.mediaIds.length) throw badRequest('One or more uploads are invalid');
    }
    return bookingId;
  });
  await notifyBooking(id, 'technician', 'BOOKING_REQUESTED');
  res.status(201).json((await loadBookingForViewer(id, user)).dto);
});

/** After EXPIRED/DECLINED, send the same request to another eligible technician. */
bookingsRouter.post('/bookings/:id/rebook', requireRole('CUSTOMER'), async (req, res) => {
  const user = currentUser(req);
  const { technicianId } = z.object({ technicianId: z.uuid() }).parse(req.body);
  await expireOverdueBookings();
  const id = await tx(async (db) => {
    const prev = (await db.query(`SELECT * FROM bookings WHERE id = $1`, [req.params.id])).rows[0];
    if (!prev) throw notFound('Booking');
    if (prev.customer_id !== user.id) throw forbidden('This booking does not belong to you');
    if (!['EXPIRED', 'DECLINED'].includes(prev.status)) throw conflict('INVALID_STATE', 'Only expired or declined requests can be sent to another technician');
    if (prev.technician_id === technicianId) throw badRequest('Choose a different technician');
    const serviceIds = (await db.query(`SELECT service_id FROM booking_services WHERE booking_id = $1 ORDER BY position`, [prev.id])).rows.map((r) => r.service_id as string);
    await assertBookable(db, serviceIds, technicianId);
    const scheduledAt = new Date(Math.max(new Date(prev.scheduled_at).getTime(), Date.now())).toISOString();
    const bookingId = await insertBooking(db, user.id, {
      serviceIds, technicianId, problemDescription: prev.problem_description, scheduledAt,
      serviceArea: prev.service_area, serviceAddressText: prev.service_address_text,
      serviceLat: prev.service_lat === null ? null : Number(prev.service_lat), serviceLng: prev.service_lng === null ? null : Number(prev.service_lng),
      mediaIds: [],
    }, prev.id);
    await db.query(
      `INSERT INTO booking_media (booking_id, uploaded_by, media_type, mime_type, size_bytes, storage_key, purpose)
       SELECT $1, uploaded_by, media_type, mime_type, size_bytes, storage_key, purpose FROM booking_media WHERE booking_id = $2 AND purpose = 'PROBLEM'`,
      [bookingId, prev.id],
    );
    return bookingId;
  });
  await notifyBooking(id, 'technician', 'BOOKING_REQUESTED');
  res.status(201).json((await loadBookingForViewer(id, user)).dto);
});

bookingsRouter.get('/bookings', async (req, res) => {
  const user = currentUser(req);
  const q = z.object({
    status: z.string().optional(),
    scope: z.enum(['active', 'history']).optional(),
    q: z.string().trim().max(50).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }).parse(req.query);
  await expireOverdueBookings();
  const params: unknown[] = [];
  const where: string[] = [];
  if (user.role === 'CUSTOMER') { params.push(user.id); where.push(`b.customer_id = $${params.length}`); }
  if (user.role === 'TECHNICIAN') {
    if (!user.technicianId) { res.json({ items: [], total: 0, page: 1, pageSize: q.pageSize }); return; }
    params.push(user.technicianId); where.push(`b.technician_id = $${params.length}`);
  }
  if (q.status) {
    const statuses = q.status.split(',').filter((s): s is BookingStatus => (BOOKING_STATUSES as readonly string[]).includes(s));
    if (!statuses.length) throw badRequest('Unknown status filter');
    params.push(statuses); where.push(`b.status = ANY($${params.length}::booking_status[])`);
  }
  if (q.scope === 'active') where.push(`b.status IN ('REQUESTED','ACCEPTED','CONFIRMED','FINISHED')`);
  if (q.scope === 'history') where.push(`b.status NOT IN ('REQUESTED','ACCEPTED','CONFIRMED','FINISHED')`);
  if (q.q && user.role === 'ADMIN') {
    params.push(`%${q.q}%`);
    where.push(`(b.booking_code ILIKE $${params.length} OR cu.name ILIKE $${params.length} OR tu.name ILIKE $${params.length})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await query(
    `SELECT count(*)::int AS n FROM bookings b JOIN technician_profiles tp ON tp.id = b.technician_id JOIN users tu ON tu.id = tp.user_id
       JOIN users cu ON cu.id = b.customer_id ${whereSql}`, params,
  )).rows[0].n;
  params.push(q.pageSize, (q.page - 1) * q.pageSize);
  const rows = (await query(`${BOOKING_SELECT} ${whereSql} ORDER BY b.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params)).rows;
  res.json({ items: rows.map((r) => toBookingDto(r, user)), total, page: q.page, pageSize: q.pageSize });
});

bookingsRouter.get('/bookings/:id', async (req, res) => {
  res.json((await loadBookingForViewer(String(req.params.id), currentUser(req))).dto);
});

/**
 * Applies a status transition atomically. The WHERE clause carries every precondition,
 * so concurrent requests (two accepts, accept vs. expiry) cannot both succeed.
 */
async function transition(
  db: Db, id: string, from: BookingStatus[], to: BookingStatus, setSql: string, extraWhere = '', extraParams: unknown[] = [],
) {
  const r = await db.query(
    `UPDATE bookings SET status = $2, updated_at = now() ${setSql ? `, ${setSql}` : ''}
      WHERE id = $1 AND status = ANY($3::booking_status[]) ${extraWhere} RETURNING *`,
    [id, to, from, ...extraParams],
  );
  return r.rows[0];
}

/** Explains why a transition failed with the correct HTTP status. */
async function failTransition(id: string, user: AuthUser, action: string): Promise<never> {
  const expired = await expireOverdueBookings();
  const row = await loadBookingRow(id);
  if (!row) throw notFound('Booking');
  if (!canViewBooking(row, user)) throw forbidden('This booking does not belong to you');
  if (row.status === 'EXPIRED' || expired.some((e) => e.id === id)) throw conflict('BOOKING_EXPIRED', 'The 5-minute response window has passed');
  throw conflict('INVALID_STATE', `Cannot ${action} a booking that is ${row.status}`);
}

function requireApprovedTechnician(user: AuthUser) {
  if (user.role !== 'TECHNICIAN' || !user.technicianId) throw forbidden();
  if (user.technicianStatus !== 'APPROVED') throw forbidden('Your account must be approved before you can take jobs');
  return user.technicianId;
}

bookingsRouter.post('/bookings/:id/accept', requireRole('TECHNICIAN'), async (req, res) => {
  const user = currentUser(req);
  const techId = requireApprovedTechnician(user);
  const id = String(req.params.id);
  const row = await transition(pool, id, ['REQUESTED'], 'ACCEPTED', 'accepted_at = now()',
    'AND technician_id = $4 AND response_deadline_at > now()', [techId]);
  if (!row) await failTransition(id, user, 'accept');
  await notifyBooking(id, 'customer', 'BOOKING_ACCEPTED');
  res.json((await loadBookingForViewer(id, user)).dto);
});

bookingsRouter.post('/bookings/:id/decline', requireRole('TECHNICIAN'), async (req, res) => {
  const user = currentUser(req);
  const techId = requireApprovedTechnician(user);
  const id = String(req.params.id);
  const row = await transition(pool, id, ['REQUESTED'], 'DECLINED', 'declined_at = now()',
    'AND technician_id = $4 AND response_deadline_at > now()', [techId]);
  if (!row) await failTransition(id, user, 'decline');
  await notifyBooking(id, 'customer', 'BOOKING_DECLINED');
  res.json((await loadBookingForViewer(id, user)).dto);
});

/** Job progress: technician is on site / work started. */
bookingsRouter.post('/bookings/:id/start', requireRole('TECHNICIAN'), async (req, res) => {
  const user = currentUser(req);
  const techId = requireApprovedTechnician(user);
  const id = String(req.params.id);
  const row = await transition(pool, id, ['ACCEPTED'], 'CONFIRMED', 'started_at = now()', 'AND technician_id = $4', [techId]);
  if (!row) await failTransition(id, user, 'start');
  await notifyBooking(id, 'customer', 'BOOKING_STARTED');
  res.json((await loadBookingForViewer(id, user)).dto);
});

bookingsRouter.post('/bookings/:id/finish', requireRole('TECHNICIAN'), async (req, res) => {
  const user = currentUser(req);
  const techId = requireApprovedTechnician(user);
  const id = String(req.params.id);
  const body = z.object({
    amount: z.string().regex(/^\d{1,6}(\.\d{1,2})?$/, 'Amount must be like 25 or 25.00'),
    completionMediaIds: z.array(z.uuid()).max(5).optional().default([]),
  }).parse(req.body);

  await tx(async (db) => {
    const current = (await db.query(
      `SELECT b.*, s.min_price, s.max_price FROM bookings b JOIN booking_service_summary s ON s.booking_id = b.id WHERE b.id = $1 FOR UPDATE OF b`, [id],
    )).rows[0];
    if (!current) throw notFound('Booking');
    if (current.technician_id !== techId) throw forbidden('Only the assigned technician can finish this job');
    const cents = toCents(body.amount);
    if (cents <= 0) throw badRequest('Amount must be greater than zero');
    // For multi-service bookings the allowed range is the sum of each service's range.
    if (current.min_price !== null && cents < toCents(current.min_price)) throw badRequest(`Amount is below the minimum price for the booked services ($${current.min_price})`);
    if (current.max_price !== null && cents > toCents(current.max_price)) throw badRequest(`Amount is above the maximum price for the booked services ($${current.max_price})`);
    const row = await transition(db, id, ['ACCEPTED', 'CONFIRMED'], 'FINISHED', 'finished_at = now(), final_amount = $4', 'AND technician_id = $5', [body.amount, techId]);
    if (!row) throw conflict('INVALID_STATE', `Cannot finish a booking that is ${current.status}`);
    if (body.completionMediaIds.length) {
      const r = await db.query(
        `UPDATE booking_media SET booking_id = $1 WHERE id = ANY($2) AND uploaded_by = $3 AND booking_id IS NULL AND purpose = 'COMPLETION'`,
        [id, body.completionMediaIds, user.id],
      );
      if (r.rowCount !== body.completionMediaIds.length) throw badRequest('One or more uploads are invalid');
    }
    // Snapshot the commission rate in force right now onto the payment record.
    const rate = (await db.query(`SELECT value_json FROM app_settings WHERE key = 'commission_rate'`)).rows[0]?.value_json ?? 15;
    const split = splitCommission(body.amount, String(rate));
    const paymentId = crypto.randomUUID();
    const qrPayload = `FIXNOW-DEMO-QR|ref=${current.booking_code}|pid=${paymentId}|amt=${split.amount}|cur=USD`;
    await db.query(
      `INSERT INTO payments (id, booking_id, provider, qr_payload, amount, currency, status, commission_rate, commission_amount, technician_net, is_demo)
       VALUES ($1, $2, 'DEMO_QR', $3, $4, 'USD', 'PENDING', $5, $6, $7, true)`,
      [paymentId, id, qrPayload, split.amount, split.commissionRate, split.commissionAmount, split.technicianNet],
    );
  });
  await notifyBooking(id, 'customer', 'BOOKING_FINISHED');
  res.json((await loadBookingForViewer(id, user)).dto);
});

bookingsRouter.post('/bookings/:id/customer-not-available', requireRole('TECHNICIAN'), async (req, res) => {
  const user = currentUser(req);
  const techId = requireApprovedTechnician(user);
  const id = String(req.params.id);
  const row = await transition(pool, id, ['ACCEPTED', 'CONFIRMED'], 'CUSTOMER_NOT_AVAILABLE', '', 'AND technician_id = $4', [techId]);
  if (!row) await failTransition(id, user, 'mark customer unavailable on');
  await notifyBooking(id, 'customer', 'CUSTOMER_NOT_AVAILABLE');
  res.json((await loadBookingForViewer(id, user)).dto);
});

/** Basic cancellation rules: customer may cancel before work starts; admin may cancel until finished. No fees are charged. */
bookingsRouter.post('/bookings/:id/cancel', requireRole('CUSTOMER', 'ADMIN'), async (req, res) => {
  const user = currentUser(req);
  const id = String(req.params.id);
  const { reason } = z.object({ reason: z.string().trim().max(300).optional().default('') }).parse(req.body ?? {});
  const from: BookingStatus[] = user.role === 'ADMIN' ? ['REQUESTED', 'ACCEPTED', 'CONFIRMED'] : ['REQUESTED', 'ACCEPTED'];
  const row = await tx(async (db) => {
    const r = await transition(db, id, from, 'CANCELLED', 'cancelled_at = now(), cancel_reason = $4',
      user.role === 'CUSTOMER' ? 'AND customer_id = $5' : '', user.role === 'CUSTOMER' ? [reason || null, user.id] : [reason || null]);
    if (r && user.role === 'ADMIN') await audit(db, user.id, 'BOOKING_CANCELLED', 'booking', id, null, { status: 'CANCELLED', reason });
    return r;
  });
  if (!row) await failTransition(id, user, 'cancel');
  // Tell the technician; when an admin cancels, tell the customer too.
  await notifyBooking(id, user.role === 'ADMIN' ? 'both' : 'technician', 'BOOKING_CANCELLED');
  res.json((await loadBookingForViewer(id, user)).dto);
});

/** Returns the QR for an eligible booking: only after FINISHED and only while payment is PENDING. */
bookingsRouter.post('/bookings/:id/payment/qr', requireRole('CUSTOMER', 'ADMIN'), async (req, res) => {
  const user = currentUser(req);
  const { row } = await loadBookingForViewer(String(req.params.id), user);
  if (!row.payment_id) throw conflict('NOT_PAYABLE', 'Payment is available after the technician marks the job finished');
  if (row.payment_status !== 'PENDING' || row.status !== 'FINISHED') throw conflict('NOT_PAYABLE', `Payment is ${row.payment_status}`);
  const qrImageDataUrl = await QRCode.toDataURL(row.qr_payload, { margin: 1, width: 320, errorCorrectionLevel: 'M' });
  res.json({
    paymentId: row.payment_id, bookingCode: row.booking_code, amount: row.payment_amount, currency: row.payment_currency,
    qrPayload: row.qr_payload, qrImageDataUrl, isDemo: row.is_demo,
    notice: 'DEMO: simulated QR. No real money moves. Payment is confirmed by a FixNow operator.',
  });
});

bookingsRouter.post('/bookings/:id/ratings', requireRole('CUSTOMER'), async (req, res) => {
  const user = currentUser(req);
  const id = String(req.params.id);
  const body = z.object({ score: z.number().int().min(1).max(5), comment: z.string().trim().max(500).optional() }).parse(req.body);
  await tx(async (db) => {
    const b = (await db.query(`SELECT * FROM bookings WHERE id = $1 FOR UPDATE`, [id])).rows[0];
    if (!b) throw notFound('Booking');
    if (b.customer_id !== user.id) throw forbidden('You can only rate your own bookings');
    const existing = (await db.query(`SELECT 1 FROM ratings WHERE booking_id = $1`, [id])).rows[0];
    if (existing) throw conflict('ALREADY_RATED', 'You have already rated this booking');
    if (b.status !== 'PAID') throw conflict('NOT_RATABLE', 'You can rate after payment is confirmed');
    await db.query(
      `INSERT INTO ratings (booking_id, customer_id, technician_id, score, comment) VALUES ($1, $2, $3, $4, $5)`,
      [id, user.id, b.technician_id, body.score, body.comment || null],
    );
    await db.query(`UPDATE bookings SET status = 'RATED', updated_at = now() WHERE id = $1`, [id]);
  });
  await notifyBooking(id, 'technician', 'RATING_RECEIVED', { score: body.score });
  res.status(201).json((await loadBookingForViewer(id, user)).dto);
});

bookingsRouter.post('/bookings/:id/warranty', requireRole('CUSTOMER'), async (req, res) => {
  const user = currentUser(req);
  const id = String(req.params.id);
  const body = z.object({
    description: z.string().trim().min(5).max(1000),
    mediaIds: z.array(z.uuid()).max(5).optional().default([]),
  }).parse(req.body);
  await tx(async (db) => {
    const b = (await db.query(`SELECT * FROM bookings WHERE id = $1 FOR UPDATE`, [id])).rows[0];
    if (!b) throw notFound('Booking');
    if (b.customer_id !== user.id) throw forbidden('You can only request warranty on your own bookings');
    if (!['PAID', 'RATED'].includes(b.status) || !b.paid_at) throw conflict('NOT_ELIGIBLE', 'Warranty is available after payment');
    const inWindow = (await db.query(`SELECT $1::timestamptz + make_interval(days => $2) > now() AS ok`, [b.paid_at, WARRANTY_DAYS])).rows[0].ok;
    if (!inWindow) throw conflict('WARRANTY_EXPIRED', `Warranty requests must be made within ${WARRANTY_DAYS} days of payment`);
    const open = (await db.query(`SELECT 1 FROM warranty_requests WHERE booking_id = $1 AND status IN ('OPEN','ACCEPTED')`, [id])).rows[0];
    if (open) throw conflict('WARRANTY_OPEN', 'A warranty request is already open for this booking');
    // Routed to the same technician who did the job.
    const w = (await db.query(
      `INSERT INTO warranty_requests (booking_id, customer_id, technician_id, description) VALUES ($1, $2, $3, $4) RETURNING id`,
      [id, user.id, b.technician_id, body.description],
    )).rows[0];
    if (body.mediaIds.length) {
      const r = await db.query(
        `UPDATE booking_media SET warranty_request_id = $1 WHERE id = ANY($2) AND uploaded_by = $3 AND booking_id IS NULL AND warranty_request_id IS NULL AND purpose = 'WARRANTY'`,
        [w.id, body.mediaIds, user.id],
      );
      if (r.rowCount !== body.mediaIds.length) throw badRequest('One or more uploads are invalid');
    }
  });
  await notifyBooking(id, 'technician', 'WARRANTY_REQUESTED');
  res.status(201).json((await loadBookingForViewer(id, user)).dto);
});

// ---- Warranty handling (assigned technician or admin) ----

bookingsRouter.get('/warranty', requireRole('TECHNICIAN', 'ADMIN'), async (req, res) => {
  const user = currentUser(req);
  const params: unknown[] = [];
  let where = '';
  if (user.role === 'TECHNICIAN') { params.push(user.technicianId); where = 'WHERE w.technician_id = $1'; }
  const rows = (await query(
    `SELECT w.*, b.booking_code, b.service_area, s.name_en AS service_name_en, s.name_km AS service_name_km,
            cu.name AS customer_name, tu.name AS technician_name,
            ARRAY(SELECT m.storage_key FROM booking_media m WHERE m.warranty_request_id = w.id) AS media_keys
       FROM warranty_requests w JOIN bookings b ON b.id = w.booking_id JOIN booking_service_summary s ON s.booking_id = b.id
       JOIN users cu ON cu.id = w.customer_id JOIN technician_profiles tp ON tp.id = w.technician_id JOIN users tu ON tu.id = tp.user_id
       ${where} ORDER BY w.created_at DESC`, params,
  )).rows;
  res.json({
    items: rows.map((w) => ({
      id: w.id, bookingId: w.booking_id, bookingCode: w.booking_code, status: w.status, description: w.description,
      resolutionNote: w.resolution_note, createdAt: w.created_at, resolvedAt: w.resolved_at,
      serviceNameEn: w.service_name_en, serviceNameKm: w.service_name_km, customerName: w.customer_name, technicianName: w.technician_name,
      mediaUrls: (w.media_keys as string[]).map((k) => signedUrl(k)),
    })),
  });
});

bookingsRouter.post('/warranty/:id/:action', requireRole('TECHNICIAN', 'ADMIN'), async (req, res) => {
  const user = currentUser(req);
  const action = z.enum(['accept', 'reject', 'resolve']).parse(req.params.action);
  const { note } = z.object({ note: z.string().trim().max(500).optional() }).parse(req.body ?? {});
  const transitions = { accept: [['OPEN'], 'ACCEPTED'], reject: [['OPEN'], 'REJECTED'], resolve: [['OPEN', 'ACCEPTED'], 'RESOLVED'] } as const;
  const [from, to] = transitions[action];
  const w = await one(`SELECT * FROM warranty_requests WHERE id = $1`, [req.params.id]);
  if (!w) throw notFound('Warranty request');
  if (user.role === 'TECHNICIAN' && w.technician_id !== user.technicianId) throw forbidden();
  const updated = await tx(async (db) => {
    const r = (await db.query(
      `UPDATE warranty_requests SET status = $2::text::warranty_status, resolution_note = COALESCE($4, resolution_note),
              resolved_at = CASE WHEN $2::text IN ('RESOLVED','REJECTED') THEN now() ELSE resolved_at END
        WHERE id = $1 AND status = ANY($3::warranty_status[]) RETURNING *`,
      [w.id, to, from, note ?? null],
    )).rows[0];
    if (r && user.role === 'ADMIN') await audit(db, user.id, `WARRANTY_${to}`, 'warranty_request', w.id, { status: w.status }, { status: to, note });
    return r;
  });
  if (!updated) throw conflict('INVALID_STATE', `Cannot ${action} a warranty request that is ${w.status}`);
  await notifyBooking(w.booking_id, 'customer', 'WARRANTY_UPDATED', { status: updated.status });
  res.json({ id: updated.id, status: updated.status });
});
