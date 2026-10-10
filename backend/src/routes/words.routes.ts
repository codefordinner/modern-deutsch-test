import { Router, Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { requireAdmin } from '../middleware/auth.middleware';
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

const router = Router();

// SQLite's LIKE (which Prisma's `contains` compiles to) is case-insensitive only
// for ASCII, and neither Prisma's `mode: 'insensitive'` nor SQLite's lower()
// covers Cyrillic or umlauts (Ä/ä, Ö/ö, Ü/ü). So text search is done in JS with
// a Unicode-aware lowercase; the word list is small enough for that.
const normalizeForSearch = (value: string | null | undefined): string => (value ?? '').normalize('NFC').toLowerCase();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { categoryId, search, limit = '200', page = '1' } = req.query;
    const where: { categoryId?: string } = {};
    if (categoryId && categoryId !== 'all') where.categoryId = String(categoryId);

    const take = Math.min(Number(limit) || 200, 1000);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;
    const query = search ? normalizeForSearch(String(search).trim()) : '';

    let words;
    let total: number;

    if (!query) {
      [words, total] = await Promise.all([
        prisma.word.findMany({ where, include: { category: true }, take, skip, orderBy: { de: 'asc' } }),
        prisma.word.count({ where }),
      ]);
    } else {
      const candidates = await prisma.word.findMany({ where, include: { category: true }, orderBy: { de: 'asc' } });
      const matched = candidates.filter((w) =>
        [w.de, w.ru, w.hint].some((field) => normalizeForSearch(field).includes(query))
      );
      total = matched.length;
      words = matched.slice(skip, skip + take);
    }

    res.json({ words, total, page: Number(page), limit: take });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch words' });
  }
});

router.post('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      de,
      ru,
      hint,
      plural,
      feminine,
      praeteritum,
      partizip2,
      hilfsverb,
      praesensIch,
      praesensDu,
      praesensErSieEs,
      praesensWir,
      praesensIhr,
      praesensSie,
      categoryId,
    } = req.body;
    if (!de || !ru || !categoryId) return res.status(400).json({ error: 'Missing required fields' });

    const pos = readPartOfSpeech(req.body, { keepIfMissing: false });
    if (!pos.ok) return res.status(400).json({ error: pos.error });

    const word = await prisma.word.create({
      data: {
        de,
        ru,
        hint,
        partOfSpeech: pos.value,
        plural,
        feminine,
        praeteritum,
        partizip2,
        hilfsverb,
        praesensIch,
        praesensDu,
        praesensErSieEs,
        praesensWir,
        praesensIhr,
        praesensSie,
        categoryId,
      },
      include: { category: true },
    });
    res.status(201).json(word);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create word' });
  }
});

router.put('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      de,
      ru,
      hint,
      plural,
      feminine,
      praeteritum,
      partizip2,
      hilfsverb,
      praesensIch,
      praesensDu,
      praesensErSieEs,
      praesensWir,
      praesensIhr,
      praesensSie,
      categoryId,
    } = req.body;

    const pos = readPartOfSpeech(req.body, { keepIfMissing: true });
    if (!pos.ok) return res.status(400).json({ error: pos.error });

    const word = await prisma.word.update({
      where: { id: req.params.id },
      data: {
        de,
        ru,
        hint,
        partOfSpeech: pos.value,
        plural,
        feminine,
        praeteritum,
        partizip2,
        hilfsverb,
        praesensIch,
        praesensDu,
        praesensErSieEs,
        praesensWir,
        praesensIhr,
        praesensSie,
        categoryId,
      },
      include: { category: true },
    });
    res.json(word);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update word' });
  }
});

router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.word.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Word deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete word' });
  }
});

// ---- Bulk import / export ---------------------------------------------------

const CREATE_CHUNK = 200;
const DEFAULT_CATEGORY_ICON = '📌';
const DEFAULT_CATEGORY_COLOR = '#2563eb';

interface PlannedWord {
  row: ParsedRow;
  categoryName: string;
}

/**
 * Bulk import. `data` is JSON (as produced by an AI assistant, see the prompt in
 * the admin panel) or plain text lines. With `dryRun` nothing is written — the
 * response only says what would happen, so the admin can check before importing.
 *
 * Rows with problems are reported and skipped; the valid rows are still imported.
 */
router.post('/import', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { data, defaultCategoryId, partOfSpeech, skipDuplicates = true, dryRun = false } = req.body ?? {};

    if (typeof data !== 'string' || !data.trim()) return res.status(400).json({ error: 'Нет данных для импорта' });
    if (partOfSpeech && !isPartOfSpeech(partOfSpeech)) return res.status(400).json({ error: 'Invalid partOfSpeech' });

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
      const categoryName = row.category ?? defaultCategoryName;
      if (!categoryName) {
        rowErrors.push({ row: row.index, de: row.de, message: 'Не указана категория (поле category или категория по умолчанию)' });
        continue;
      }

      const key = duplicateKey(row.de);
      if (skipDuplicates && seen.has(key)) {
        duplicates.push(row.de);
        continue;
      }
      seen.add(key);

      const categoryKey = categoryName.trim().toLowerCase();
      if (!categoryByName.has(categoryKey) && !newCategoryNames.has(categoryKey)) {
        newCategoryNames.set(categoryKey, categoryName.trim());
      }
      planned.push({ row, categoryName: categoryName.trim() });
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
          icon: meta?.icon || DEFAULT_CATEGORY_ICON,
          color: meta?.color || DEFAULT_CATEGORY_COLOR,
          isBuiltin: false,
        },
      });
      categoryByName.set(key, created);
    }

    const fallbackPos: PartOfSpeech | null = partOfSpeech ?? null;
    const records: Prisma.WordCreateManyInput[] = planned.map(({ row, categoryName }) => {
      const category = categoryByName.get(categoryName.toLowerCase());
      if (!category) throw new Error(`Category "${categoryName}" is missing`);
      return {
        de: row.de,
        ru: row.ru,
        partOfSpeech: resolvePartOfSpeech(row, category.name, fallbackPos),
        ...row.fields,
        categoryId: category.id,
      };
    });

    const operations: Prisma.PrismaPromise<Prisma.BatchPayload>[] = [];
    for (let i = 0; i < records.length; i += CREATE_CHUNK) {
      operations.push(prisma.word.createMany({ data: records.slice(i, i + CREATE_CHUNK) }));
    }
    // All chunks succeed or none does.
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
      prisma.word.findMany({ include: { category: true }, orderBy: [{ category: { name: 'asc' } }, { de: 'asc' }] }),
    ]);

    res.json({
      version: 1,
      exportedAt: new Date().toISOString(),
      categories: categories.map((c) => ({ name: c.name, icon: c.icon, color: c.color })),
      words: words.map((w) => {
        const entry: Record<string, string> = { de: w.de, ru: w.ru, category: w.category.name };
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
