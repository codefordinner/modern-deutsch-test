import { Router, Request, Response } from 'express';
import { requireAdmin } from '../middleware/auth.middleware';
import {
  MAX_BOX_WEIGHT,
  readSrsWeights,
  resetSrsWeights,
  sanitizeWeights,
  writeSrsWeights,
} from '../services/srsSettings';
import {
  isAudioVoice,
  readAudioSettings,
  readAudioVoice,
  resetAudioSettings,
  resetAudioVoice,
  sanitizeAudioSettings,
  writeAudioSettings,
  writeAudioVoice,
} from '../services/audioSettings';
import { checkAISettings, fetchGeminiModels, generateWordFill, isGeminiModel, readAISettings, resetAIProfile, writeAISettings } from '../services/aiSettings';
import { clearAIErrorLogs, readAIErrorLogs, recordAIError } from '../services/aiErrorLog';
import { readAIQueue, subscribeAIQueue } from '../services/aiQueue';
import rateLimit from 'express-rate-limit';

const router = Router();

const wordFillLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Слишком много запросов к ИИ. Подождите минуту.' },
});

router.get('/ai', requireAdmin, async (_req, res) => {
  try { res.setHeader('Cache-Control', 'no-store'); res.json(await readAISettings()); }
  catch { res.status(500).json({ error: 'Не удалось загрузить настройки ИИ' }); }
});

router.get('/ai/models', requireAdmin, async (_req, res) => {
  try { res.setHeader('Cache-Control', 'no-store'); res.json({ models: await fetchGeminiModels() }); }
  catch (error) {
    await recordAIError({ operation: 'models', error }).catch(() => undefined);
    if (error instanceof Error && error.message === 'MISSING_API_KEY') return res.status(400).json({ error: 'Сначала сохраните ключ Gemini' });
    if (error instanceof Error && error.message === 'INVALID_API_KEY') return res.status(400).json({ error: 'Ключ Gemini недействителен или не имеет доступа' });
    return res.status(502).json({ error: 'Не удалось получить список моделей Gemini' });
  }
});

router.put('/ai', requireAdmin, async (req, res) => {
  if (req.body?.model !== '' && !isGeminiModel(req.body?.model)) return res.status(400).json({ error: 'Выбрана неизвестная модель Gemini' });
  try { res.json(await writeAISettings({ profileId: req.body?.profileId, model: req.body.model, apiKey: req.body.apiKey, prompt: req.body.prompt, severity: req.body.severity, batchSize: req.body.batchSize })); }
  catch (error) {
    if (error instanceof Error && error.message === 'INVALID_API_KEY') return res.status(400).json({ error: 'Ключ Gemini должен содержать не менее 10 символов' });
    if (error instanceof Error && error.message === 'INVALID_PROMPT') return res.status(400).json({ error: 'Промпт не должен быть пустым и не может быть длиннее 10 000 символов' });
    if (error instanceof Error && error.message === 'INVALID_PROFILE') return res.status(400).json({ error: 'Неизвестный профиль ИИ' });
    res.status(500).json({ error: 'Не удалось сохранить настройки ИИ' });
  }
});

router.post('/ai/check', requireAdmin, async (_req, res) => {
  try { res.json(await checkAISettings()); }
  catch { res.status(500).json({ error: 'Не удалось проверить настройки ИИ' }); }
});

router.delete('/ai/profile/:profileId', requireAdmin, async (req, res) => {
  try { res.json(await resetAIProfile(req.params.profileId)); }
  catch (error) {
    if (error instanceof Error && error.message === 'INVALID_PROFILE') return res.status(400).json({ error: 'Неизвестный профиль ИИ' });
    res.status(500).json({ error: 'Не удалось сбросить промпт' });
  }
});

router.get('/ai/logs', requireAdmin, async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ logs: await readAIErrorLogs(Number(req.query.limit) || 100) });
  } catch {
    res.status(500).json({ error: 'Не удалось загрузить журнал ошибок ИИ' });
  }
});

router.get('/ai/queue', requireAdmin, (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  const send = (items = readAIQueue().items) => res.write(`data: ${JSON.stringify({ ...readAIQueue(), items })}\n\n`);
  send();
  const unsubscribe = subscribeAIQueue((items) => send(items));
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15_000);
  req.on('close', () => { clearInterval(heartbeat); unsubscribe(); });
});

router.delete('/ai/logs', requireAdmin, async (_req, res) => {
  try {
    await clearAIErrorLogs();
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Не удалось очистить журнал ошибок ИИ' });
  }
});

router.post('/ai/word-fill', requireAdmin, wordFillLimiter, async (req, res) => {
  try {
    const words = req.body?.words;
    const categories = Array.isArray(req.body?.categories) ? req.body.categories.filter((c: unknown): c is string => typeof c === 'string' && Boolean(c.trim())) : [];
    const defaultCategory = typeof req.body?.defaultCategory === 'string' ? req.body.defaultCategory.trim() : undefined;
    if (typeof words !== 'string') return res.status(400).json({ error: 'Введите список слов' });
    const result = await generateWordFill({ words, categories, defaultCategory });
    res.json(result);
  } catch (error) {
    await recordAIError({ operation: 'word-fill', profileId: 'wordFill', error }).catch(() => undefined);
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
    const result = error instanceof Error ? messages[error.message] : undefined;
    return res.status(result?.[0] ?? 500).json({ error: result?.[1] ?? 'Не удалось заполнить слова через ИИ' });
  }
});

// Audio settings are Piper configuration owned by the admin; the public audio
// endpoint applies them server-side, so learners never need to read them.
router.get('/audio-voice', requireAdmin, async (_req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await readAudioVoice());
  } catch {
    res.status(500).json({ error: 'Не удалось загрузить настройку голоса' });
  }
});

router.get('/audio-settings', requireAdmin, async (_req, res) => {
  try { res.setHeader('Cache-Control', 'no-store'); res.json(await readAudioSettings()); }
  catch { res.status(500).json({ error: 'Не удалось загрузить настройки озвучки' }); }
});

router.put('/audio-settings', requireAdmin, async (req, res) => {
  const settings = sanitizeAudioSettings(req.body?.settings);
  if (!settings) return res.status(400).json({ error: 'Некорректные параметры озвучки' });
  try { await writeAudioSettings(settings); res.json({ settings, isDefault: false }); }
  catch { res.status(500).json({ error: 'Не удалось сохранить настройки озвучки' }); }
});

router.delete('/audio-settings', requireAdmin, async (_req, res) => {
  try { await resetAudioSettings(); res.json(await readAudioSettings()); }
  catch { res.status(500).json({ error: 'Не удалось сбросить настройки озвучки' }); }
});

router.put('/audio-voice', requireAdmin, async (req, res) => {
  const voice = req.body?.voice;
  if (!isAudioVoice(voice)) return res.status(400).json({ error: 'Выбран неизвестный голос' });
  try {
    await writeAudioVoice(voice);
    res.json({ voice, isDefault: false });
  } catch {
    res.status(500).json({ error: 'Не удалось сохранить настройку голоса' });
  }
});

router.delete('/audio-voice', requireAdmin, async (_req, res) => {
  try {
    await resetAudioVoice();
    res.json(await readAudioVoice());
  } catch {
    res.status(500).json({ error: 'Не удалось сбросить настройку голоса' });
  }
});

/** Public: every learner's browser reads the box weights to pick the next card. */
router.get('/srs-weights', async (_req: Request, res: Response) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await readSrsWeights());
  } catch (error) {
    res.status(500).json({ error: 'Не удалось загрузить настройки SRS' });
  }
});

router.put('/srs-weights', requireAdmin, async (req: Request, res: Response) => {
  try {
    const weights = sanitizeWeights(req.body?.weights);
    if (!weights) {
      return res.status(400).json({
        error: `Нужно ровно 5 чисел от 0 до ${MAX_BOX_WEIGHT}, хотя бы одно больше нуля`,
      });
    }
    await writeSrsWeights(weights);
    res.json({ weights, isDefault: false });
  } catch (error) {
    res.status(500).json({ error: 'Не удалось сохранить настройки SRS' });
  }
});

/** Back to the built-in defaults. */
router.delete('/srs-weights', requireAdmin, async (_req: Request, res: Response) => {
  try {
    await resetSrsWeights();
    res.json(await readSrsWeights());
  } catch (error) {
    res.status(500).json({ error: 'Не удалось сбросить настройки SRS' });
  }
});

export default router;
