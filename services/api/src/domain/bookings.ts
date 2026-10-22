import { ADDRESS_VISIBLE_STATUSES, WARRANTY_DAYS, type BookingDto, type BookingStatus } from '@fixnow/shared';
import type { AuthUser } from '../http/auth';
import { forbidden, notFound } from '../http/errors';
import { pool, query, type Db } from '../db/pool';
import { signedUrl } from '../storage';

/** Server-side expiry: any REQUESTED booking past its deadline becomes EXPIRED. Race-safe via conditional update. */
export async function expireOverdueBookings(db: Db = pool) {
  // One statement: expire, then notify customer (choose another technician) and technician (missed request).
  const r = await query<{ id: string; booking_code: string }>(
    `WITH exp AS (
       UPDATE bookings SET status = 'EXPIRED', expired_at = response_deadline_at, updated_at = now()
        WHERE status = 'REQUESTED' AND response_deadline_at <= now()
        RETURNING id, booking_code, customer_id, technician_id, service_id, service_area
     ), facts AS (
       SELECT exp.*, s.name_en, s.name_km, tp.user_id AS tech_user_id
         FROM exp JOIN booking_service_summary s ON s.booking_id = exp.id JOIN technician_profiles tp ON tp.id = exp.technician_id
     ), notes AS (
       INSERT INTO notifications (user_id, type, booking_id, params)
       SELECT u.user_id, u.type, f.id,
              jsonb_build_object('bookingCode', f.booking_code, 'serviceEn', f.name_en, 'serviceKm', f.name_km, 'area', f.service_area)
         FROM facts f
         CROSS JOIN LATERAL (VALUES (f.customer_id, 'BOOKING_EXPIRED'), (f.tech_user_id, 'BOOKING_EXPIRED_TECH')) AS u(user_id, type)
     )
     SELECT id, booking_code FROM exp`,
    [], db,
  );
  return r.rows;
}

export const BOOKING_SELECT = `
  SELECT b.*, now() AS server_now,
         s.name_en AS service_name_en, s.name_km AS service_name_km, s.min_price, s.max_price, s.services_json,
         tu.name AS technician_name, tp.public_photo_key AS technician_photo_key, tp.user_id AS technician_user_id,
         (SELECT round(avg(score)::numeric, 2) FROM ratings r2 WHERE r2.technician_id = tp.id) AS technician_rating_avg,
         cu.name AS customer_name,
         p.id AS payment_id, p.status AS payment_status, p.amount AS payment_amount, p.currency AS payment_currency,
         p.commission_rate, p.commission_amount, p.technician_net, p.qr_payload, p.is_demo, p.provider AS payment_provider,
         p.confirmed_at, p.refunded_at, po.status AS payout_status,
         r.score AS rating_score, r.comment AS rating_comment,
         w.id AS warranty_id, w.status AS warranty_status, w.description AS warranty_description, w.created_at AS warranty_created_at
    FROM bookings b
    JOIN booking_service_summary s ON s.booking_id = b.id
    JOIN technician_profiles tp ON tp.id = b.technician_id
    JOIN users tu ON tu.id = tp.user_id
    JOIN users cu ON cu.id = b.customer_id
    LEFT JOIN payments p ON p.booking_id = b.id
    LEFT JOIN payouts po ON po.payment_id = p.id
    LEFT JOIN ratings r ON r.booking_id = b.id
    LEFT JOIN LATERAL (
      SELECT * FROM warranty_requests wr WHERE wr.booking_id = b.id ORDER BY wr.created_at DESC LIMIT 1
    ) w ON true`;

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);
const num = (v: string | null | undefined) => (v === null || v === undefined ? null : Number(v));

export function canViewBooking(row: any, user: AuthUser) {
  if (user.role === 'ADMIN') return true;
  if (user.role === 'CUSTOMER') return row.customer_id === user.id;
  if (user.role === 'TECHNICIAN') return row.technician_id === user.technicianId;
  return false;
}

/**
 * Shapes a booking for a given viewer. Phone numbers are never included for anyone.
 * The technician only sees the customer's name and exact address after accepting.
 */
export function toBookingDto(row: any, user: AuthUser, media: any[] = []): BookingDto {
  const status = row.status as BookingStatus;
  const revealPrivate = user.role !== 'TECHNICIAN' || ADDRESS_VISIBLE_STATUSES.includes(status);
  // QR payload is only exposed once the job is finished and the payment is still pending.
  const showQr = row.payment_id && row.payment_status === 'PENDING' && status === 'FINISHED';
  const warrantyUntil = row.paid_at && ['PAID', 'RATED'].includes(status)
    ? new Date(new Date(row.paid_at).getTime() + WARRANTY_DAYS * 86400_000).toISOString()
    : null;
  return {
    id: row.id,
    bookingCode: row.booking_code,
    status,
    // `service` summarises everything booked (combined names, summed price range); `services` lists each one.
    service: { id: row.service_id, nameEn: row.service_name_en, nameKm: row.service_name_km, minPrice: row.min_price, maxPrice: row.max_price },
    services: (row.services_json ?? []).map((x: any) => ({
      id: x.id, nameEn: x.nameEn, nameKm: x.nameKm,
      minPrice: x.minPrice === null ? null : Number(x.minPrice).toFixed(2), maxPrice: x.maxPrice === null ? null : Number(x.maxPrice).toFixed(2),
    })),
    technician: {
      id: row.technician_id, name: row.technician_name ?? 'Technician',
      photoUrl: signedUrl(row.technician_photo_key), ratingAvg: num(row.technician_rating_avg),
    },
    customer: revealPrivate ? { id: row.customer_id, name: row.customer_name } : null,
    problemDescription: row.problem_description,
    scheduledAt: iso(row.scheduled_at)!,
    serviceArea: row.service_area,
    serviceAddressText: revealPrivate ? row.service_address_text : null,
    serviceLat: revealPrivate ? num(row.service_lat) : null,
    serviceLng: revealPrivate ? num(row.service_lng) : null,
    responseDeadlineAt: iso(row.response_deadline_at)!,
    serverNow: iso(row.server_now) ?? new Date().toISOString(),
    acceptedAt: iso(row.accepted_at), startedAt: iso(row.started_at), finishedAt: iso(row.finished_at),
    paidAt: iso(row.paid_at), createdAt: iso(row.created_at)!,
    finalAmount: row.final_amount, cancelReason: row.cancel_reason,
    payment: row.payment_id ? {
      id: row.payment_id, status: row.payment_status, amount: row.payment_amount, currency: row.payment_currency,
      commissionRate: row.commission_rate, commissionAmount: row.commission_amount, technicianNet: row.technician_net,
      qrPayload: showQr ? row.qr_payload : null, isDemo: row.is_demo, provider: row.payment_provider,
      confirmedAt: iso(row.confirmed_at), refundedAt: iso(row.refunded_at), payoutStatus: row.payout_status ?? null,
    } : null,
    rating: row.rating_score ? { score: row.rating_score, comment: row.rating_comment } : null,
    media: media.map((m) => ({ id: m.id, mediaType: m.media_type, purpose: m.purpose, url: signedUrl(m.storage_key)!, createdAt: iso(m.created_at)! })),
    warrantyEligibleUntil: warrantyUntil,
    warranty: row.warranty_id ? { id: row.warranty_id, status: row.warranty_status, description: row.warranty_description, createdAt: iso(row.warranty_created_at)! } : null,
  };
}

export async function loadBookingRow(id: string, db: Db = pool) {
  const r = await query(`${BOOKING_SELECT} WHERE b.id = $1`, [id], db);
  return r.rows[0];
}

/** Loads a booking after checking that the viewer is a participant (or admin). */
export async function loadBookingForViewer(id: string, user: AuthUser) {
  await expireOverdueBookings();
  const row = await loadBookingRow(id);
  if (!row) throw notFound('Booking');
  if (!canViewBooking(row, user)) throw forbidden('This booking does not belong to you');
  const media = (await query(
    `SELECT * FROM booking_media WHERE booking_id = $1 AND purpose IN ('PROBLEM','COMPLETION') ORDER BY created_at`, [id],
  )).rows;
  return { row, dto: toBookingDto(row, user, media) };
}
