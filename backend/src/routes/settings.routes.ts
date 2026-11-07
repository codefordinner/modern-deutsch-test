import { Router, Request, Response } from 'express';
import { requireAdmin } from '../middleware/auth.middleware';
import {
  MAX_BOX_WEIGHT,
  readSrsWeights,
  resetSrsWeights,
  sanitizeWeights,
  writeSrsWeights,
} from '../services/srsSettings';
import { isAudioVoice, readAudioVoice, resetAudioVoice, writeAudioVoice } from '../services/audioSettings';

const router = Router();

router.get('/audio-voice', async (_req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await readAudioVoice());
  } catch {
    res.status(500).json({ error: 'Не удалось загрузить настройку голоса' });
  }
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
    res.status(500).json({ error: 'Failed to fetch SRS settings' });
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
    res.status(500).json({ error: 'Failed to save SRS settings' });
  }
});

/** Back to the built-in defaults. */
router.delete('/srs-weights', requireAdmin, async (_req: Request, res: Response) => {
  try {
    await resetSrsWeights();
    res.json(await readSrsWeights());
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset SRS settings' });
  }
});

export default router;
