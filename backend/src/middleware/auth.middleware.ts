import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

/** Lifetime of an admin session. Kept in sync with the cookie's Max-Age. */
export const TOKEN_TTL_SECONDS = 24 * 60 * 60;
export const AUTH_COOKIE_NAME = 'admin_token';

const DEFAULT_ADMIN_PASSWORD = 'admin';

export const getAdminPassword = () => process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;

let warnedAboutSecret = false;
let warnedAboutPassword = false;

/**
 * Secret used to sign admin JWTs. Set `JWT_SECRET` (any long random string,
 * the same value on every instance) — tokens are then stateless, survive
 * restarts and work behind a load balancer.
 *
 * If it is missing we fall back to a key derived from ADMIN_PASSWORD, which is
 * still stable across restarts/instances (and rotating the password
 * invalidates all sessions) but is only as strong as the password itself.
 */
const getJwtSecret = (): string => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

  if (!warnedAboutSecret) {
    warnedAboutSecret = true;
    console.warn('[auth] JWT_SECRET is not set; deriving the signing key from ADMIN_PASSWORD. Set JWT_SECRET in production.');
  }
  return crypto.createHash('sha256').update(`deutsch-admin-jwt:${getAdminPassword()}`).digest('hex');
};

/** Constant-time password check (hashing first makes the buffers equal-length). */
export const isValidAdminPassword = (candidate: unknown): boolean => {
  if (typeof candidate !== 'string' || candidate.length === 0) return false;

  const expected = getAdminPassword();
  if (expected === DEFAULT_ADMIN_PASSWORD && !warnedAboutPassword) {
    warnedAboutPassword = true;
    console.warn('[auth] ADMIN_PASSWORD is not set; the default password is in use. Set ADMIN_PASSWORD in production.');
  }

  const hash = (value: string) => crypto.createHash('sha256').update(value).digest();
  return crypto.timingSafeEqual(hash(candidate), hash(expected));
};

export const signAdminToken = (): string =>
  jwt.sign({ role: 'admin' }, getJwtSecret(), { algorithm: 'HS256', expiresIn: TOKEN_TTL_SECONDS });

const verifyAdminToken = (token: string): boolean => {
  try {
    const payload = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
    return typeof payload === 'object' && payload !== null && payload.role === 'admin';
  } catch {
    return false; // bad signature, malformed or expired
  }
};

/** Reads the token from `Authorization: Bearer …`, falling back to the auth cookie. */
export const extractToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);

  const cookie = req.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AUTH_COOKIE_NAME}=`));
  if (!cookie) return null;

  const value = cookie.slice(AUTH_COOKIE_NAME.length + 1);
  try {
    return decodeURIComponent(value) || null;
  } catch {
    return null;
  }
};

export const isAdminRequest = (req: Request): boolean => {
  const token = extractToken(req);
  return token !== null && verifyAdminToken(token);
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (isAdminRequest(req)) return next();
  return res.status(401).json({ error: 'Unauthorized: Admin privileges required' });
};
