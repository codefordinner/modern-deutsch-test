import { inferPartOfSpeech, isPartOfSpeech } from './partOfSpeech';
import type { PartOfSpeech } from './partOfSpeech';

/**
 * Разбор данных для массового импорта слов.
 *
 * Принимает:
 *  - JSON (массив объектов или { "words": [...], "categories": [...] }), в том числе
 *    обёрнутый в ```json ... ``` — именно так отвечают нейросети;
 *  - простой текст: одно слово на строку, колонки через TAB, «;» или «,»:
 *    немецкий | русский | множественное число | подсказка.
 */

export const MAX_IMPORT_ROWS = 5000;

export const TEXT_FIELDS = [
  'hint',
  'plural',
  'feminine',
  'femininePlural',
  'praeteritum',
  'partizip2',
  'hilfsverb',
  'praesensIch',
  'praesensDu',
  'praesensErSieEs',
  'praesensWir',
  'praesensIhr',
  'praesensSie',
] as const;
export type TextField = (typeof TEXT_FIELDS)[number];

export class ImportFormatError extends Error {}

export interface ParsedRow {
  /** 1-based position in the pasted data (for error messages). */
  index: number;
  de: string;
  ru: string;
  category: string | null;
  partOfSpeech: PartOfSpeech | null;
  fields: Partial<Record<TextField, string>>;
}

export interface RowError {
  row: number;
  de?: string;
  message: string;
}

export interface CategoryMeta {
  name: string;
  icon?: string;
  color?: string;
}

export interface RawImport {
  rows: unknown[];
  categories: CategoryMeta[];
}

const POS_ALIASES: Record<string, PartOfSpeech> = {
  'существительное': 'noun',
  'глагол': 'verb',
  'прилагательное': 'adjective',
  'наречие': 'adverb',
  'другое': 'other',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A scalar (or list of scalars) from the data as trimmed NFC text; anything else → ''. */
function toText(value: unknown): string {
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(', ');
  if (typeof value === 'string') return value.normalize('NFC').trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

/** Key for detecting "the same word": case, extra spaces and Unicode form don't matter. */
export const duplicateKey = (de: string): string => de.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();

function extractCodeBlock(text: string): string {
  const fenced = /```[\w-]*[ \t]*\r?\n([\s\S]*?)```/.exec(text);
  return (fenced ? fenced[1] : text).trim();
}

function parseCategories(value: unknown): CategoryMeta[] {
  if (!Array.isArray(value)) return [];
  const result: CategoryMeta[] = [];
  for (const item of value) {
    if (typeof item === 'string' && item.trim()) result.push({ name: item.trim() });
    else if (isRecord(item) && toText(item.name)) {
      result.push({ name: toText(item.name), icon: toText(item.icon) || undefined, color: toText(item.color) || undefined });
    }
  }
  return result;
}

/** Turns the pasted text into a list of raw rows; throws ImportFormatError when it is unreadable. */
export function extractRawImport(input: string): RawImport {
  const text = extractCodeBlock(input);
  if (!text) throw new ImportFormatError('Нет данных для импорта');

  if (text.startsWith('[') || text.startsWith('{')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new ImportFormatError(`Не удалось прочитать JSON: ${e instanceof Error ? e.message : 'ошибка разбора'}`);
    }
    if (Array.isArray(parsed)) return { rows: parsed, categories: [] };
    if (isRecord(parsed)) {
      const list = parsed.words ?? parsed.items;
      if (Array.isArray(list)) return { rows: list, categories: parseCategories(parsed.categories) };
    }
    throw new ImportFormatError('Ожидался JSON-массив слов или объект вида {"words": [...]}');
  }

  // Plain text: one word per line.
  const rows: Record<string, string>[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    // Tabs and ";" first: a comma may be part of a Russian translation ("идти, ходить").
    const separator = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',';
    const parts = line.split(separator).map((p) => p.trim());
    rows.push({ de: parts[0] ?? '', ru: parts[1] ?? '', plural: parts[2] ?? '', hint: parts[3] ?? '' });
  }
  return { rows, categories: [] };
}

function normalizeHilfsverb(value: string): 'haben' | 'sein' | null {
  const v = value.toLowerCase();
  if (v === 'sein' || v === 'ist') return 'sein';
  if (v === 'haben' || v === 'hat') return 'haben';
  return null;
}

/** Validates and cleans the raw rows. Bad rows are reported, good ones are returned. */
export function normalizeRows(raw: unknown[]): { rows: ParsedRow[]; errors: RowError[] } {
  const rows: ParsedRow[] = [];
  const errors: RowError[] = [];

  raw.forEach((item, i) => {
    const index = i + 1;
    if (!isRecord(item)) {
      errors.push({ row: index, message: 'Строка должна быть объектом с полями de и ru' });
      return;
    }

    const de = toText(item.de);
    const ru = toText(item.ru);
    if (!de || !ru) {
      errors.push({ row: index, de: de || undefined, message: !de ? 'Не заполнено поле de' : 'Не заполнено поле ru' });
      return;
    }

    let partOfSpeech: PartOfSpeech | null = null;
    const posText = toText(item.partOfSpeech).toLowerCase();
    if (posText) {
      const mapped = POS_ALIASES[posText] ?? posText;
      if (!isPartOfSpeech(mapped)) {
        errors.push({ row: index, de, message: `Неизвестная часть речи «${posText}» (нужно: noun, verb, adjective, adverb, other)` });
        return;
      }
      partOfSpeech = mapped;
    }

    const fields: Partial<Record<TextField, string>> = {};
    for (const field of TEXT_FIELDS) {
      const value = toText(item[field]);
      if (value) fields[field] = value;
    }

    if (fields.hilfsverb) {
      const normalized = normalizeHilfsverb(fields.hilfsverb);
      if (!normalized) {
        errors.push({ row: index, de, message: `hilfsverb должен быть «haben» или «sein», получено «${fields.hilfsverb}»` });
        return;
      }
      fields.hilfsverb = normalized;
    }

    rows.push({ index, de, ru, category: toText(item.category ?? item.categoryName) || null, partOfSpeech, fields });
  });

  return { rows, errors };
}

/** Part of speech to store: explicit value > the request-wide default > a guess from the entry. */
export function resolvePartOfSpeech(
  row: ParsedRow,
  categoryName: string,
  fallback: PartOfSpeech | null
): PartOfSpeech | null {
  return (
    row.partOfSpeech ??
    fallback ??
    inferPartOfSpeech({
      de: row.de,
      praeteritum: row.fields.praeteritum,
      partizip2: row.fields.partizip2,
      categoryName,
    })
  );
}
