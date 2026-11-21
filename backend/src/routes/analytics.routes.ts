import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { requireAdmin } from '../middleware/auth.middleware';
import { findCurrentUser } from '../services/telegramAuth';
import { describeUserAgent } from '../services/userAgent';
import rateLimit from 'express-rate-limit';

const router = Router();
const analyticsLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ error: 'Слишком много событий. Попробуйте позже.' }),
});
const EVENT_TYPES = new Set(['visit', 'tab_switch', 'quiz_answer']);
const TRAINER_TYPES = new Set(['numbers', 'words', 'articles', 'verbs', 'time', 'pictures', 'admin']);

/**
 * "A day" in the statistics is a calendar day in ONE fixed time zone
 * (STATS_TIMEZONE, default: the server's own). Every number — the "today" counter, the daily /
 * weekly charts, the hour-of-day and weekday breakdowns, the heatmap — is bucketed with the same
 * function, so they can't disagree.
 */
const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface Zoned {
  /** Calendar day, YYYY-MM-DD. */
  day: string;
  /** 0…23 */
  hour: number;
  /** 0 = Monday … 6 = Sunday */
  weekday: number;
}

function createZoner(): { timeZone: string; at: (date: Date) => Zoned } {
  const candidates = [process.env.STATS_TIMEZONE, Intl.DateTimeFormat().resolvedOptions().timeZone, 'UTC'];
  let timeZone = 'UTC';
  let formatter: Intl.DateTimeFormat | null = null;
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: candidate,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hourCycle: 'h23',
        weekday: 'short',
      });
      timeZone = candidate;
      break;
    } catch {
      // invalid time zone name: try the next candidate
    }
  }
  const fmt = formatter as Intl.DateTimeFormat; // 'UTC' is always valid, so the loop always sets it

  return {
    timeZone,
    at: (date) => {
      const parts: Record<string, string> = {};
      for (const part of fmt.formatToParts(date)) parts[part.type] = part.value;
      return {
        day: `${parts.year}-${parts.month}-${parts.day}`,
        hour: Number(parts.hour) % 24,
        weekday: Math.max(0, WEEKDAY_NAMES.indexOf(parts.weekday)),
      };
    },
  };
}

const zoner = createZoner();

const shiftDay = (key: string, delta: number): string => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
};

/** The last `count` calendar days ending with `todayKey` (pure date arithmetic, immune to DST). */
const lastDays = (todayKey: string, count: number): string[] =>
  Array.from({ length: count }, (_, i) => shiftDay(todayKey, i - (count - 1)));

/** Monday of the week the given day belongs to. */
function weekStart(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return shiftDay(key, -weekday);
}

router.post('/event', analyticsLimiter, async (req: Request, res: Response) => {
  try {
    const learner = await findCurrentUser(req);
    if (!learner) return res.status(401).json({ error: 'Требуется войти через Telegram.' });
    const { eventType, trainerType, isCorrect } = req.body ?? {};
    if (typeof eventType !== 'string' || !EVENT_TYPES.has(eventType)) return res.status(400).json({ error: 'Неизвестный тип события' });
    if (trainerType !== undefined && trainerType !== null && (typeof trainerType !== 'string' || !TRAINER_TYPES.has(trainerType))) {
      return res.status(400).json({ error: 'Неизвестный тренажёр' });
    }
    if (isCorrect !== undefined && typeof isCorrect !== 'boolean') return res.status(400).json({ error: 'Некорректный результат ответа' });
    await prisma.analyticsEvent.create({
      data: {
        eventType,
        trainerType: trainerType || null,
        isCorrect: isCorrect !== undefined ? Boolean(isCorrect) : null,
        learnerId: learner.id,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
      },
    });
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({ error: 'Не удалось записать событие' });
  }
});

// ---- Statistics for the admin panel ------------------------------------------

const ALLOWED_RANGES = [7, 30, 90, 365];
const DEFAULT_RANGE = 30;
const MAX_EVENTS = 200_000;
const DAY_MS = 24 * 60 * 60 * 1000;

const parseDays = (value: unknown): number => {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return ALLOWED_RANGES.includes(n) ? n : DEFAULT_RANGE;
};

interface Bucket {
  visits: number;
  answers: number;
  learners: Set<string>;
}
const newBucket = (): Bucket => ({ visits: 0, answers: 0, learners: new Set() });
const toStat = (b: Bucket) => ({ visits: b.visits, activeLearners: b.learners.size, answers: b.answers });

const bump = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);
const toNamed = (map: Map<string, number>) =>
  [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

/**
 * Query: `?days=7|30|90|365` (default 30). Only events linked to a Telegram learner are counted.
 * `visit` is fired after authentication, `tab_switch` on every tab change, and
 * `quiz_answer` on every checked answer.
 *  - daily / hourly / weekdays / heatmap / trainers / tabs / devices / browsers cover the chosen range;
 *  - weekly covers whole weeks (Monday start) and can reach a little further back than the range.
 */
router.get('/stats', requireAdmin, async (req: Request, res: Response) => {
  try {
    const days = parseDays(req.query.days);
    const weeksCount = Math.min(53, Math.max(8, Math.ceil(days / 7)));
    const windowDays = Math.max(days, weeksCount * 7 + 6);

    const todayKey = zoner.at(new Date()).day;
    const since = new Date(Date.now() - (windowDays + 1) * DAY_MS);

    const [events, learnerCount, registrations] = await Promise.all([
      prisma.analyticsEvent.findMany({
        where: {
          eventType: { in: ['visit', 'quiz_answer', 'tab_switch'] },
          learnerId: { not: null },
          timestamp: { gte: since },
        },
        select: { eventType: true, trainerType: true, isCorrect: true, learnerId: true, userAgent: true, timestamp: true },
        orderBy: { timestamp: 'desc' },
        take: MAX_EVENTS,
      }),
      prisma.telegramUser.count(),
      prisma.telegramUser.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      }),
    ]);

    const daily = new Map(lastDays(todayKey, days).map((key) => [key, newBucket()]));
    const thisWeek = weekStart(todayKey);
    const weekly = new Map(
      Array.from({ length: weeksCount }, (_, i) => shiftDay(thisWeek, -7 * (weeksCount - 1 - i))).map((key) => [key, newBucket()])
    );
    const hourly = Array.from({ length: 24 }, newBucket);
    const weekdays = Array.from({ length: 7 }, newBucket);
    const heatmap = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));

    const rangeLearners = new Set<string>();
    const learnerDays = new Map<string, Set<string>>();
    const trainers = new Map<string, { answers: number; correct: number }>();
    const tabs = new Map<string, number>();
    const devices = new Map<string, number>();
    const browsers = new Map<string, number>();
    let answers = 0;
    let correct = 0;
    let newLearners = 0;

    for (const registration of registrations) {
      if (daily.has(zoner.at(registration.createdAt).day)) newLearners += 1;
    }

    for (const e of events) {
      const z = zoner.at(e.timestamp);
      const dayBucket = daily.get(z.day); // defined only for days inside the chosen range
      const weekBucket = weekly.get(weekStart(z.day));
      const learner = e.learnerId ? `learner:${e.learnerId}` : null;

      if (learner) {
        rangeLearners.add(learner);
        if (weekBucket) weekBucket.learners.add(learner);
        if (dayBucket) dayBucket.learners.add(learner);
        const seenDays = learnerDays.get(learner) ?? new Set<string>();
        seenDays.add(z.day);
        learnerDays.set(learner, seenDays);
      }

      if (e.eventType === 'visit') {
        if (weekBucket) {
          weekBucket.visits += 1;
        }
        if (!dayBucket) continue;

        dayBucket.visits += 1;
        if (learner) {
          hourly[z.hour].learners.add(learner);
          weekdays[z.weekday].learners.add(learner);
        }
        hourly[z.hour].visits += 1;
        weekdays[z.weekday].visits += 1;
        heatmap[z.weekday][z.hour] += 1;

        const info = describeUserAgent(e.userAgent);
        bump(devices, info.device);
        bump(browsers, info.browser);
      } else if (e.eventType === 'quiz_answer') {
        if (weekBucket) weekBucket.answers += 1;
        if (!dayBucket) continue;

        dayBucket.answers += 1;
        if (learner) {
          hourly[z.hour].learners.add(learner);
          weekdays[z.weekday].learners.add(learner);
        }
        hourly[z.hour].answers += 1;
        weekdays[z.weekday].answers += 1;
        answers += 1;
        const isRight = e.isCorrect === true;
        if (isRight) correct += 1;

        const name = e.trainerType || 'other';
        const entry = trainers.get(name) ?? { answers: 0, correct: 0 };
        entry.answers += 1;
        if (isRight) entry.correct += 1;
        trainers.set(name, entry);
      } else if (e.eventType === 'tab_switch' && dayBucket) {
        if (learner) {
          hourly[z.hour].learners.add(learner);
          weekdays[z.weekday].learners.add(learner);
        }
        bump(tabs, e.trainerType || 'other');
      }
    }

    const dailyStats = [...daily.entries()].map(([date, b]) => ({ date, ...toStat(b) }));
    const visits = dailyStats.reduce((sum, d) => sum + d.visits, 0);
    const activeLearners = rangeLearners.size;
    const selectedDays = new Set(daily.keys());
    const returningLearners = [...learnerDays.values()].filter((set) => [...set].filter((day) => selectedDays.has(day)).length >= 2).length;
    const today = daily.get(todayKey);

    res.json({
      days,
      timeZone: zoner.timeZone,
      generatedAt: new Date().toISOString(),
      truncated: events.length >= MAX_EVENTS,
      totals: {
        registeredLearners: learnerCount,
        visits,
        activeLearners,
        visitsToday: today?.visits ?? 0,
        activeToday: today?.learners.size ?? 0,
        newLearners,
        answers,
        correct,
        accuracy: answers > 0 ? Math.round((correct / answers) * 100) : null,
        activeDays: dailyStats.filter((d) => d.visits > 0).length,
        avgVisitsPerDay: Math.round((visits / days) * 10) / 10,
        returningLearners,
        returningRate: activeLearners > 0 ? Math.round((returningLearners / activeLearners) * 100) : 0,
      },
      daily: dailyStats,
      weekly: [...weekly.entries()].map(([weekStartKey, b]) => ({ weekStart: weekStartKey, ...toStat(b) })),
      hourly: hourly.map((b, hour) => ({ hour, ...toStat(b) })),
      weekdays: weekdays.map((b, weekday) => ({ weekday, ...toStat(b) })),
      heatmap,
      trainers: [...trainers.entries()]
        .map(([trainer, t]) => ({
          trainer,
          answers: t.answers,
          correct: t.correct,
          accuracy: t.answers > 0 ? Math.round((t.correct / t.answers) * 100) : null,
        }))
        .sort((a, b) => b.answers - a.answers),
      tabs: toNamed(tabs),
      devices: toNamed(devices),
      browsers: toNamed(browsers),
    });
  } catch (error) {
    console.error('[analytics] stats failed:', error);
    res.status(500).json({ error: 'Не удалось загрузить статистику' });
  }
});

export default router;
