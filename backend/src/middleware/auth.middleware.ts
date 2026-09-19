import { Request, Response, NextFunction } from 'express';

export const validTokens = new Set<string>();

export const getAdminPassword = () => process.env.ADMIN_PASSWORD || 'admin';

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const cookieToken = req.headers.cookie
    ?.split(';')
    .find((c) => c.trim().startsWith('admin_token='))
    ?.split('=')[1];

  const activeToken = token || cookieToken;

  if (activeToken && validTokens.has(activeToken)) {
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized: Admin privileges required' });
};
