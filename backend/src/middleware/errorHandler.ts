import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';

/**
 * Prisma maps "record not found" and "unique constraint violated" to these
 * error codes. The routes previously let them bubble up as a 500; this turns
 * them into the correct 404 / 409 so the client can show a real message.
 */
export const isPrismaError = (error: unknown, code: string): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

/**
 * Central JSON error handler. Kept out of index.ts / server.ts so BOTH entry
 * points return the same JSON shape instead of Express's HTML page on a 500.
 * The production Docker image uses backend/src/index.ts, which had no handler.
 */
export function apiErrorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) return next(err);

  // An already-short status (e.g. a rate-limit 429 raised via next()) is kept.
  const status = typeof err === 'object' && err !== null && 'status' in err && typeof (err as { status: unknown }).status === 'number'
    ? (err as { status: number }).status
    : 500;

  const message = err instanceof Error ? err.message : undefined;
  if (status >= 500) console.error('[api error]:', err);
  res.status(status).json({ error: status === 500 ? 'Внутренняя ошибка сервера' : message || 'Ошибка запроса' });
}
