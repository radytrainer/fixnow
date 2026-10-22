import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) => new AppError(400, 'VALIDATION_ERROR', message, details);
export const unauthorized = (message = 'Sign in required') => new AppError(401, 'UNAUTHENTICATED', message);
export const forbidden = (message = 'You do not have permission to do this') => new AppError(403, 'FORBIDDEN', message);
export const notFound = (what = 'Resource') => new AppError(404, 'NOT_FOUND', `${what} not found`);
export const conflict = (code: string, message: string) => new AppError(409, code, message);

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: err.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '),
      details: err.issues,
    });
    return;
  }
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ code: 'PAYLOAD_TOO_LARGE', message: 'Upload is too large' });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Malformed JSON body' });
    return;
  }
  // Postgres invalid uuid text -> treat as not found rather than 500.
  if (err?.code === '22P02') {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Resource not found' });
    return;
  }
  console.error('[api] unhandled error', err);
  res.status(500).json({ code: 'INTERNAL', message: 'Something went wrong. Please retry.' });
};
