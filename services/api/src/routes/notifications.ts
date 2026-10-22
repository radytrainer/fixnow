import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool';
import { expireOverdueBookings } from '../domain/bookings';
import { authenticate, currentUser } from '../http/auth';

export const notificationsRouter = Router();
notificationsRouter.use('/notifications', authenticate);

notificationsRouter.get('/notifications', async (req, res) => {
  const user = currentUser(req);
  const q = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(30),
    after: z.iso.datetime({ offset: true }).optional(),
  }).parse(req.query);
  // Keep expiry notifications timely even when the background sweep hasn't run yet.
  await expireOverdueBookings();
  const params: unknown[] = [user.id];
  let where = 'user_id = $1';
  if (q.after) { params.push(q.after); where += ` AND created_at > $2`; }
  const unread = (await query(`SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL`, [user.id])).rows[0].n;
  params.push(q.pageSize, (q.page - 1) * q.pageSize);
  const rows = (await query(
    `SELECT id, type, booking_id, params, read_at, created_at FROM notifications WHERE ${where}
      ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params,
  )).rows;
  res.json({
    unread,
    items: rows.map((n) => ({
      id: n.id, type: n.type, bookingId: n.booking_id, params: n.params, read: !!n.read_at, createdAt: n.created_at.toISOString(),
    })),
  });
});

notificationsRouter.post('/notifications/read', async (req, res) => {
  const user = currentUser(req);
  const { ids } = z.object({ ids: z.array(z.uuid()).max(200).optional() }).parse(req.body ?? {});
  const r = ids?.length
    ? await query(`UPDATE notifications SET read_at = now() WHERE user_id = $1 AND id = ANY($2) AND read_at IS NULL`, [user.id, ids])
    : await query(`UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL`, [user.id]);
  res.json({ marked: r.rowCount });
});
