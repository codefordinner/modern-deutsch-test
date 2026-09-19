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

router.get('/stats', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const events = await prisma.analyticsEvent.findMany({
      where: { eventType: 'quiz_answer' },
      take: 2000,
      orderBy: { timestamp: 'desc' },
    });

    const totalAnswers = events.length;
    const correctAnswers = events.filter((e) => e.isCorrect === true).length;
    const overallAccuracy = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;

    const byTrainer: Record<string, { total: number; correct: number }> = {};
    for (const ev of events) {
      const t = ev.trainerType || 'other';
      if (!byTrainer[t]) byTrainer[t] = { total: 0, correct: 0 };
      byTrainer[t].total += 1;
      if (ev.isCorrect) byTrainer[t].correct += 1;
    }

    res.json({ totalAnswers, correctAnswers, overallAccuracy, byTrainer });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
