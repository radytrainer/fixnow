import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@fixnow/shared';
import { config } from '../config';
import { one } from '../db/pool';
import { forbidden, unauthorized } from './errors';

export interface AuthUser {
  id: string;
  role: Role;
  name: string | null;
  technicianId: string | null;
  technicianStatus: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request { user?: AuthUser }
  }
}

export function signToken(userId: string, role: Role) {
  return jwt.sign({ sub: userId, role }, config.jwtSecret, { expiresIn: '7d' });
}

/** Verifies the bearer token and reloads the user, so role/suspension changes apply immediately. */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return next(unauthorized());
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
  } catch {
    return next(unauthorized('Session expired or invalid. Please sign in again.'));
  }
  const user = await one(
    `SELECT u.id, u.role, u.name, u.is_active, tp.id AS technician_id, tp.status AS technician_status
       FROM users u LEFT JOIN technician_profiles tp ON tp.user_id = u.id
      WHERE u.id = $1`,
    [payload.sub],
  );
  if (!user || !user.is_active) return next(unauthorized('Account is not active'));
  req.user = {
    id: user.id, role: user.role, name: user.name,
    technicianId: user.technician_id, technicianStatus: user.technician_status,
  };
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
}

export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}

export function maskPhone(phone: string) {
  return phone.length > 7 ? `${phone.slice(0, 4)} ••• ••${phone.slice(-3)}` : '•••';
}
