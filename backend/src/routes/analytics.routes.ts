import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { requireAdmin } from '../middleware/auth.middleware';
import { resolveVisitorId } from '../services/visitor';
import { describeUserAgent } from '../services/userAgent';

const router = Router();

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

/**
 * Identity of a visitor for "unique visitors". Events recorded after the cookie was introduced
 * carry `visitorId`. Older rows have none; the best that can be done for them is IP + User-Agent
 * (still better than IP alone), and those can't be merged with the new ids.
 */
const visitorKey = (e: { visitorId: string | null; ipAddress: string | null; userAgent: string | null }): string =>
  e.visitorId ? `id:${e.visitorId}` : `legacy:${e.ipAddress ?? 'unknown'}|${e.userAgent ?? ''}`;

router.post('/event', async (req: Request, res: Response) => {
  try {
    const { eventType, trainerType, isCorrect } = req.body ?? {};
    const visitorId = resolveVisitorId(req, res);
    await prisma.analyticsEvent.create({
      data: {
        eventType: eventType || 'action',
        trainerType: trainerType || null,
        isCorrect: isCorrect !== undefined ? Boolean(isCorrect) : null,
        visitorId,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
      },
    });
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record event' });
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
  visitors: Set<string>;
}
const newBucket = (): Bucket => ({ visits: 0, answers: 0, visitors: new Set() });
const toStat = (b: Bucket) => ({ visits: b.visits, visitors: b.visitors.size, answers: b.answers });

const bump = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);
const toNamed = (map: Map<string, number>) =>
  [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

/**
 * Query: `?days=7|30|90|365` (default 30). `eventType: 'visit'` is fired once per app load
 * (see App.tsx), `tab_switch` on every tab change, `quiz_answer` on every checked answer.
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

    const [events, allTimeVisits] = await Promise.all([
      prisma.analyticsEvent.findMany({
        where: { eventType: { in: ['visit', 'quiz_answer', 'tab_switch'] }, timestamp: { gte: since } },
        select: { eventType: true, trainerType: true, isCorrect: true, visitorId: true, ipAddress: true, userAgent: true, timestamp: true },
        orderBy: { timestamp: 'desc' },
        take: MAX_EVENTS,
      }),
      prisma.analyticsEvent.count({ where: { eventType: 'visit' } }),
    ]);

    const daily = new Map(lastDays(todayKey, days).map((key) => [key, newBucket()]));
    const thisWeek = weekStart(todayKey);
    const weekly = new Map(
      Array.from({ length: weeksCount }, (_, i) => shiftDay(thisWeek, -7 * (weeksCount - 1 - i))).map((key) => [key, newBucket()])
    );
    const hourly = Array.from({ length: 24 }, newBucket);
    const weekdays = Array.from({ length: 7 }, newBucket);
    const heatmap = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));

    const rangeVisitors = new Set<string>();
    const visitorDays = new Map<string, Set<string>>();
    const trainers = new Map<string, { answers: number; correct: number }>();
    const tabs = new Map<string, number>();
    const devices = new Map<string, number>();
    const browsers = new Map<string, number>();
    let answers = 0;
    let correct = 0;

    for (const e of events) {
      const z = zoner.at(e.timestamp);
      const dayBucket = daily.get(z.day); // defined only for days inside the chosen range
      const weekBucket = weekly.get(weekStart(z.day));

      if (e.eventType === 'visit') {
        const who = visitorKey(e);
        if (weekBucket) {
          weekBucket.visits += 1;
          weekBucket.visitors.add(who);
        }
        if (!dayBucket) continue;

        dayBucket.visits += 1;
        dayBucket.visitors.add(who);
        hourly[z.hour].visits += 1;
        hourly[z.hour].visitors.add(who);
        weekdays[z.weekday].visits += 1;
        weekdays[z.weekday].visitors.add(who);
        heatmap[z.weekday][z.hour] += 1;
        rangeVisitors.add(who);

        const seenDays = visitorDays.get(who) ?? new Set<string>();
        seenDays.add(z.day);
        visitorDays.set(who, seenDays);

        const info = describeUserAgent(e.userAgent);
        bump(devices, info.device);
        bump(browsers, info.browser);
      } else if (e.eventType === 'quiz_answer') {
        if (weekBucket) weekBucket.answers += 1;
        if (!dayBucket) continue;

        dayBucket.answers += 1;
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
        bump(tabs, e.trainerType || 'other');
      }
    }

    const dailyStats = [...daily.entries()].map(([date, b]) => ({ date, ...toStat(b) }));
    const visits = dailyStats.reduce((sum, d) => sum + d.visits, 0);
    const uniqueVisitors = rangeVisitors.size;
    const returningVisitors = [...visitorDays.values()].filter((set) => set.size >= 2).length;
    const today = daily.get(todayKey);

    res.json({
      days,
      timeZone: zoner.timeZone,
      generatedAt: new Date().toISOString(),
      truncated: events.length >= MAX_EVENTS,
      totals: {
        allTimeVisits,
        visits,
        uniqueVisitors,
        visitsToday: today?.visits ?? 0,
        uniqueToday: today?.visitors.size ?? 0,
        answers,
        correct,
        accuracy: answers > 0 ? Math.round((correct / answers) * 100) : null,
        activeDays: dailyStats.filter((d) => d.visits > 0).length,
        avgVisitsPerDay: Math.round((visits / days) * 10) / 10,
        returningVisitors,
        returningRate: uniqueVisitors > 0 ? Math.round((returningVisitors / uniqueVisitors) * 100) : 0,
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
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
