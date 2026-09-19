import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { requireAdmin } from '../middleware/auth.middleware';

const router = Router();

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

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const visitsToday = visitEvents.filter((e) => e.timestamp >= startOfToday).length;

    // Build a fixed 7-day window (including days with zero visits) so the
    // chart on the frontend always has consistent buckets.
    const dayBuckets: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dayBuckets[key] = 0;
    }
    visitEvents.forEach((e) => {
      const key = e.timestamp.toISOString().slice(0, 10);
      if (key in dayBuckets) dayBuckets[key] += 1;
    });
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
