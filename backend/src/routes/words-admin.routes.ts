import { Router, Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { requireAdmin } from '../middleware/auth.middleware';
import { isPartOfSpeech } from '../services/partOfSpeech';
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
import { WORD_INCLUDE, serializeWord } from '../services/wordCategories';

/**
 * Admin-only tools for working with many words at once:
 *  - bulk change of category / part of speech, bulk delete;
 *  - duplicate detection and merging;
 *  - import preview (parse + validate without writing, so the admin can edit rows).
 * Everything here requires an admin session.
 */
const router = Router();

const MAX_IDS = 5000;
const CHUNK = 500; // stays well below SQLite's bound-variable limit

function readIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids = [...new Set(value.filter((v): v is string => typeof v === 'string' && v.length > 0))];
  return ids.length > 0 && ids.length <= MAX_IDS ? ids : null;
}

function chunked<T>(items: T[]): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) result.push(items.slice(i, i + CHUNK));
  return result;
}

/** "Перенести в категорию": the words end up in exactly this one category (their other categories are dropped). */
router.post('/bulk/category', requireAdmin, async (req: Request, res: Response) => {
  try {
    const ids = readIds(req.body?.ids);
    const categoryId = req.body?.categoryId;
    if (!ids || typeof categoryId !== 'string') return res.status(400).json({ error: 'Нужны ids и categoryId' });
    if (!(await prisma.category.findUnique({ where: { id: categoryId } }))) {
      return res.status(404).json({ error: 'Категория не найдена' });
    }

    let count = 0;
    for (const chunk of chunked(ids)) {
      const existing = await prisma.word.findMany({ where: { id: { in: chunk } }, select: { id: true } });
      await prisma.$transaction(
        existing.map((w) =>
          prisma.word.update({
            where: { id: w.id },
            data: { category: { connect: { id: categoryId } }, extraCategories: { set: [] } },
          })
        )
      );
      count += existing.length;
    }
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change category' });
  }
});

router.post('/bulk/part-of-speech', requireAdmin, async (req: Request, res: Response) => {
  try {
    const ids = readIds(req.body?.ids);
    const value = req.body?.partOfSpeech ?? null;
    if (!ids) return res.status(400).json({ error: 'Нужен список ids' });
    if (value !== null && !isPartOfSpeech(value)) return res.status(400).json({ error: 'Invalid partOfSpeech' });

    let count = 0;
    for (const chunk of chunked(ids)) {
      count += (await prisma.word.updateMany({ where: { id: { in: chunk } }, data: { partOfSpeech: value } })).count;
    }
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change part of speech' });
  }
});

router.post('/bulk/delete', requireAdmin, async (req: Request, res: Response) => {
  try {
    const ids = readIds(req.body?.ids);
    if (!ids) return res.status(400).json({ error: 'Нужен список ids' });

    let count = 0;
    for (const chunk of chunked(ids)) {
      count += (await prisma.word.deleteMany({ where: { id: { in: chunk } } })).count;
    }
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete words' });
  }
});

// ---- Duplicates -------------------------------------------------------------

/** Groups of words with the same German form (same rule the import uses: case/spaces/Unicode form ignored). */
router.get('/duplicates', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const words = (await prisma.word.findMany({ include: WORD_INCLUDE, orderBy: { createdAt: 'asc' } })).map(serializeWord);

    const byKey = new Map<string, typeof words>();
    for (const word of words) {
      const key = duplicateKey(word.de);
      const list = byKey.get(key) ?? [];
      list.push(word);
      byKey.set(key, list);
    }

    const groups = [...byKey.entries()]
      .filter(([, list]) => list.length > 1)
      .map(([key, list]) => ({ key, words: list }))
      .sort((a, b) => a.key.localeCompare(b.key, 'de'));

    res.json({ groups, total: groups.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to find duplicates' });
  }
});

/**
 * Keeps one word and deletes the others, first copying over every field the kept
 * word is missing (the first non-empty value among the removed words wins).
 * The kept word also joins every category the removed words were in.
 */
router.post('/duplicates/merge', requireAdmin, async (req: Request, res: Response) => {
  try {
    const keepId = req.body?.keepId;
    const removeIds = readIds(req.body?.removeIds)?.filter((id) => id !== keepId);
    if (typeof keepId !== 'string' || !removeIds || removeIds.length === 0) {
      return res.status(400).json({ error: 'Нужны keepId и removeIds' });
    }

    const keeper = await prisma.word.findUnique({ where: { id: keepId }, include: WORD_INCLUDE });
    if (!keeper) return res.status(404).json({ error: 'Слово не найдено' });

    const removed = await prisma.word.findMany({
      where: { id: { in: removeIds } },
      include: WORD_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    if (removed.length !== removeIds.length) return res.status(404).json({ error: 'Некоторые слова не найдены' });
    const keeperKey = duplicateKey(keeper.de);
    if (removed.some((w) => duplicateKey(w.de) !== keeperKey)) {
      return res.status(400).json({ error: 'Объединять можно только слова с одинаковой немецкой формой' });
    }

    const patch: Record<string, string> = {};
    for (const field of [...TEXT_FIELDS, 'partOfSpeech'] as const) {
      if (keeper[field]) continue;
      const donor = removed.find((w) => w[field]);
      if (donor?.[field]) patch[field] = donor[field] as string;
    }

    // Union of the categories: the kept word's primary stays primary, everything else becomes additional.
    const allCategoryIds = new Set<string>([keeper.categoryId]);
    for (const w of [keeper, ...removed]) {
      allCategoryIds.add(w.categoryId);
      w.extraCategories.forEach((c) => allCategoryIds.add(c.id));
    }
    allCategoryIds.delete(keeper.categoryId);

    await prisma.$transaction([
      prisma.word.update({
        where: { id: keepId },
        data: {
          ...(patch as Prisma.WordUpdateInput),
          extraCategories: { set: [...allCategoryIds].map((id) => ({ id })) },
        },
      }),
      prisma.word.deleteMany({ where: { id: { in: removeIds } } }),
    ]);

    res.json({ success: true, removed: removeIds.length, filledFields: Object.keys(patch) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to merge words' });
  }
});

// ---- Import preview -----------------------------------------------------------

/**
 * Parses and validates pasted import data WITHOUT writing anything and returns
 * the rows in an editable shape. The admin fixes them in the UI and then sends
 * the corrected list to the normal /words/import endpoint.
 * `category` of a row is a string; several categories are separated by " | ".
 */
router.post('/import/preview', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { data, defaultCategoryId, partOfSpeech } = req.body ?? {};
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

    let defaultCategoryName = '';
    if (defaultCategoryId) {
      const found = await prisma.category.findUnique({ where: { id: String(defaultCategoryId) } });
      if (!found) return res.status(400).json({ error: 'Категория по умолчанию не найдена' });
      defaultCategoryName = found.name;
    }

    const { rows, errors } = normalizeRows(raw.rows);
    const existing = await prisma.word.findMany({ select: { de: true } });
    const seen = new Set(existing.map((w) => duplicateKey(w.de)));
    const fallback: PartOfSpeech | null = partOfSpeech ?? null;

    const items = rows.map((row) => {
      const key = duplicateKey(row.de);
      const status = seen.has(key) ? ('duplicate' as const) : ('ok' as const);
      seen.add(key);
      const names = row.categories.length > 0 ? row.categories : defaultCategoryName ? [defaultCategoryName] : [];
      return {
        index: row.index,
        de: row.de,
        ru: row.ru,
        category: names.join(' | '),
        partOfSpeech: resolvePartOfSpeech(row, names.join(' '), fallback),
        fields: row.fields,
        status,
      };
    });

    res.json({ rows: items, errors, categories: raw.categories, total: raw.rows.length });
  } catch (error) {
    console.error('[import preview] failed:', error);
    res.status(500).json({ error: 'Preview failed' });
  }
});

export default router;
