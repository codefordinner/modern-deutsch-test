import crypto from 'crypto';
import { Request, Response } from 'express';

/**
 * Anonymous visitor identity for the statistics. Counting unique visitors by IP address is
 * wrong: one person has several IPs (Wi-Fi / mobile data, IPv4 / IPv6, a rotating mobile
 * carrier address), and different people can share one. So a random id is stored in a
 * long-lived HttpOnly cookie instead.
 */
export const VISITOR_COOKIE_NAME = 'visitor_id';
const VISITOR_COOKIE_MAX_AGE_SECONDS = 2 * 365 * 24 * 60 * 60;
const VALID_VISITOR_ID = /^[A-Za-z0-9-]{16,64}$/;

const isSecureRequest = (req: Request): boolean =>
  req.secure || String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim() === 'https';

function readVisitorCookie(req: Request): string | null {
  const part = req.headers.cookie
    ?.split(';')
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${VISITOR_COOKIE_NAME}=`));
  if (!part) return null;
  const value = part.slice(VISITOR_COOKIE_NAME.length + 1);
  return VALID_VISITOR_ID.test(value) ? value : null;
}

/**
 * Returns the visitor's id from the cookie, or mints a new one. The cookie is (re)sent on every
 * call, so it stays alive for two years after the LAST visit.
 */
export function resolveVisitorId(req: Request, res: Response): string {
  const id = readVisitorCookie(req) ?? crypto.randomUUID();
  const attributes = [
    `${VISITOR_COOKIE_NAME}=${id}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${VISITOR_COOKIE_MAX_AGE_SECONDS}`,
  ];
  if (isSecureRequest(req)) attributes.push('Secure');
  res.append('Set-Cookie', attributes.join('; '));
  return id;
}
