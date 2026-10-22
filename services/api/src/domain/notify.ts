import { pool, type Db } from '../db/pool';

/**
 * Notification types. The client owns the wording (EN/KM); the server only stores the type and safe params.
 * Never put phone numbers, customer names or exact addresses into params.
 */
export type NotificationType =
  | 'BOOKING_REQUESTED' | 'BOOKING_ACCEPTED' | 'BOOKING_DECLINED' | 'BOOKING_EXPIRED' | 'BOOKING_EXPIRED_TECH'
  | 'BOOKING_STARTED' | 'BOOKING_FINISHED' | 'BOOKING_CANCELLED' | 'CUSTOMER_NOT_AVAILABLE'
  | 'PAYMENT_CONFIRMED' | 'PAYMENT_CONFIRMED_TECH' | 'PAYMENT_REFUNDED' | 'PAYOUT_PAID'
  | 'RATING_RECEIVED' | 'WARRANTY_REQUESTED' | 'WARRANTY_UPDATED'
  | 'TECHNICIAN_APPROVED' | 'TECHNICIAN_REJECTED' | 'TECHNICIAN_SUSPENDED' | 'TECHNICIAN_REINSTATED'
  | 'TICKET_UPDATED' | 'BOOKING_DISPUTED';

export async function notify(db: Db, userId: string, type: NotificationType, params: Record<string, unknown> = {}, bookingId: string | null = null) {
  await db.query(
    `INSERT INTO notifications (user_id, type, booking_id, params) VALUES ($1, $2, $3, $4)`,
    [userId, type, bookingId, JSON.stringify(params)],
  );
}

/** Loads the safe, coarse booking facts used in notification params. */
export async function bookingFacts(db: Db, bookingId: string) {
  const r = await db.query(
    `SELECT b.id, b.booking_code, b.customer_id, b.service_area, b.final_amount, tp.user_id AS technician_user_id,
            s.name_en, s.name_km
       FROM bookings b JOIN booking_service_summary s ON s.booking_id = b.id JOIN technician_profiles tp ON tp.id = b.technician_id
      WHERE b.id = $1`, [bookingId],
  );
  const b = r.rows[0];
  if (!b) return null;
  return {
    customerId: b.customer_id as string,
    technicianUserId: b.technician_user_id as string,
    params: { bookingCode: b.booking_code, serviceEn: b.name_en, serviceKm: b.name_km, area: b.service_area, amount: b.final_amount },
  };
}

/** Notifies one side of a booking. Errors are logged, never thrown, so a notification can't break a state change. */
export async function notifyBooking(
  bookingId: string, who: 'customer' | 'technician' | 'both', type: NotificationType, extra: Record<string, unknown> = {},
  techType?: NotificationType, db: Db = pool,
) {
  try {
    const f = await bookingFacts(db, bookingId);
    if (!f) return;
    const params = { ...f.params, ...extra };
    if (who === 'customer' || who === 'both') await notify(db, f.customerId, type, params, bookingId);
    if (who === 'technician' || who === 'both') await notify(db, f.technicianUserId, techType ?? type, params, bookingId);
  } catch (err) {
    console.error('[notify] failed', type, err);
  }
}
