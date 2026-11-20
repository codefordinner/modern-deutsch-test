import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { prisma } from '../db';

export const USER_SESSION_COOKIE = 'learner_session';
export const CHALLENGE_COOKIE = 'telegram_challenge';
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const getPepper = () => process.env.TELEGRAM_AUTH_PEPPER || '';
const keyedDigest = (value: string) => {
  const pepper = getPepper();
  if (Buffer.byteLength(pepper) < 32) throw new Error('TELEGRAM_AUTH_PEPPER must contain at least 32 bytes');
  return createHmac('sha256', pepper).update(value).digest('hex');
};
export const getSessionTtlSeconds = () => {
  const configured = Number(process.env.TELEGRAM_SESSION_TTL_SECONDS || SESSION_TTL_SECONDS);
  return Number.isSafeInteger(configured) && configured >= 60 && configured <= 90 * 24 * 60 * 60
    ? configured
    : SESSION_TTL_SECONDS;
};

export const createOpaqueToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const digestSessionToken = (token: string) => digest(token);
export const digestChallengeBinding = (token: string) => keyedDigest(`browser:${token}`);
export const digestChallengeCode = (code: string) => keyedDigest(`code:${code}`);

export const createLoginCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

export const safeEqual = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

export const telegramUserIdFromInitData = (
  initData: unknown,
  botToken = process.env.TELEGRAM_BOT_TOKEN,
  nowSeconds = Math.floor(Date.now() / 1000),
): string | null => {
  if (typeof initData !== 'string' || initData.length > 16_384 || !botToken) return null;
  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  const authDate = Number(params.get('auth_date'));
  const configuredAge = Number(process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS || 300);
  const maxAgeSeconds = Number.isSafeInteger(configuredAge) && configuredAge >= 60 && configuredAge <= 86_400
    ? configuredAge
    : 300;
  if (!receivedHash || !/^[a-f0-9]{64}$/i.test(receivedHash)) return null;
  if (!Number.isSafeInteger(authDate) || authDate > nowSeconds + 30 || nowSeconds - authDate > maxAgeSeconds) return null;

  const entries = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  const dataCheckString = entries.map(([key, value]) => `${key}=${value}`).join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  if (!safeEqual(receivedHash.toLowerCase(), expectedHash)) return null;

  try {
    const user = JSON.parse(params.get('user') || 'null') as { id?: unknown } | null;
    if (!user || (typeof user.id !== 'number' && typeof user.id !== 'string')) return null;
    const id = String(user.id);
    return /^\d{1,20}$/.test(id) ? id : null;
  } catch {
    return null;
  }
};

export const getCookie = (req: Request, name: string): string | null => {
  const part = req.headers.cookie
    ?.split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));
  if (!part) return null;
  try {
    return decodeURIComponent(part.slice(name.length + 1)) || null;
  } catch {
    return null;
  }
};

export const shouldUseSecureTelegramCookies = (req: Request): boolean => {
  const configuredSecure = process.env.TELEGRAM_COOKIE_SECURE;
  return configuredSecure === 'true'
    || (configuredSecure !== 'false' && (
      process.env.NODE_ENV === 'production'
      || req.secure
      || String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim() === 'https'
    ));
};

const cookieOptions = (req: Request, maxAgeSeconds: number) => {
  const secure = shouldUseSecureTelegramCookies(req);
  return [
    'Path=/',
    'HttpOnly',
    ...(secure ? ['SameSite=None', 'Secure', 'Partitioned'] : ['SameSite=Lax']),
    `Max-Age=${maxAgeSeconds}`,
  ].join('; ');
};

const appendCookie = (
  res: { setHeader: (name: string, value: string | string[]) => void; getHeader?: (name: string) => number | string | string[] | undefined },
  cookie: string,
) => {
  const current = res.getHeader?.('Set-Cookie');
  const cookies = current === undefined ? [] : Array.isArray(current) ? current.map(String) : [String(current)];
  res.setHeader('Set-Cookie', [...cookies, cookie]);
};

type CookieResponse = {
  setHeader: (name: string, value: string | string[]) => void;
  getHeader?: (name: string) => number | string | string[] | undefined;
};

export const setUserSessionCookie = (req: Request, res: CookieResponse, token: string) => {
  const ttl = getSessionTtlSeconds();
  appendCookie(res, `${USER_SESSION_COOKIE}=${encodeURIComponent(token)}; ${cookieOptions(req, ttl)}`);
};

export const clearUserSessionCookie = (req: Request, res: CookieResponse) => {
  appendCookie(res, `${USER_SESSION_COOKIE}=; ${cookieOptions(req, 0)}`);
};

export const setChallengeCookie = (req: Request, res: CookieResponse, token: string) => {
  appendCookie(res, `${CHALLENGE_COOKIE}=${encodeURIComponent(token)}; ${cookieOptions(req, Math.ceil(CHALLENGE_TTL_MS / 1000))}`);
};

export const clearChallengeCookie = (req: Request, res: CookieResponse) => {
  appendCookie(res, `${CHALLENGE_COOKIE}=; ${cookieOptions(req, 0)}`);
};

export const findCurrentUser = async (req: Request) => {
  const token = getCookie(req, USER_SESSION_COOKIE);
  if (!token) return null;
  const session = await prisma.userSession.findUnique({
    where: { tokenDigest: digestSessionToken(token) },
    include: { user: { select: { id: true, telegramId: true, isAdmin: true } } },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;
  return { id: session.user.id, telegramId: session.user.telegramId, isAdmin: session.user.isAdmin };
};

export const createUserSession = async (userId: string) => {
  const token = createOpaqueToken();
  const ttl = getSessionTtlSeconds();
  await prisma.userSession.create({
    data: {
      userId,
      tokenDigest: digestSessionToken(token),
      expiresAt: new Date(Date.now() + ttl * 1000),
    },
  });
  return token;
};

export const getOrCreateTelegramUser = (telegramId: string) =>
  prisma.telegramUser.upsert({ where: { telegramId }, create: { telegramId }, update: {} });

export const challengeCookieDigest = (token: string) => digestChallengeBinding(token);
