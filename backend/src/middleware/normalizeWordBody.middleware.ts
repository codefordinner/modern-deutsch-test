import { Request, Response, NextFunction } from 'express';
import { normalizeHilfsverb } from '../services/hilfsverb';

/** Old clients may still send 'ist' / 'hat'; store the canonical 'sein' / 'haben'. */
export const normalizeWordBody = (req: Request, _res: Response, next: NextFunction) => {
  if ((req.method === 'POST' || req.method === 'PUT') && req.body && typeof req.body === 'object') {
    const normalized = normalizeHilfsverb(req.body.hilfsverb);
    if (normalized) req.body.hilfsverb = normalized;
  }
  next();
};
