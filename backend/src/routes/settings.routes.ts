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
import { checkAISettings, fetchGeminiModels, isGeminiModel, readAISettings, resetAISettings, writeAISettings } from '../services/aiSettings';

const router = Router();

router.get('/ai', requireAdmin, async (_req, res) => {
  try { res.setHeader('Cache-Control', 'no-store'); res.json(await readAISettings()); }
  catch { res.status(500).json({ error: 'Не удалось загрузить настройки ИИ' }); }
});

router.get('/ai/models', requireAdmin, async (_req, res) => {
  try { res.setHeader('Cache-Control', 'no-store'); res.json({ models: await fetchGeminiModels() }); }
  catch (error) {
    if (error instanceof Error && error.message === 'MISSING_API_KEY') return res.status(400).json({ error: 'Сначала сохраните ключ Gemini' });
    if (error instanceof Error && error.message === 'INVALID_API_KEY') return res.status(400).json({ error: 'Ключ Gemini недействителен или не имеет доступа' });
    return res.status(502).json({ error: 'Не удалось получить список моделей Gemini' });
  }
});

router.put('/ai', requireAdmin, async (req, res) => {
  if (req.body?.model !== '' && !isGeminiModel(req.body?.model)) return res.status(400).json({ error: 'Выбрана неизвестная модель Gemini' });
  try { res.json(await writeAISettings({ profileId: req.body?.profileId, model: req.body.model, apiKey: req.body.apiKey, prompt: req.body.prompt })); }
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

router.delete('/ai', requireAdmin, async (_req, res) => {
  try { res.json(await resetAISettings()); }
  catch { res.status(500).json({ error: 'Не удалось сбросить настройки ИИ' }); }
});

router.get('/audio-voice', async (_req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await readAudioVoice());
  } catch {
    res.status(500).json({ error: 'Не удалось загрузить настройку голоса' });
  }
});

router.get('/audio-settings', async (_req, res) => {
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
