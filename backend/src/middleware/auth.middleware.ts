import { Request, Response, NextFunction } from 'express';
import { findCurrentUser } from '../services/telegramAuth';

/** Admin access is granted only to an authenticated Telegram user with the DB flag. */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  void findCurrentUser(req).then((user) => {
    if (user?.isAdmin) return next();
    return res.status(403).json({ error: 'Доступ разрешён только администраторам.' });
  }).catch(next);
};
