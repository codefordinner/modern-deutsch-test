import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { isAdminRequest, requireAdmin } from '../middleware/auth.middleware';
import rateLimit from 'express-rate-limit';
import { checkPictureAnswer, formatPictureAnswer, generatePictureMetadata, MAX_PICTURE_ANSWER_LENGTH } from '../services/aiSettings';
import { registerAiUsage } from '../services/aiUsage';
import { recordAIError } from '../services/aiErrorLog';

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
const pictureFormatLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Слишком много обработок диктовки. Подождите минуту.' },
});

const META_SELECT = { id: true, title: true, description: true, isActive: true, createdAt: true, updatedAt: true } as const;
const serializePicture = (picture: { id: string; title: string | null; description: string | null; isActive: boolean; createdAt: Date; updatedAt: Date }, includeDescription: boolean) => ({
  id: picture.id, title: picture.title, ...(includeDescription ? { description: picture.description } : {}),
  isActive: picture.isActive, createdAt: picture.createdAt, updatedAt: picture.updatedAt,
  imageUrl: `/api/pictures/${picture.id}/image?v=${picture.updatedAt.getTime()}`,
});

router.get('/', async (_req: Request, res: Response) => {
  try {
    const pictures = await prisma.picture.findMany({ where: { isActive: true }, select: META_SELECT, orderBy: { createdAt: 'asc' } });
    res.setHeader('Cache-Control', 'no-cache');
    res.json(pictures.map((picture) => serializePicture(picture, false)));
  } catch { res.status(500).json({ error: 'Не удалось загрузить картинки' }); }
});

router.get('/admin', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const pictures = await prisma.picture.findMany({ select: META_SELECT, orderBy: { createdAt: 'desc' } });
    res.setHeader('Cache-Control', 'no-store');
    res.json(pictures.map((picture) => serializePicture(picture, true)));
  } catch { res.status(500).json({ error: 'Не удалось загрузить картинки' }); }
});

router.get('/:id/image', async (req: Request, res: Response) => {
  try {
    const picture = await prisma.picture.findUnique({ where: { id: req.params.id }, select: { dataUrl: true, isActive: true } });
    if (!picture || (!picture.isActive && !isAdminRequest(req))) return res.status(404).json({ error: 'Картинка не найдена' });
    const match = /^data:image\/(jpeg|jpg|png|webp|gif);base64,/.exec(picture.dataUrl.slice(0, 80));
    if (!match) return res.status(404).json({ error: 'Картинка не найдена' });
    return res.set({ 'Content-Type': `image/${match[1] === 'jpg' ? 'jpeg' : match[1]}`, 'Cache-Control': picture.isActive ? 'public, max-age=31536000, immutable' : 'private, no-cache', 'X-Content-Type-Options': 'nosniff' }).send(Buffer.from(picture.dataUrl.slice(match[0].length), 'base64'));
  } catch { return res.status(500).json({ error: 'Не удалось загрузить картинку' }); }
});

router.post('/', requireAdmin, async (req: Request, res: Response) => {
  const { title, description, dataUrl, isActive } = req.body as { title?: unknown; description?: unknown; dataUrl?: unknown; isActive?: unknown };
  if (typeof dataUrl !== 'string' || dataUrl.length > MAX_DATA_URL_LENGTH || !IMAGE_PATTERN.test(dataUrl)) {
    return res.status(400).json({ error: 'Загрузите корректное изображение JPEG, PNG, WebP или GIF размером до 5 МБ' });
  }
  try {
    const created = await prisma.picture.create({
      data: { dataUrl, title: typeof title === 'string' && title.trim() ? title.trim().slice(0, 200) : null, description: typeof description === 'string' && description.trim() ? description.trim().slice(0, 5000) : null, isActive: isActive !== false },
      select: META_SELECT,
    });
    return res.status(201).json(serializePicture(created, true));
  } catch { return res.status(500).json({ error: 'Не удалось сохранить картинку' }); }
});

router.put('/:id', requireAdmin, async (req: Request, res: Response) => {
  const { title, description, dataUrl, isActive } = req.body as { title?: unknown; description?: unknown; dataUrl?: unknown; isActive?: unknown };
  if (dataUrl !== undefined && (typeof dataUrl !== 'string' || dataUrl.length > MAX_DATA_URL_LENGTH || !IMAGE_PATTERN.test(dataUrl))) {
    return res.status(400).json({ error: 'Некорректное изображение' });
  }
  try {
    const updated = await prisma.picture.update({ where: { id: req.params.id }, data: {
      ...(dataUrl !== undefined ? { dataUrl } : {}),
      ...(title !== undefined ? { title: typeof title === 'string' && title.trim() ? title.trim().slice(0, 200) : null } : {}),
      ...(description !== undefined ? { description: typeof description === 'string' && description.trim() ? description.trim().slice(0, 5000) : null } : {}),
      ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
    }, select: META_SELECT });
    return res.json(serializePicture(updated, true));
  } catch { return res.status(500).json({ error: 'Не удалось обновить картинку' }); }
});

router.post('/:id/ai-description', requireAdmin, async (req: Request, res: Response) => {
  if (activePictureDescriptions.has(req.params.id)) return res.status(409).json({ error: 'Эта картинка уже обрабатывается. Дождитесь завершения.' });
  activePictureDescriptions.add(req.params.id);
  try {
    const picture = await prisma.picture.findUnique({ where: { id: req.params.id } });
    if (!picture) return res.status(404).json({ error: 'Картинка не найдена' });
    const metadata = await generatePictureMetadata(picture.dataUrl);
    const updated = await prisma.picture.update({ where: { id: picture.id }, data: metadata, select: META_SELECT });
    return res.json(serializePicture(updated, true));
  } catch (error) {
    await recordAIError({ operation: 'picture-description', profileId: 'pictureDescription', error }).catch(() => undefined);
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

router.post('/:id/format-answer', pictureFormatLimiter, async (req: Request, res: Response) => {
  try {
    const picture = await prisma.picture.findFirst({ where: { id: req.params.id, isActive: true }, select: { id: true } });
    if (!picture) return res.status(404).json({ error: 'Картинка не найдена' });
    if (typeof req.body?.answer !== 'string' || !req.body.answer.trim()) return res.status(400).json({ error: 'Введите описание перед обработкой' });
    if (req.body.answer.length > MAX_PICTURE_ANSWER_LENGTH) return res.status(400).json({ error: 'Описание не должно быть длиннее 10 000 символов' });
    const usage = await registerAiUsage();
    if (!usage.allowed) return res.status(429).json({ error: 'Дневной лимит проверок ИИ исчерпан. Попробуйте завтра.' });
    return res.json({ answer: await formatPictureAnswer(req.body.answer) });
  } catch (error) {
    await recordAIError({ operation: 'picture-format', profileId: 'pictureAnswerFormat', error }).catch(() => undefined);
    const messages: Record<string, [number, string]> = { MISSING_API_KEY: [503, 'Обработка диктовки пока не настроена'], MISSING_MODEL: [503, 'Для обработки диктовки не выбрана модель Gemini'], INVALID_API_KEY: [503, 'Ключ Gemini недействителен'], EMPTY_ANSWER: [400, 'Введите описание перед обработкой'], ANSWER_TOO_LONG: [400, 'Описание не должно быть длиннее 10 000 символов'], AI_TIMEOUT: [504, 'ИИ не ответил вовремя. Попробуйте ещё раз.'], INVALID_AI_RESPONSE: [502, 'Gemini вернул некорректный ответ'], GEMINI_UNAVAILABLE: [502, 'Gemini временно недоступен'] };
    const result = error instanceof Error ? messages[error.message] : undefined;
    return res.status(result?.[0] ?? 500).json({ error: result?.[1] ?? 'Не удалось обработать диктовку' });
  }
});

router.post('/:id/check-answer', pictureCheckLimiter, async (req: Request, res: Response) => {
  try {
    const picture = await prisma.picture.findFirst({ where: { id: req.params.id, isActive: true } });
    if (!picture) return res.status(404).json({ error: 'Картинка не найдена' });
    if (typeof req.body?.answer !== 'string' || !req.body.answer.trim()) return res.status(400).json({ error: 'Введите описание перед отправкой' });
    if (req.body.answer.length > MAX_PICTURE_ANSWER_LENGTH) return res.status(400).json({ error: 'Описание не должно быть длиннее 10 000 символов' });
    const severity = req.body?.severity;
    if (severity !== undefined && (typeof severity !== 'number' || !Number.isFinite(severity) || severity < 1 || severity > 5)) {
      return res.status(400).json({ error: 'Некорректная жёсткость проверки' });
    }
    // Spending guard: this endpoint bills Gemini, so cap total daily usage regardless of IP.
    const usage = await registerAiUsage();
    if (!usage.allowed) return res.status(429).json({ error: 'Дневной лимит проверок ИИ исчерпан. Попробуйте завтра.' });
    const result = await checkPictureAnswer({ imageDataUrl: picture.dataUrl, reference: picture.description || '', answer: req.body?.answer, severity });
    return res.json(result);
  } catch (error) {
    await recordAIError({ operation: 'picture-check', profileId: 'pictureAnswerCheck', error }).catch(() => undefined);
    const messages: Record<string, [number, string]> = { MISSING_API_KEY: [503, 'Проверка ИИ пока не настроена'], MISSING_MODEL: [503, 'Для проверки не выбрана модель Gemini'], EMPTY_ANSWER: [400, 'Введите описание перед отправкой'], ANSWER_TOO_LONG: [400, 'Описание не должно быть длиннее 10 000 символов'], AI_TIMEOUT: [504, 'ИИ не ответил вовремя. Попробуйте ещё раз.'], INVALID_AI_RESPONSE: [502, 'ИИ вернул некорректный результат проверки'], GEMINI_UNAVAILABLE: [502, 'Gemini временно недоступен'] };
    const result = error instanceof Error ? messages[error.message] : undefined;
    return res.status(result?.[0] ?? 500).json({ error: result?.[1] ?? 'Не удалось проверить описание' });
  }
});

router.post('/prompt-test', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { pictureId, answer, severity } = req.body ?? {};
    if (typeof pictureId !== 'string' || !pictureId.trim()) return res.status(400).json({ error: 'Выберите картинку для теста' });
    if (typeof answer !== 'string') return res.status(400).json({ error: 'Введите описание перед отправкой' });
    if (answer.length > MAX_PICTURE_ANSWER_LENGTH) return res.status(400).json({ error: 'Описание не должно быть длиннее 10 000 символов' });
    if (severity !== undefined && (typeof severity !== 'number' || !Number.isFinite(severity) || severity < 1 || severity > 5)) {
      return res.status(400).json({ error: 'Некорректная жёсткость проверки' });
    }
    const picture = await prisma.picture.findUnique({ where: { id: pictureId } });
    if (!picture) return res.status(404).json({ error: 'Картинка не найдена' });
    return res.json(await checkPictureAnswer({ imageDataUrl: picture.dataUrl, reference: picture.description || '', answer, severity }));
  } catch (error) {
    await recordAIError({ operation: 'prompt-test', profileId: 'pictureAnswerCheck', error }).catch(() => undefined);
    return res.status(502).json({ error: 'Не удалось протестировать промпт' }); }
});

router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  try { await prisma.picture.delete({ where: { id: req.params.id } }); return res.json({ success: true }); }
  catch { return res.status(500).json({ error: 'Не удалось удалить картинку' }); }
});

export default router;
