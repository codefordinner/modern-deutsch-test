import { timingSafeEqual } from 'node:crypto';
import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../db';
import { generateWordFill } from '../services/aiSettings';
import { recordAIError } from '../services/aiErrorLog';
import { isPartOfSpeech } from '../services/partOfSpeech';
import { ImportFormatError } from '../services/wordImport';
import { importWords } from '../services/wordImportService';
import { digestChallengeCode } from '../services/telegramAuth';

const router = Router();
const requireHermesToken = (req: Request, res: Response, next: NextFunction) => {
  const configured = process.env.HERMES_WORD_IMPORT_TOKEN;
  const header = req.headers.authorization;
  const supplied = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!configured) return res.status(404).json({ error: 'Внутренний импорт не настроен' });
  const expected = Buffer.from(configured);
  const actual = Buffer.from(supplied);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return res.status(401).json({ error: 'Недействительный токен внутреннего импорта' });
  }
  return next();
};

/**
 * The single-call integration for trusted local automation. It uses the same
 * Gemini profile and import rules as the admin UI, but authenticates with a
 * separate server-side token instead of the browser's admin cookie.
 */
router.post('/word-import', requireHermesToken, async (req, res) => {
  const words = typeof req.body?.words === 'string' ? req.body.words.trim() : '';
  if (!words) return res.status(400).json({ error: 'Введите список слов' });

  try {
    const categories = await prisma.category.findMany();
    const generated = await generateWordFill({
      words,
      categories: categories.map((category) => category.name),
    });

    let summary;
    try {
      summary = await importWords({ data: generated.json });
    } catch (error) {
      if (error instanceof ImportFormatError) return res.status(502).json({ error: error.message });
      throw error;
    }
    return res.json({ ...summary, generatedCount: generated.count });
  } catch (error) {
    await recordAIError({ operation: 'word-fill', profileId: 'wordFill', error });
    console.error('[internal word-import] failed:', error);
    if (error instanceof Error) {
      const messages: Record<string, [number, string]> = {
        MISSING_API_KEY: [503, 'ИИ пока не настроен: сохраните ключ Gemini и выберите модель'],
        MISSING_MODEL: [503, 'Для заполнения слов не выбрана модель Gemini'],
        EMPTY_WORDS: [400, 'Введите список слов'],
        WORDS_TOO_LONG: [400, 'Слишком длинный список слов'],
        WORDS_TOO_MANY: [400, 'Слишком много слов за раз (максимум 1000)'],
        AI_TIMEOUT: [504, 'ИИ не ответил вовремя. Попробуйте ещё раз.'],
        INVALID_API_KEY: [400, 'Ключ Gemini недействителен'],
        INVALID_AI_RESPONSE: [502, 'ИИ вернул некорректный ответ — попробуйте ещё раз'],
        GEMINI_UNAVAILABLE: [502, 'Gemini временно недоступен'],
      };
      const result = messages[error.message];
      if (result) return res.status(result[0]).json({ error: result[1] });
    }
    return res.status(500).json({ error: 'Не удалось добавить слова через внутренний импорт' });
  }
});

const requireTelegramBotSecret = (req: Request, res: Response, next: NextFunction) => {
  const configured = process.env.TELEGRAM_BOT_API_SECRET;
  const supplied = req.headers['x-telegram-bot-secret'];
  const expected = Buffer.from(configured || '');
  const actual = Buffer.from(typeof supplied === 'string' ? supplied : '');
  if (!configured || expected.length < 32 || expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return res.status(401).json({ error: 'Недействительные внутренние учётные данные' });
  }
  return next();
};

const telegramConfirmLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

const telegramAttempts = new Map<string, { count: number; resetAt: number }>();
let attemptsCleanupAt = 0;
const allowTelegramAttempt = (telegramId: string) => {
  const now = Date.now();
  if (now >= attemptsCleanupAt) {
    for (const [id, bucket] of telegramAttempts) {
      if (bucket.resetAt <= now) telegramAttempts.delete(id);
    }
    attemptsCleanupAt = now + 60_000;
  }
  let bucket = telegramAttempts.get(telegramId);
  if (!bucket || bucket.resetAt <= now) {
    if (telegramAttempts.size >= 5_000) {
      const oldestKey = telegramAttempts.keys().next().value;
      if (oldestKey) telegramAttempts.delete(oldestKey);
    }
    bucket = { count: 0, resetAt: now + 60_000 };
    telegramAttempts.set(telegramId, bucket);
  }
  bucket.count += 1;
  return bucket.count <= 5;
};

router.post('/telegram/confirm', telegramConfirmLimiter, requireTelegramBotSecret, async (req, res, next) => {
  try {
    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    const telegramId = typeof req.body?.telegramId === 'string' ? req.body.telegramId : String(req.body?.telegramId ?? '');
    if (!/^\d{6}$/.test(code) || !/^\d{1,20}$/.test(telegramId) || req.body?.chatType !== 'private') {
      return res.status(400).json({ error: 'Некорректный запрос подтверждения' });
    }
    if (!allowTelegramAttempt(telegramId)) {
      return res.status(429).json({ error: 'Слишком много попыток. Попробуйте позже.' });
    }

    const codeDigest = digestChallengeCode(code);
    const result = await prisma.$transaction(async (tx) => {
      const lookupTime = new Date();
      const challenge = await tx.telegramChallenge.findUnique({
        where: { codeDigest },
        select: { id: true, expiresAt: true, status: true },
      });
      if (!challenge || challenge.status !== 'pending' || challenge.expiresAt <= lookupTime) return false;
      const user = await tx.telegramUser.upsert({
        where: { telegramId },
        create: { telegramId },
        update: {},
      });
      const confirmedAt = new Date();
      const updated = await tx.telegramChallenge.updateMany({
        where: { id: challenge.id, status: 'pending', expiresAt: { gt: confirmedAt } },
        data: { status: 'confirmed', telegramUserId: user.id, confirmedAt },
      });
      return updated.count === 1;
    });

    if (!result) return res.status(404).json({ error: 'Код недействителен или истёк.' });
    return res.json({ confirmed: true });
  } catch (error) {
    return next(error);
  }
});

export default router;
