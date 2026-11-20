import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../db';
import { requireAdmin } from '../middleware/auth.middleware';
import { findCurrentUser } from '../services/telegramAuth';

const router = Router();
const asyncRoute = (handler: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => { void handler(req, res).catch(next); };

router.get('/', requireAdmin, asyncRoute(async (_req, res) => {
  const users = await prisma.telegramUser.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, telegramId: true, isAdmin: true, isBanned: true, createdAt: true,
      progress: { select: { updatedAt: true } },
    },
  });
  return res.json({ users: users.map(({ progress, ...user }) => ({
    ...user,
    progressUpdatedAt: progress?.updatedAt ?? null,
    hasProgress: Boolean(progress),
  })) });
}));

router.get('/:id/progress', requireAdmin, asyncRoute(async (req, res) => {
  const progress = await prisma.learnerProgress.findUnique({
    where: { userId: req.params.id },
    select: { data: true, revision: true, updatedAt: true },
  });
  if (!progress) return res.json({ progress: null });
  try {
    return res.json({ progress: { ...progress, data: JSON.parse(progress.data) } });
  } catch {
    return res.json({ progress: { ...progress, data: null } });
  }
}));

router.patch('/:id/admin', requireAdmin, asyncRoute(async (req, res) => {
  if (typeof req.body?.isAdmin !== 'boolean') return res.status(400).json({ error: 'Укажите новое состояние прав администратора.' });
  const target = await prisma.telegramUser.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ error: 'Пользователь не найден.' });
  const actor = await findCurrentUser(req);
  if (actor?.id === target.id && !req.body.isAdmin) return res.status(400).json({ error: 'Нельзя снять права администратора с самого себя.' });
  if (target.isAdmin && !req.body.isAdmin) {
    const admins = await prisma.telegramUser.count({ where: { isAdmin: true } });
    if (admins <= 1) return res.status(409).json({ error: 'Нельзя снять права у последнего администратора.' });
  }
  await prisma.telegramUser.update({ where: { id: target.id }, data: { isAdmin: req.body.isAdmin } });
  return res.json({ success: true });
}));

router.patch('/:id/ban', requireAdmin, asyncRoute(async (req, res) => {
  if (typeof req.body?.isBanned !== 'boolean') return res.status(400).json({ error: 'Укажите новое состояние блокировки.' });
  const target = await prisma.telegramUser.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ error: 'Пользователь не найден.' });
  const actor = await findCurrentUser(req);
  if (actor?.id === target.id && req.body.isBanned) return res.status(400).json({ error: 'Нельзя заблокировать самого себя.' });
  if (target.isAdmin && req.body.isBanned) return res.status(409).json({ error: 'Сначала снимите с пользователя права администратора.' });
  await prisma.telegramUser.update({ where: { id: target.id }, data: { isBanned: req.body.isBanned } });
  if (req.body.isBanned) {
    await prisma.userSession.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date() } });
  }
  return res.json({ success: true });
}));

router.delete('/:id/progress', requireAdmin, asyncRoute(async (req, res) => {
  const result = await prisma.learnerProgress.deleteMany({ where: { userId: req.params.id } });
  return res.json({ success: true, deleted: result.count });
}));

router.delete('/:id', requireAdmin, asyncRoute(async (req, res) => {
  const target = await prisma.telegramUser.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ error: 'Пользователь не найден.' });
  const actor = await findCurrentUser(req);
  if (actor?.id === target.id) return res.status(400).json({ error: 'Нельзя удалить собственный аккаунт.' });
  if (target.isAdmin) {
    const admins = await prisma.telegramUser.count({ where: { isAdmin: true } });
    if (admins <= 1) return res.status(409).json({ error: 'Нельзя удалить последнего администратора.' });
  }
  await prisma.telegramUser.delete({ where: { id: target.id } });
  return res.json({ success: true });
}));

export default router;
