import { Request, Response, NextFunction } from 'express';

/**
 * CSRF protection for cookie-authenticated requests, done by checking where the
 * request came from: browsers attach an `Origin` header to every cross-origin
 * (and every same-origin POST/PUT/DELETE) request and scripts cannot forge it.
 *
 * Rules for state-changing methods:
 *  - `Origin` (or, failing that, `Referer`) must point at this site — the `Host`
 *    the request was addressed to (`X-Forwarded-Host` behind the nginx proxy) —
 *    or at one of the comma-separated origins in `ALLOWED_ORIGINS`;
 *  - no `Origin` and no `Referer` means a non-browser client (curl, scripts).
 *    A browser never omits both on such a request, so this cannot be CSRF.
 *
 * Together with `SameSite=Strict` on the auth cookie this closes the CSRF hole
 * that appears once the JWT lives only in a cookie.
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const firstValue = (header: string | string[] | undefined): string | undefined =>
  (Array.isArray(header) ? header[0] : header)?.split(',')[0]?.trim() || undefined;

const parseOrigin = (value: string | undefined): URL | null => {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null; // includes the literal "null" origin of sandboxed frames
  }
};

const allowedOrigins = (): string[] =>
  (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

export const requireSameOrigin = (req: Request, res: Response, next: NextFunction) => {
  if (SAFE_METHODS.has(req.method)) return next();

  const originHeader = firstValue(req.headers.origin);
  const refererHeader = firstValue(req.headers.referer);
  if (originHeader === undefined && refererHeader === undefined) return next();

  const source = parseOrigin(originHeader ?? refererHeader);
  if (source) {
    const hosts = [firstValue(req.headers['x-forwarded-host']), firstValue(req.headers.host)];
    if (hosts.includes(source.host) || allowedOrigins().includes(source.origin)) return next();
  }

  return res.status(403).json({ error: 'Cross-origin request blocked' });
};
