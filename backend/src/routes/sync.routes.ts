import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../db';
import { hashSyncKey, mergeSyncData, readSyncKey, sanitizeSyncData, MIN_SYNC_KEY_LENGTH } from '../services/srsSync';

const router = Router();

// The key is the only "password" of a sync profile, so guessing is throttled per IP.
const syncLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({ error: 'Слишком много запросов синхронизации. Подождите минуту.' });
  },
});

/**
 * One round trip of the sync: the client sends its SRS snapshot, the server merges it with the
 * stored one (newer answer per card wins, a reset wipes older answers), saves the result and
 * returns it. Public on purpose — whoever knows the key owns the profile.
 */
router.post('/srs', syncLimiter, async (req: Request, res: Response) => {
  try {
    res.setHeader('Cache-Control', 'no-store');

    const key = readSyncKey(req.body?.key);
    if (!key) return res.status(400).json({ error: `Ключ синхронизации: от ${MIN_SYNC_KEY_LENGTH} до 200 символов` });

    const keyHash = hashSyncKey(key);
    const incoming = sanitizeSyncData(req.body);

    // Read/merge/write uses optimistic locking. Without the revision check, two
    // devices can both read the same snapshot and the second upsert can erase
    // cards that only the first device sent.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const stored = await prisma.syncProfile.findUnique({ where: { keyHash } });
      let previous = sanitizeSyncData(null);
      if (stored) {
        try {
          previous = sanitizeSyncData(JSON.parse(stored.data));
        } catch {
          // corrupted snapshot: start over from what the client sent
        }
      }

      const merged = mergeSyncData(previous, incoming);
      const data = JSON.stringify(merged);

      if (!stored) {
        try {
          await prisma.syncProfile.create({ data: { keyHash, data, revision: 0 } });
          res.json(merged);
          return;
        } catch (error) {
          // Another request created the profile between our read and create.
          // Retry and merge against that newer snapshot.
          if ((error as { code?: string }).code === 'P2002') continue;
          throw error;
        }
      }

      const updated = await prisma.syncProfile.updateMany({
        where: { keyHash, revision: stored.revision },
        data: { data, revision: { increment: 1 } },
      });
      if (updated.count === 1) {
        res.json(merged);
        return;
      }
      // A concurrent writer won. Read its snapshot and merge again.
    }

    res.status(409).json({ error: 'Синхронизация занята. Повторите попытку.' });
  } catch (error) {
    console.error('[sync] failed:', error);
    res.status(500).json({ error: 'Не удалось синхронизировать прогресс' });
  }
});

export default router;
