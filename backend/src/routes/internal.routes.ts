import { timingSafeEqual } from 'node:crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db';
import { generateWordFill } from '../services/aiSettings';
import { recordAIError } from '../services/aiErrorLog';
import { isPartOfSpeech } from '../services/partOfSpeech';
import {
  ImportFormatError,
  MAX_IMPORT_ROWS,
  duplicateKey,
  extractRawImport,
  normalizeRows,
  resolvePartOfSpeech,
} from '../services/wordImport';
import type { ParsedRow, RowError } from '../services/wordImport';
import { normalizeCategoryName } from '../services/wordCategories';

const router = Router();
const DEFAULT_CATEGORY_ICON = '📌';
const DEFAULT_CATEGORY_COLOR = '#2563eb';

interface PlannedWord {
  row: ParsedRow;
  categoryNames: string[];
}

const requireHermesToken = (req: Request, res: Response, next: NextFunction) => {
  const configured = process.env.HERMES_WORD_IMPORT_TOKEN;
  const header = req.headers.authorization;
  const supplied = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!configured) return res.status(404).json({ error: 'Внутренний импорт не настроен' });
  const expected = Buffer.from(configured);
  const actual = Buffer.from(supplied);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return res.status(401).json({ error: 'Недействительный токен внутреннего импорта' });
  }
  return next();
};

/**
 * The single-call integration for trusted local automation. It uses the same
 * Gemini profile and import rules as the admin UI, but authenticates with a
 * separate server-side token instead of the browser's admin cookie.
 */
router.post('/word-import', requireHermesToken, async (req, res) => {
  const words = typeof req.body?.words === 'string' ? req.body.words.trim() : '';
  if (!words) return res.status(400).json({ error: 'Введите список слов' });

  try {
    const categories = await prisma.category.findMany();
    const generated = await generateWordFill({
      words,
      categories: categories.map((category) => category.name),
    });

    let raw;
    try {
      raw = extractRawImport(generated.json);
    } catch (error) {
      if (error instanceof ImportFormatError) return res.status(502).json({ error: error.message });
      throw error;
    }
    if (raw.rows.length === 0) return res.status(502).json({ error: 'ИИ не вернул ни одного слова' });
    if (raw.rows.length > MAX_IMPORT_ROWS) return res.status(400).json({ error: `Слишком много слов за раз (максимум ${MAX_IMPORT_ROWS})` });

    const normalized = normalizeRows(raw.rows);
    const rowErrors: RowError[] = [...normalized.errors];
    const categoryByName = new Map(categories.map((category) => [normalizeCategoryName(category.name), category]));
    const existing = await prisma.word.findMany({ select: { de: true } });
    const seen = new Set(existing.map((word) => duplicateKey(word.de)));
    const planned: PlannedWord[] = [];
    const duplicates: string[] = [];
    const newCategoryNames = new Map<string, string>();

    for (const row of normalized.rows) {
      const categoryNames = row.categories;
      if (categoryNames.length === 0) {
        rowErrors.push({ row: row.index, de: row.de, message: 'ИИ не указал категорию' });
        continue;
      }
      const key = duplicateKey(row.de);
      if (seen.has(key)) {
        duplicates.push(row.de);
        continue;
      }
      seen.add(key);
      for (const name of categoryNames) {
        const categoryKey = normalizeCategoryName(name);
        if (!categoryByName.has(categoryKey) && !newCategoryNames.has(categoryKey)) {
          newCategoryNames.set(categoryKey, name.trim());
        }
      }
      planned.push({ row, categoryNames });
    }

    rowErrors.sort((a, b) => a.row - b.row);
    const summary = {
      success: true,
      dryRun: false,
      total: raw.rows.length,
      importedCount: planned.length,
      duplicates,
      errors: rowErrors,
      newCategories: [...newCategoryNames.values()],
    };

    const metaByName = new Map(raw.categories.map((category) => [normalizeCategoryName(category.name), category]));
    for (const [key, name] of newCategoryNames) {
      const meta = metaByName.get(key);
      const created = await prisma.category.create({
        data: {
          name,
          normalizedName: normalizeCategoryName(name),
          icon: meta?.icon || DEFAULT_CATEGORY_ICON,
          color: meta?.color || DEFAULT_CATEGORY_COLOR,
          isBuiltin: false,
        },
      });
      categoryByName.set(key, created);
    }

    if (planned.length > 0) {
      const operations = planned.map(({ row, categoryNames }) => {
        const unique = new Map<string, (typeof categories)[number]>();
        for (const name of categoryNames) {
          const category = categoryByName.get(normalizeCategoryName(name));
          if (!category) throw new Error(`Category "${name}" is missing`);
          unique.set(category.id, category);
        }
        const [primary, ...extra] = [...unique.values()];
        return prisma.word.create({
          data: {
            de: row.de,
            ru: row.ru,
            partOfSpeech: resolvePartOfSpeech(row, [primary, ...extra].map((category) => category.name).join(' '), null),
            ...row.fields,
            category: { connect: { id: primary.id } },
            extraCategories: { connect: extra.map((category) => ({ id: category.id })) },
          },
        });
      });
      await prisma.$transaction(operations);
    }

    return res.json({ ...summary, generatedCount: generated.count });
  } catch (error) {
    await recordAIError({ operation: 'word-fill', profileId: 'wordFill', error });
    console.error('[internal word-import] failed:', error);
    if (error instanceof Error) {
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
      const result = messages[error.message];
      if (result) return res.status(result[0]).json({ error: result[1] });
    }
    return res.status(500).json({ error: 'Не удалось добавить слова через внутренний импорт' });
  }
});

export default router;
