import { Router, Request, Response } from 'express';
import { requireAdmin } from '../middleware/auth.middleware';
import { audioCacheStats, clearAudioCache, getOrCreateAudio, MAX_AUDIO_TEXT_LENGTH, regenerateWordAudio } from '../services/audio';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const text = typeof req.query.text === 'string' ? req.query.text : '';
  const kind = req.query.kind === 'sentence' ? 'sentence' : 'word';
  if (!text.trim() || text.length > MAX_AUDIO_TEXT_LENGTH) return res.status(400).json({ error: 'Некорректный текст для озвучки' });
  try {
    const audio = await getOrCreateAudio(text, kind);
    res.set({ 'Content-Type': 'audio/wav', 'Cache-Control': 'public, max-age=31536000, immutable' }).send(audio);
  } catch (error) {
    console.error('[audio] generation failed:', error);
    res.status(502).json({ error: 'Не удалось сгенерировать озвучку' });
  }
});

router.get('/admin/stats', requireAdmin, async (_req, res) => {
  try { res.json(await audioCacheStats()); } catch { res.status(500).json({ error: 'Не удалось прочитать кэш озвучки' }); }
});

router.delete('/admin/cache', requireAdmin, async (_req, res) => {
  try { res.json({ count: await clearAudioCache() }); } catch { res.status(500).json({ error: 'Не удалось очистить кэш озвучки' }); }
});

router.post('/admin/regenerate-words', requireAdmin, async (_req, res) => {
  try { res.json(await regenerateWordAudio()); } catch { res.status(502).json({ error: 'Не удалось сгенерировать озвучку слов' }); }
});

export default router;
