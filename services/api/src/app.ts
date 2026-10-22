import cors from 'cors';
import express from 'express';
import { config } from './config';
import { pool } from './db/pool';
import { errorHandler, notFound } from './http/errors';
import { adminRouter } from './routes/admin';
import { authRouter } from './routes/auth';
import { bookingsRouter } from './routes/bookings';
import { catalogRouter } from './routes/catalog';
import { meRouter } from './routes/me';
import { notificationsRouter } from './routes/notifications';
import { supportRouter } from './routes/support';
import { techniciansRouter } from './routes/technicians';
import { resolveSigned } from './storage';
import { securityHeaders } from './http/rateLimit';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use(securityHeaders);
  app.use(cors({ origin: config.corsOrigins.includes('*') ? true : config.corsOrigins }));
  app.use(express.json({ limit: '12mb' }));

  app.get('/api/health', async (_req, res) => {
    const db = await pool.query('SELECT now() AS now');
    res.json({ ok: true, demoMode: config.demoMode, serverTime: db.rows[0].now });
  });

  // Signed, short-lived access to private files.
  app.get('/api/files/*key', (req, res) => {
    const key = ([] as string[]).concat((req.params as any).key).join('/');
    const full = resolveSigned(key, String(req.query.exp ?? ''), String(req.query.sig ?? ''));
    if (!full) { res.status(403).json({ code: 'FORBIDDEN', message: 'Link expired or invalid' }); return; }
    res.setHeader('Cache-Control', 'private, max-age=600');
    res.sendFile(full);
  });

  app.use('/api/auth', authRouter);
  app.use('/api', catalogRouter);
  app.use('/api', adminRouter);
  app.use('/api', meRouter);
  app.use('/api', techniciansRouter);
  app.use('/api', bookingsRouter);
  app.use('/api', supportRouter);
  app.use('/api', notificationsRouter);

  app.use((_req, _res, next) => next(notFound('Endpoint')));
  app.use(errorHandler);
  return app;
}
