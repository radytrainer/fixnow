import type { NextFunction, Request, Response } from 'express';
import { AppError } from './errors';

/**
 * Fixed-window in-memory rate limiter. Good enough for a single API instance;
 * a multi-instance deployment would need a shared store (e.g. Redis).
 */
export function rateLimit(opts: { windowMs: number; max: number; key?: (req: Request) => string; name: string }) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }, opts.windowMs).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.DISABLE_RATE_LIMIT === 'true') return next();
    const id = `${opts.name}:${req.ip}:${opts.key?.(req) ?? ''}`;
    const now = Date.now();
    let entry = hits.get(id);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + opts.windowMs };
      hits.set(id, entry);
    }
    entry.count++;
    res.setHeader('RateLimit-Limit', String(opts.max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, opts.max - entry.count)));
    if (entry.count > opts.max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return next(new AppError(429, 'RATE_LIMITED', 'Too many attempts. Please wait and try again.'));
    }
    next();
  };
}

/** Basic hardening headers for a JSON API. */
export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}
