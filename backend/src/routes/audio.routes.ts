import { Router, Request, Response } from 'express';
import { requireAdmin } from '../middleware/auth.middleware';
import rateLimit from 'express-rate-limit';
import { audioCacheStats, clearAudioCache, generateAudioPreview, getAudioRegenerationJob, getOrCreateAudio, MAX_AUDIO_TEXT_LENGTH, startAudioRegeneration } from '../services/audio';
import { sanitizeAudioSettings } from '../services/audioSettings';

const router = Router();
const audioLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Слишком много запросов озвучки. Подождите минуту.' },
});

// The public endpoint is cheap for a real learner (a word or short phrase) but an
// unlimited length lets anyone synthesize arbitrary 10k-char strings and bloat the
// SQLite cache. Keep the public ceiling short; the admin preview keeps its own,
// larger limit (MAX_AUDIO_TEXT_LENGTH).
const MAX_PUBLIC_AUDIO_TEXT_LENGTH = 200;

router.get('/admin/stats', requireAdmin, async (_req, res) => {
  try { res.json(await audioCacheStats()); } catch { res.status(500).json({ error: 'Не удалось прочитать кэш озвучки' }); }
});

router.delete('/admin/cache', requireAdmin, async (_req, res) => {
  try { res.json({ count: await clearAudioCache() }); } catch { res.status(500).json({ error: 'Не удалось очистить кэш озвучки' }); }
});

router.get('/admin/regenerate-words', requireAdmin, async (_req, res) => {
  try { res.json({ job: await getAudioRegenerationJob() }); } catch { res.status(500).json({ error: 'Не удалось прочитать состояние генерации' }); }
});

router.post('/admin/regenerate-words', requireAdmin, async (_req, res) => {
  try { res.status(202).json(await startAudioRegeneration()); } catch { res.status(502).json({ error: 'Не удалось запустить генерацию озвучки слов' }); }
});

router.post('/admin/preview', requireAdmin, async (req: Request, res: Response) => {
  const text = typeof req.body?.text === 'string' ? req.body.text : '';
  const settings = sanitizeAudioSettings(req.body?.settings);
  if (!text.trim() || text.length > MAX_AUDIO_TEXT_LENGTH || !settings) {
    return res.status(400).json({ error: 'Некорректный текст или параметры озвучки' });
  }
  try {
    res.set({ 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' }).send(await generateAudioPreview(text, settings));
  } catch (error) {
    console.error('[audio] preview failed:', error);
    res.status(502).json({ error: 'Не удалось прослушать тестовую озвучку' });
  }
});

// Keep this catch-all route after the admin routes: Express treats `/` as a
// prefix inside a router, so putting it first would intercept `/admin/stats`.
router.get('/', audioLimiter, async (req: Request, res: Response) => {
  const text = typeof req.query.text === 'string' ? req.query.text : '';
  const kind = req.query.kind === 'sentence' ? 'sentence' : 'word';
  if (!text.trim() || text.length > MAX_PUBLIC_AUDIO_TEXT_LENGTH) {
    return res.status(400).json({ error: 'Текст для озвучки должен быть не длиннее 200 символов' });
  }
  try {
    const audio = await getOrCreateAudio(text, kind);
    // The audio is cached server-side. Do not let browsers keep an immutable
    // copy after an administrator clears or regenerates the server cache.
    res.set({ 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' }).send(audio);
  } catch (error) {
    console.error('[audio] generation failed:', error);
    res.status(502).json({ error: 'Не удалось сгенерировать озвучку' });
  }
});

export default router;
