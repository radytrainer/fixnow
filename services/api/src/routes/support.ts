import { Router } from 'express';
import { z } from 'zod';
import { TICKET_CATEGORIES, type SupportTicketDto } from '@fixnow/shared';
import { one, query } from '../db/pool';
import { canViewBooking } from '../domain/bookings';
import { authenticate, currentUser, requireRole } from '../http/auth';
import { AppError, forbidden, notFound } from '../http/errors';

export const supportRouter = Router();
supportRouter.use(authenticate);

/** Support channel is between a user and FixNow staff only (no customer–technician chat). */
supportRouter.post('/support-tickets', requireRole('CUSTOMER', 'TECHNICIAN'), async (req, res) => {
  const user = currentUser(req);
  const body = z.object({
    category: z.enum(TICKET_CATEGORIES),
    description: z.string().trim().min(10, 'Please give a little more detail (10+ characters)').max(2000),
    bookingId: z.uuid().optional(),
  }).parse(req.body);
  if (body.bookingId) {
    const b = await one(`SELECT id, customer_id, technician_id FROM bookings WHERE id = $1`, [body.bookingId]);
    if (!b) throw notFound('Booking');
    if (!canViewBooking(b, user)) throw forbidden('This booking does not belong to you');
  }
  const t = await one(
    `INSERT INTO support_tickets (created_by, booking_id, category, description) VALUES ($1, $2, $3, $4) RETURNING id`,
    [user.id, body.bookingId ?? null, body.category, body.description],
  );
  res.status(201).json({ id: t.id });
});

supportRouter.get('/support-tickets', requireRole('CUSTOMER', 'TECHNICIAN'), async (req, res) => {
  const user = currentUser(req);
  const rows = (await query(
    `SELECT t.*, b.booking_code FROM support_tickets t LEFT JOIN bookings b ON b.id = t.booking_id WHERE t.created_by = $1 ORDER BY t.created_at DESC`,
    [user.id],
  )).rows;
  const items: SupportTicketDto[] = rows.map((t) => ({
    id: t.id, ticketCode: t.ticket_code, category: t.category, description: t.description, status: t.status,
    bookingCode: t.booking_code, adminNote: t.admin_note, createdAt: t.created_at.toISOString(), resolvedAt: t.resolved_at?.toISOString() ?? null,
  }));
  res.json({ items });
});

/** Placeholder for a real KHQR provider. Deliberately refuses until signature verification is implemented. */
supportRouter.post('/payments/webhook/:provider', () => {
  throw new AppError(501, 'NOT_IMPLEMENTED', 'No payment gateway is integrated. Payments are simulated (DEMO) and confirmed by an admin.');
});
