import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import type { PartOfSpeech } from './partOfSpeech';
import {
  MAX_IMPORT_ROWS,
  duplicateKey,
  extractRawImport,
  normalizeRows,
  resolvePartOfSpeech,
  ImportFormatError,
} from './wordImport';
import type { ParsedRow, RowError } from './wordImport';
import { normalizeCategoryName } from './wordCategories';

const DEFAULT_CATEGORY_ICON = '📌';
const DEFAULT_CATEGORY_COLOR = '#2563eb';

interface PlannedWord { row: ParsedRow; categoryNames: string[] }

export interface WordImportOptions {
  data: string;
  defaultCategoryId?: string;
  partOfSpeech?: PartOfSpeech;
  skipDuplicates?: boolean;
  dryRun?: boolean;
}

export interface WordImportResult {
  success: true;
  dryRun: boolean;
  total: number;
  importedCount: number;
  duplicates: string[];
  errors: RowError[];
  newCategories: string[];
}

/** Parses, validates and atomically imports words for both browser and internal callers. */
export async function importWords(options: WordImportOptions): Promise<WordImportResult> {
  const { data, defaultCategoryId, partOfSpeech, skipDuplicates = true, dryRun = false } = options;
  if (!data.trim()) throw new ImportFormatError('Нет данных для импорта');
  if (partOfSpeech && !['noun', 'verb', 'adjective', 'adverb', 'other'].includes(partOfSpeech)) throw new ImportFormatError('Недопустимая часть речи');

  const raw = extractRawImport(data);
  if (raw.rows.length === 0) throw new ImportFormatError('В данных не найдено ни одного слова');
  if (raw.rows.length > MAX_IMPORT_ROWS) throw new ImportFormatError(`Слишком много слов за раз (максимум ${MAX_IMPORT_ROWS})`);

  const normalized = normalizeRows(raw.rows);
  const rowErrors: RowError[] = [...normalized.errors];
  const categories = await prisma.category.findMany();
  const categoryByName = new Map(categories.map((category) => [normalizeCategoryName(category.name), category]));

  let defaultCategoryName: string | null = null;
  if (defaultCategoryId) {
    const found = categories.find((category) => category.id === String(defaultCategoryId));
    if (!found) throw new ImportFormatError('Категория по умолчанию не найдена');
    defaultCategoryName = found.name;
  }

  const existing = await prisma.word.findMany({ select: { de: true } });
  const seen = new Set(existing.map((word) => duplicateKey(word.de)));
  const planned: PlannedWord[] = [];
  const duplicates: string[] = [];
  const newCategoryNames = new Map<string, string>();

  for (const row of normalized.rows) {
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
      const categoryKey = normalizeCategoryName(name);
      if (!categoryByName.has(categoryKey) && !newCategoryNames.has(categoryKey)) newCategoryNames.set(categoryKey, name.trim());
    }
    planned.push({ row, categoryNames });
  }

  rowErrors.sort((a, b) => a.row - b.row);
  const summary: WordImportResult = {
    success: true,
    dryRun: Boolean(dryRun),
    total: raw.rows.length,
    importedCount: planned.length,
    duplicates,
    errors: rowErrors,
    newCategories: [...newCategoryNames.values()],
  };
  if (dryRun || planned.length === 0) return summary;

  const metaByName = new Map(raw.categories.map((category) => [normalizeCategoryName(category.name), category]));
  for (const [key, name] of newCategoryNames) {
    const meta = metaByName.get(key);
    const created = await prisma.category.create({
      data: { name, normalizedName: normalizeCategoryName(name), icon: meta?.icon || DEFAULT_CATEGORY_ICON, color: meta?.color || DEFAULT_CATEGORY_COLOR, isBuiltin: false },
    });
    categoryByName.set(key, created);
  }

  const fallbackPos: PartOfSpeech | null = partOfSpeech ?? null;
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
        partOfSpeech: resolvePartOfSpeech(row, [primary, ...extra].map((category) => category.name).join(' '), fallbackPos),
        ...row.fields,
        category: { connect: { id: primary.id } },
        extraCategories: { connect: extra.map((category) => ({ id: category.id })) },
      },
    });
  });
  await prisma.$transaction(operations);
  return summary;
}
