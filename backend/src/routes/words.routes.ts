import { Router, Request, Response } from 'express';
import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { requireAdmin } from '../middleware/auth.middleware';
import { isPrismaError } from '../middleware/errorHandler';
import { validate } from '../middleware/validate';
import { createWordSchema, updateWordSchema } from '../validation';
import { isPartOfSpeech, readPartOfSpeech } from '../services/partOfSpeech';
import type { PartOfSpeech } from '../services/partOfSpeech';
import {
  TEXT_FIELDS,
  duplicateKey,
} from '../services/wordImport';
import { WORD_INCLUDE, allCategoriesExist, normalizeCategoryName, readCategoryIds, serializeWord } from '../services/wordCategories';
import { importWords } from '../services/wordImportService';

const router = Router();

// SQLite's LIKE (which Prisma's `contains` compiles to) is case-insensitive only
// for ASCII, and neither Prisma's `mode: 'insensitive'` nor SQLite's lower()
// covers Cyrillic or umlauts (Ä/ä, Ö/ö, Ü/ü). So text search is done in JS with
// a Unicode-aware lowercase; the word list is small enough for that.
const normalizeForSearch = (value: string | null | undefined): string => (value ?? '').normalize('NFC').toLowerCase();

const readPageNumber = (value: unknown, fallback: number, max: number): number => {
  const parsed = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : fallback;
  return Number.isSafeInteger(parsed) ? Math.min(Math.max(parsed, 1), max) : fallback;
};

router.get('/', async (req: Request, res: Response) => {
  try {
    const { categoryId, search, limit = '200', page = '1' } = req.query;
    // A word matches a category when it is its primary one OR one of its additional ones.
    const where: Prisma.WordWhereInput = {};
    if (categoryId && categoryId !== 'all') {
      const id = String(categoryId);
      where.OR = [{ categoryId: id }, { extraCategories: { some: { id } } }];
    }

    const take = readPageNumber(limit, 200, 1000);
    const pageNumber = readPageNumber(page, 1, 100_000);
    const skip = (pageNumber - 1) * take;
    const query = search ? normalizeForSearch(String(search).trim()) : '';

    let words;
    let total: number;

    if (!query) {
      [words, total] = await Promise.all([
        prisma.word.findMany({ where, include: WORD_INCLUDE, take, skip, orderBy: [{ de: 'asc' }, { id: 'asc' }] }),
        prisma.word.count({ where }),
      ]);
    } else {
      const candidates = await prisma.word.findMany({ where, include: WORD_INCLUDE, orderBy: [{ de: 'asc' }, { id: 'asc' }] });
      const matched = candidates.filter((w) =>
        [w.de, w.ru, w.hint].some((field) => normalizeForSearch(field).includes(query))
      );
      total = matched.length;
      words = matched.slice(skip, skip + take);
    }

    const payload = { words: words.map(serializeWord), total, page: pageNumber, limit: take };
    const etag = `"${createHash('sha256').update(JSON.stringify(payload)).digest('base64url')}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'no-cache');
    if (req.fresh) return res.status(304).end();
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: 'Не удалось загрузить слова' });
  }
});

router.post('/', requireAdmin, validate(createWordSchema), async (req: Request, res: Response) => {
  try {
    const body = req.body as import('../validation').CreateWordBody;
    const categoryIds = readCategoryIds(body);
    if (!body.de || !body.ru || !categoryIds) {
      return res.status(400).json({ error: 'Нужно заполнить немецкое слово, перевод и категорию' });
    }
    if (await prisma.word.findFirst({ where: { normalizedDe: duplicateKey(body.de) } })) {
      return res.status(409).json({ error: 'Слово с такой немецкой формой уже существует' });
    }
    if (!(await allCategoriesExist(categoryIds))) return res.status(400).json({ error: 'Категория не найдена' });

    const [primaryId, ...extraIds] = categoryIds;
    const primaryCategory = await prisma.category.findUnique({ where: { id: primaryId }, select: { name: true } });

    const pos = readPartOfSpeech({ ...body, categoryName: primaryCategory?.name }, { keepIfMissing: false });
    if (!pos.ok) return res.status(400).json({ error: pos.error });

    const word = await prisma.word.create({
      data: {
        de: body.de.trim(),
        normalizedDe: duplicateKey(body.de),
        ru: body.ru,
        hint: body.hint || null,
        partOfSpeech: pos.value,
        plural: body.plural || null,
        feminine: body.feminine || null,
        praeteritum: body.praeteritum || null,
        partizip2: body.partizip2 || null,
        hilfsverb: body.hilfsverb || null,
        praesensIch: body.praesensIch || null,
        praesensDu: body.praesensDu || null,
        praesensErSieEs: body.praesensErSieEs || null,
        praesensWir: body.praesensWir || null,
        praesensIhr: body.praesensIhr || null,
        praesensSie: body.praesensSie || null,
        requiredCase: body.requiredCase || null,
        category: { connect: { id: primaryId } },
        extraCategories: { connect: extraIds.map((id) => ({ id })) },
      },
      include: WORD_INCLUDE,
    });
    res.status(201).json(serializeWord(word));
  } catch (error) {
    if (isPrismaError(error, 'P2002')) return res.status(409).json({ error: 'Слово с такой немецкой формой уже существует' });
    console.error('[words] create failed:', error);
    res.status(500).json({ error: 'Не удалось создать слово' });
  }
});

router.put('/:id', requireAdmin, validate(updateWordSchema), async (req: Request, res: Response) => {
  try {
    const body = req.body as import('../validation').UpdateWordBody;

    const pos = readPartOfSpeech(body, { keepIfMissing: true });
    if (!pos.ok) return res.status(400).json({ error: pos.error });

    // No categories in the body = leave the word's categories as they are.
    const categoryIds = readCategoryIds(body);
    if (categoryIds && !(await allCategoriesExist(categoryIds))) return res.status(400).json({ error: 'Категория не найдена' });
    if (typeof body.de === 'string') {
      const duplicate = await prisma.word.findFirst({ where: { normalizedDe: duplicateKey(body.de), NOT: { id: req.params.id } } });
      if (duplicate) return res.status(409).json({ error: 'Слово с такой немецкой формой уже существует' });
    }

    // For "partOfSpeech: null (auto)" the guess needs the word's category name.
    let inferredPos = pos.value;
    if (pos.value === null) {
      const existing = await prisma.word.findUnique({ where: { id: req.params.id }, select: { category: { select: { name: true } }, de: true, praeteritum: true, partizip2: true } });
      if (!existing) return res.status(404).json({ error: 'Слово не найдено' });
      const inferred = readPartOfSpeech({ ...body, categoryName: existing.category.name }, { keepIfMissing: false });
      if (!inferred.ok) return res.status(400).json({ error: inferred.error });
      inferredPos = inferred.value;
    }

    const word = await prisma.word.update({
      where: { id: req.params.id },
      data: {
        ...(typeof body.de === 'string' && { de: body.de.trim(), normalizedDe: duplicateKey(body.de) }),
        ...(body.ru !== undefined && { ru: body.ru }),
        ...(body.hint !== undefined && { hint: body.hint || null }),
        ...(inferredPos !== undefined && { partOfSpeech: inferredPos }),
        ...(body.plural !== undefined && { plural: body.plural || null }),
        ...(body.feminine !== undefined && { feminine: body.feminine || null }),
        ...(body.praeteritum !== undefined && { praeteritum: body.praeteritum || null }),
        ...(body.partizip2 !== undefined && { partizip2: body.partizip2 || null }),
        ...(body.hilfsverb !== undefined && { hilfsverb: body.hilfsverb || null }),
        ...(body.praesensIch !== undefined && { praesensIch: body.praesensIch || null }),
        ...(body.praesensDu !== undefined && { praesensDu: body.praesensDu || null }),
        ...(body.praesensErSieEs !== undefined && { praesensErSieEs: body.praesensErSieEs || null }),
        ...(body.praesensWir !== undefined && { praesensWir: body.praesensWir || null }),
        ...(body.praesensIhr !== undefined && { praesensIhr: body.praesensIhr || null }),
        ...(body.praesensSie !== undefined && { praesensSie: body.praesensSie || null }),
        ...(body.requiredCase !== undefined && { requiredCase: body.requiredCase || null }),
        ...(categoryIds && {
          category: { connect: { id: categoryIds[0] } },
          extraCategories: { set: categoryIds.slice(1).map((id) => ({ id })) },
        }),
      },
      include: WORD_INCLUDE,
    });
    res.json(serializeWord(word));
  } catch (error) {
    if (isPrismaError(error, 'P2025')) return res.status(404).json({ error: 'Слово не найдено' });
    if (isPrismaError(error, 'P2002')) return res.status(409).json({ error: 'Слово с такой немецкой формой уже существует' });
    console.error('[words] update failed:', error);
    res.status(500).json({ error: 'Не удалось обновить слово' });
  }
});

router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.word.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Word deleted' });
  } catch (error) {
    if (isPrismaError(error, 'P2025')) return res.status(404).json({ error: 'Слово не найдено' });
    res.status(500).json({ error: 'Не удалось удалить слово' });
  }
});

// ---- Bulk import / export ---------------------------------------------------

/**
 * Bulk import. `data` is JSON (as produced by an AI assistant, see the prompt in
 * the admin panel) or plain text lines. With `dryRun` nothing is written — the
 * response only says what would happen, so the admin can check before importing.
 *
 * A row may name several categories (array in "category"): it is still ONE word.
 * Rows with problems are reported and skipped; the valid rows are still imported.
 */
router.post('/import', requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await importWords(req.body ?? {});
    res.json(result);
  } catch (error) {
    if (error instanceof Error && error.name === 'ImportFormatError') return res.status(400).json({ error: error.message });
    console.error('[import] failed:', error);
    res.status(500).json({ error: 'Import failed' });
  }
});

/** Export in the very same format the import reads, so a backup can be restored (or edited by an AI) as is. */
router.get('/export', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const [categories, words] = await Promise.all([
      prisma.category.findMany({ orderBy: { name: 'asc' } }),
      prisma.word.findMany({ include: WORD_INCLUDE, orderBy: [{ category: { name: 'asc' } }, { de: 'asc' }] }),
    ]);

    res.json({
      version: 1,
      exportedAt: new Date().toISOString(),
      categories: categories.map((c) => ({ name: c.name, icon: c.icon, color: c.color })),
      words: words.map((w) => {
        const names = serializeWord(w).categories.map((c) => c.name);
        // One category stays a plain string (as in older exports); several become an array.
        const entry: Record<string, string | string[]> = { de: w.de, ru: w.ru, category: names.length === 1 ? names[0] : names };
        if (w.partOfSpeech) entry.partOfSpeech = w.partOfSpeech;
        for (const field of TEXT_FIELDS) {
          const value = w[field];
          if (value) entry[field] = value;
        }
        return entry;
      }),
    });
  } catch (error) {
    res.status(500).json({ error: 'Export failed' });
  }
});

export default router;
