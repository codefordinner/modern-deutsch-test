import { Router, Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { requireAdmin } from '../middleware/auth.middleware';
import { isPrismaError } from '../middleware/errorHandler';
import { validate } from '../middleware/validate';
import { createWordSchema, updateWordSchema } from '../validation';
import { isPartOfSpeech, readPartOfSpeech } from '../services/partOfSpeech';
import type { PartOfSpeech } from '../services/partOfSpeech';
import {
  ImportFormatError,
  MAX_IMPORT_ROWS,
  TEXT_FIELDS,
  duplicateKey,
  extractRawImport,
  normalizeRows,
  resolvePartOfSpeech,
} from '../services/wordImport';
import type { ParsedRow, RowError } from '../services/wordImport';
import { WORD_INCLUDE, allCategoriesExist, readCategoryIds, serializeWord } from '../services/wordCategories';

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

    res.json({ words: words.map(serializeWord), total, page: pageNumber, limit: take });
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

const DEFAULT_CATEGORY_ICON = '📌';
const DEFAULT_CATEGORY_COLOR = '#2563eb';

interface PlannedWord {
  row: ParsedRow;
  categoryNames: string[];
}

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
    const { data, defaultCategoryId, partOfSpeech, skipDuplicates = true, dryRun = false } = req.body ?? {};

    if (typeof data !== 'string' || !data.trim()) return res.status(400).json({ error: 'Нет данных для импорта' });
    if (partOfSpeech && !isPartOfSpeech(partOfSpeech)) return res.status(400).json({ error: 'Недопустимая часть речи' });

    let raw;
    try {
      raw = extractRawImport(data);
    } catch (e) {
      if (e instanceof ImportFormatError) return res.status(400).json({ error: e.message });
      throw e;
    }
    if (raw.rows.length === 0) return res.status(400).json({ error: 'В данных не найдено ни одного слова' });
    if (raw.rows.length > MAX_IMPORT_ROWS) {
      return res.status(400).json({ error: `Слишком много слов за раз (максимум ${MAX_IMPORT_ROWS})` });
    }

    const { rows, errors } = normalizeRows(raw.rows);
    const rowErrors: RowError[] = [...errors];

    const categories = await prisma.category.findMany();
    const categoryByName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c]));

    let defaultCategoryName: string | null = null;
    if (defaultCategoryId) {
      const found = categories.find((c) => c.id === String(defaultCategoryId));
      if (!found) return res.status(400).json({ error: 'Категория по умолчанию не найдена' });
      defaultCategoryName = found.name;
    }

    const existing = await prisma.word.findMany({ select: { de: true } });
    const seen = new Set(existing.map((w) => duplicateKey(w.de)));

    const planned: PlannedWord[] = [];
    const duplicates: string[] = [];
    const newCategoryNames = new Map<string, string>(); // lower-case key → display name

    for (const row of rows) {
      const categoryNames = row.categories.length > 0 ? row.categories : defaultCategoryName ? [defaultCategoryName] : [];
      if (categoryNames.length === 0) {
        rowErrors.push({ row: row.index, de: row.de, message: 'Не указана категория (поле category или категория по умолчанию)' });
        continue;
      }

      const key = duplicateKey(row.de);
      if (skipDuplicates && seen.has(key)) {
        duplicates.push(row.de);
        continue;
      }
      seen.add(key);

      for (const name of categoryNames) {
        const categoryKey = name.trim().toLowerCase();
        if (!categoryByName.has(categoryKey) && !newCategoryNames.has(categoryKey)) {
          newCategoryNames.set(categoryKey, name.trim());
        }
      }
      planned.push({ row, categoryNames });
    }

    rowErrors.sort((a, b) => a.row - b.row);
    const summary = {
      success: true,
      dryRun: Boolean(dryRun),
      total: raw.rows.length,
      importedCount: planned.length,
      duplicates,
      errors: rowErrors,
      newCategories: [...newCategoryNames.values()],
    };

    if (dryRun || planned.length === 0) return res.json(summary);

    // Create the categories that don't exist yet (icon/colour from the "categories" list if given).
    const metaByName = new Map(raw.categories.map((c) => [c.name.trim().toLowerCase(), c]));
    for (const [key, name] of newCategoryNames) {
      const meta = metaByName.get(key);
      const created = await prisma.category.create({
        data: {
          name,
          normalizedName: name.trim().normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim(),
          icon: meta?.icon || DEFAULT_CATEGORY_ICON,
          color: meta?.color || DEFAULT_CATEGORY_COLOR,
          isBuiltin: false,
        },
      });
      categoryByName.set(key, created);
    }

    const fallbackPos: PartOfSpeech | null = partOfSpeech ?? null;
    const operations = planned.map(({ row, categoryNames }) => {
      const unique = new Map<string, (typeof categories)[number]>();
      for (const name of categoryNames) {
        const category = categoryByName.get(name.trim().toLowerCase());
        if (!category) throw new Error(`Category "${name}" is missing`);
        unique.set(category.id, category);
      }
      const [primary, ...extra] = [...unique.values()];
      return prisma.word.create({
        data: {
          de: row.de,
          ru: row.ru,
          partOfSpeech: resolvePartOfSpeech(row, [primary, ...extra].map((c) => c.name).join(' '), fallbackPos),
          ...row.fields,
          category: { connect: { id: primary.id } },
          extraCategories: { connect: extra.map((c) => ({ id: c.id })) },
        },
      });
    });
    // All words succeed or none does.
    await prisma.$transaction(operations);

    res.json(summary);
  } catch (error) {
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
