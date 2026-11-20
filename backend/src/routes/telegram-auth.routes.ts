import { Router, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../db';
import { syncLearnerProgress } from '../services/learnerProgress';
import {
  CHALLENGE_TTL_MS,
  challengeCookieDigest,
  clearChallengeCookie,
  clearUserSessionCookie,
  createLoginCode,
  createOpaqueToken,
  createUserSession,
  digestChallengeCode,
  digestSessionToken,
  findCurrentUser,
  getCookie,
  getSessionTtlSeconds,
  getOrCreateTelegramUser,
  setChallengeCookie,
  setUserSessionCookie,
  telegramUserIdFromInitData,
  CHALLENGE_COOKIE,
  USER_SESSION_COOKIE,
} from '../services/telegramAuth';

const router = Router();
const limiter = (windowMs: number, limit: number, message: string) => rateLimit({
  windowMs,
  limit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: message },
});

const miniAppLimiter = limiter(60_000, 10, 'Слишком много попыток входа. Попробуйте позже.');
const issueLimiter = limiter(15 * 60_000, 5, 'Слишком часто запрашивается код. Попробуйте позже.');
const statusLimiter = limiter(60_000, 30, 'Слишком частые проверки. Попробуйте чуть позже.');
const completeLimiter = limiter(60_000, 10, 'Слишком много попыток завершить вход.');
const asyncRoute = (handler: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res).catch(next);
  };

router.get('/config', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ required: true });
});

router.post('/telegram/mini-app', miniAppLimiter, asyncRoute(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const telegramId = telegramUserIdFromInitData(req.body?.initData);
  if (!telegramId) return res.status(401).json({ error: 'Не удалось проверить данные Telegram. Откройте приложение заново.' });

  const user = await getOrCreateTelegramUser(telegramId);
  const token = await createUserSession(user.id);
  setUserSessionCookie(req, res, token);
  return res.json({ authenticated: true, user: { id: user.id, isAdmin: user.isAdmin } });
}));

router.post('/telegram/challenge', issueLimiter, asyncRoute(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const telegramUsername = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, '');
  if (
    !telegramUsername
    || !/^[A-Za-z0-9_]{5,32}$/.test(telegramUsername)
    || Buffer.byteLength(process.env.TELEGRAM_AUTH_PEPPER || '') < 32
  ) {
    return res.status(503).json({ error: 'Вход через Telegram временно не настроен.' });
  }

  const browserToken = createOpaqueToken();
  const bindingDigest = challengeCookieDigest(browserToken);
  const now = new Date();
  const expired = await prisma.telegramChallenge.findMany({
    where: { expiresAt: { lte: now } },
    select: { id: true },
    take: 200,
  });
  if (expired.length) {
    await prisma.telegramChallenge.deleteMany({ where: { id: { in: expired.map(({ id }) => id) } } });
  }
  await prisma.telegramChallenge.deleteMany({ where: { browserBindingDigest: bindingDigest } });

  let code = '';
  let codeDigest = '';
  for (let attempt = 0; attempt < 10; attempt += 1) {
    code = createLoginCode();
    codeDigest = digestChallengeCode(code);
    const collision = await prisma.telegramChallenge.findUnique({ where: { codeDigest } });
    if (!collision) break;
    code = '';
  }
  if (!code) return res.status(503).json({ error: 'Не удалось подготовить код. Попробуйте ещё раз.' });

  const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MS);
  await prisma.telegramChallenge.create({
    data: { codeDigest, browserBindingDigest: bindingDigest, expiresAt },
  });
  setChallengeCookie(req, res, browserToken);
  return res.json({
    code,
    expiresAt: expiresAt.toISOString(),
    botUrl: `https://t.me/${encodeURIComponent(telegramUsername)}`,
    botUsername: telegramUsername,
  });
}));

router.get('/telegram/challenge/status', statusLimiter, asyncRoute(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const browserToken = getCookie(req, CHALLENGE_COOKIE);
  if (!browserToken) return res.status(401).json({ error: 'Срок входа истёк. Запросите новый код.' });
  const challenge = await prisma.telegramChallenge.findFirst({
    where: { browserBindingDigest: challengeCookieDigest(browserToken), status: { in: ['pending', 'confirmed'] } },
    select: { status: true, expiresAt: true },
  });
  if (!challenge || challenge.expiresAt <= new Date()) {
    return res.status(410).json({ error: 'Срок действия кода истёк. Запросите новый.' });
  }
  return res.json({ status: challenge.status, expiresAt: challenge.expiresAt.toISOString() });
}));

router.post('/telegram/challenge/complete', completeLimiter, asyncRoute(async (req, res) => {
  const browserToken = getCookie(req, CHALLENGE_COOKIE);
  if (!browserToken) return res.status(401).json({ error: 'Срок входа истёк. Запросите новый код.' });
  const bindingDigest = challengeCookieDigest(browserToken);
  const token = createOpaqueToken();

  const userId = await prisma.$transaction(async (tx) => {
    const lookupTime = new Date();
    const challenge = await tx.telegramChallenge.findFirst({
      where: {
        browserBindingDigest: bindingDigest,
        status: 'confirmed',
        expiresAt: { gt: lookupTime },
        consumedAt: null,
      },
      select: { id: true, telegramUserId: true },
    });
    if (!challenge?.telegramUserId) return null;
    const consumedAt = new Date();
    const consumed = await tx.telegramChallenge.updateMany({
      where: { id: challenge.id, status: 'confirmed', consumedAt: null, expiresAt: { gt: consumedAt } },
      data: { status: 'consumed', consumedAt },
    });
    if (consumed.count !== 1) return null;
    await tx.userSession.create({
      data: {
        userId: challenge.telegramUserId,
        tokenDigest: digestSessionToken(token),
        expiresAt: new Date(Date.now() + getSessionTtlSeconds() * 1000),
      },
    });
    return challenge.telegramUserId;
  });

  if (!userId) return res.status(409).json({ error: 'Подтверждение не найдено или уже использовано.' });
  setUserSessionCookie(req, res, token);
  clearChallengeCookie(req, res);
  res.setHeader('Cache-Control', 'no-store');
  const user = await prisma.telegramUser.findUniqueOrThrow({ where: { id: userId }, select: { isAdmin: true } });
  return res.json({ authenticated: true, user: { id: userId, isAdmin: user.isAdmin } });
}));

router.get('/me', asyncRoute(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const user = await findCurrentUser(req);
  if (!user) {
    clearUserSessionCookie(req, res);
    return res.status(401).json({ error: 'Требуется войти через Telegram.' });
  }
  return res.json({ authenticated: true, user: { id: user.id, isAdmin: user.isAdmin } });
}));

router.post('/logout', asyncRoute(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const token = getCookie(req, USER_SESSION_COOKIE);
  if (token) {
    await prisma.userSession.updateMany({
      where: { tokenDigest: digestSessionToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  clearUserSessionCookie(req, res);
  clearChallengeCookie(req, res);
  return res.json({ success: true });
}));

router.post('/progress/srs', limiter(60_000, 60, 'Слишком много запросов синхронизации. Подождите минуту.'), asyncRoute(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const user = await findCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Требуется войти через Telegram.' });

  try {
    const result = await syncLearnerProgress({
      learnerProgress: {
        findUnique: (args) => prisma.learnerProgress.findUnique(args),
        create: (args) => prisma.learnerProgress.create(args),
        updateMany: (args) => prisma.learnerProgress.updateMany(args),
      },
    }, user.id, req.body?.data);
    return res.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Синхронизация занята. Повторите попытку.') {
      return res.status(409).json({ error: error.message });
    }
    throw error;
  }
}));

export default router;
