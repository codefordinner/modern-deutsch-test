import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { requireAdmin } from '../middleware/auth.middleware';
import rateLimit from 'express-rate-limit';
import { checkPictureAnswer, generatePictureMetadata, MAX_PICTURE_ANSWER_LENGTH } from '../services/aiSettings';

const router = Router();
const IMAGE_PATTERN = /^data:image\/(jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const MAX_DATA_URL_LENGTH = 5 * 1024 * 1024;
const activePictureDescriptions = new Set<string>();
const pictureCheckLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Слишком много проверок описания. Подождите минуту.' },
});

router.get('/', async (_req: Request, res: Response) => {
  try {
    res.json(await prisma.picture.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } }));
  } catch { res.status(500).json({ error: 'Не удалось загрузить картинки' }); }
});

router.get('/admin', requireAdmin, async (_req: Request, res: Response) => {
  try { res.json(await prisma.picture.findMany({ orderBy: { createdAt: 'desc' } })); }
  catch { res.status(500).json({ error: 'Не удалось загрузить картинки' }); }
});

router.post('/', requireAdmin, async (req: Request, res: Response) => {
  const { title, description, dataUrl, isActive } = req.body as { title?: unknown; description?: unknown; dataUrl?: unknown; isActive?: unknown };
  if (typeof dataUrl !== 'string' || dataUrl.length > MAX_DATA_URL_LENGTH || !IMAGE_PATTERN.test(dataUrl)) {
    return res.status(400).json({ error: 'Загрузите корректное изображение JPEG, PNG, WebP или GIF размером до 5 МБ' });
  }
  try {
    return res.status(201).json(await prisma.picture.create({
      data: { dataUrl, title: typeof title === 'string' && title.trim() ? title.trim().slice(0, 200) : null, description: typeof description === 'string' && description.trim() ? description.trim().slice(0, 5000) : null, isActive: isActive !== false },
    }));
  } catch { return res.status(500).json({ error: 'Не удалось сохранить картинку' }); }
});

router.put('/:id', requireAdmin, async (req: Request, res: Response) => {
  const { title, description, dataUrl, isActive } = req.body as { title?: unknown; description?: unknown; dataUrl?: unknown; isActive?: unknown };
  if (dataUrl !== undefined && (typeof dataUrl !== 'string' || dataUrl.length > MAX_DATA_URL_LENGTH || !IMAGE_PATTERN.test(dataUrl))) {
    return res.status(400).json({ error: 'Некорректное изображение' });
  }
  try {
    return res.json(await prisma.picture.update({ where: { id: req.params.id }, data: {
      ...(dataUrl !== undefined ? { dataUrl } : {}),
      ...(title !== undefined ? { title: typeof title === 'string' && title.trim() ? title.trim().slice(0, 200) : null } : {}),
      ...(description !== undefined ? { description: typeof description === 'string' && description.trim() ? description.trim().slice(0, 5000) : null } : {}),
      ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
    } }));
  } catch { return res.status(500).json({ error: 'Не удалось обновить картинку' }); }
});

router.post('/:id/ai-description', requireAdmin, async (req: Request, res: Response) => {
  if (activePictureDescriptions.has(req.params.id)) return res.status(409).json({ error: 'Эта картинка уже обрабатывается. Дождитесь завершения.' });
  activePictureDescriptions.add(req.params.id);
  try {
    const picture = await prisma.picture.findUnique({ where: { id: req.params.id } });
    if (!picture) return res.status(404).json({ error: 'Картинка не найдена' });
    const metadata = await generatePictureMetadata(picture.dataUrl);
    const updated = await prisma.picture.update({ where: { id: picture.id }, data: metadata });
    return res.json(updated);
  } catch (error) {
    const messages: Record<string, [number, string]> = {
      MISSING_API_KEY: [400, 'Сначала настройте API-ключ Gemini'],
      MISSING_MODEL: [400, 'Сначала выберите модель Gemini'],
      INVALID_API_KEY: [400, 'Ключ Gemini недействителен'],
      GEMINI_UNAVAILABLE: [502, 'Gemini не смог обработать изображение'],
      AI_TIMEOUT: [504, 'ИИ не ответил вовремя. Попробуйте ещё раз.'],
      INVALID_AI_RESPONSE: [502, 'Gemini вернул некорректный ответ'],
    };
    const result = error instanceof Error ? messages[error.message] : undefined;
    return res.status(result?.[0] ?? 500).json({ error: result?.[1] ?? 'Не удалось заполнить описание через ИИ' });
  } finally {
    activePictureDescriptions.delete(req.params.id);
  }
});

router.post('/:id/check-answer', pictureCheckLimiter, async (req: Request, res: Response) => {
  try {
    const picture = await prisma.picture.findFirst({ where: { id: req.params.id, isActive: true } });
    if (!picture) return res.status(404).json({ error: 'Картинка не найдена' });
    if (typeof req.body?.answer !== 'string') return res.status(400).json({ error: 'Введите описание перед отправкой' });
    if (req.body.answer.length > MAX_PICTURE_ANSWER_LENGTH) return res.status(400).json({ error: 'Описание не должно быть длиннее 10 000 символов' });
    const result = await checkPictureAnswer({ imageDataUrl: picture.dataUrl, reference: picture.description || '', answer: req.body?.answer, severity: req.body?.severity });
    return res.json(result);
  } catch (error) {
    const messages: Record<string, [number, string]> = { MISSING_API_KEY: [503, 'Проверка ИИ пока не настроена'], MISSING_MODEL: [503, 'Для проверки не выбрана модель Gemini'], EMPTY_ANSWER: [400, 'Введите описание перед отправкой'], ANSWER_TOO_LONG: [400, 'Описание не должно быть длиннее 10 000 символов'], INVALID_AI_RESPONSE: [502, 'ИИ вернул некорректный результат проверки'], GEMINI_UNAVAILABLE: [502, 'Gemini временно недоступен'] };
    const result = error instanceof Error ? messages[error.message] : undefined;
    return res.status(result?.[0] ?? 500).json({ error: result?.[1] ?? 'Не удалось проверить описание' });
  }
});

router.post('/prompt-test', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { pictureId, answer, severity } = req.body ?? {};
    const picture = await prisma.picture.findUnique({ where: { id: pictureId } });
    if (!picture) return res.status(404).json({ error: 'Картинка не найдена' });
    return res.json(await checkPictureAnswer({ imageDataUrl: picture.dataUrl, reference: picture.description || '', answer, severity }));
  } catch { return res.status(502).json({ error: 'Не удалось протестировать промпт' }); }
});

router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  try { await prisma.picture.delete({ where: { id: req.params.id } }); return res.json({ success: true }); }
  catch { return res.status(500).json({ error: 'Не удалось удалить картинку' }); }
});

export default router;
