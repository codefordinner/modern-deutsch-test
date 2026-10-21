import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { requireAdmin } from '../middleware/auth.middleware';

const router = Router();

/**
 * "A day" in the statistics is a calendar day in ONE fixed time zone
 * (STATS_TIMEZONE, default: the server's own). The "today" counter, the
 * 7-day chart and its labels all use the same function, so they can't disagree
 * (before, "today" used the server's local midnight but the chart used UTC dates).
 */
function createDayKeyFormatter(): (date: Date) => string {
  const candidates = [process.env.STATS_TIMEZONE, Intl.DateTimeFormat().resolvedOptions().timeZone, 'UTC'];
  for (const timeZone of candidates) {
    if (!timeZone) continue;
    try {
      // 'en-CA' formats as YYYY-MM-DD.
      const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
      return (date) => formatter.format(date);
    } catch {
      // invalid time zone name: try the next candidate
    }
  }
  return (date) => date.toISOString().slice(0, 10);
}

const dayKey = createDayKeyFormatter();

/** The last `count` calendar days ending with `todayKey` (pure date arithmetic, immune to DST). */
function lastDays(todayKey: string, count: number): string[] {
  const [y, m, d] = todayKey.split('-').map(Number);
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    keys.push(new Date(Date.UTC(y, m - 1, d - i)).toISOString().slice(0, 10));
  }
  return keys;
}

router.post('/event', async (req: Request, res: Response) => {
  try {
    const { eventType, trainerType, isCorrect } = req.body;
    await prisma.analyticsEvent.create({
      data: {
        eventType: eventType || 'action',
        trainerType: trainerType || null,
        isCorrect: isCorrect !== undefined ? Boolean(isCorrect) : null,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
      },
    });
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record event' });
  }
});

// Visitor statistics for the admin panel. `eventType: 'visit'` is fired once
// per app load from the frontend (see App.tsx), and `tab_switch` is fired
// whenever someone navigates between trainer tabs.
router.get('/stats', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const visitEvents = await prisma.analyticsEvent.findMany({
      where: { eventType: 'visit' },
      select: { ipAddress: true, timestamp: true },
      orderBy: { timestamp: 'desc' },
      take: 5000,
    });

    const totalVisits = visitEvents.length;
    const uniqueVisitors = new Set(visitEvents.map((e) => e.ipAddress || 'unknown')).size;

    const todayKey = dayKey(new Date());
    const dayBuckets: Record<string, number> = {};
    for (const key of lastDays(todayKey, 7)) dayBuckets[key] = 0; // zero-visit days stay in the chart
    let visitsToday = 0;
    for (const e of visitEvents) {
      const key = dayKey(e.timestamp);
      if (key === todayKey) visitsToday += 1;
      if (key in dayBuckets) dayBuckets[key] += 1;
    }
    const last7Days = Object.entries(dayBuckets).map(([date, count]) => ({ date, count }));

    const tabEvents = await prisma.analyticsEvent.findMany({
      where: { eventType: 'tab_switch' },
      select: { trainerType: true },
      take: 5000,
    });
    const tabCounts: Record<string, number> = {};
    tabEvents.forEach((e) => {
      const t = e.trainerType || 'other';
      tabCounts[t] = (tabCounts[t] || 0) + 1;
    });
    const topTabs = Object.entries(tabCounts)
      .map(([tab, count]) => ({ tab, count }))
      .sort((a, b) => b.count - a.count);

    res.json({ totalVisits, uniqueVisitors, visitsToday, last7Days, topTabs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
