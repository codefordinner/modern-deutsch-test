import {
  AI_PROFILE_CATEGORY_REDISTRIBUTION,
  AI_PROFILE_REQUIRED_CASE,
  AI_PROFILE_WORD_CHECK,
  AI_PROFILE_WORD_FILL,
  DEFAULT_AI_BATCH_SIZE,
  MAX_AI_BATCH_WORDS,
  MAX_WORD_FILL_CHARS,
  MAX_WORD_FILL_WORDS,
  readStored,
} from '../aiSettings';
import type { WordCheckCorrection, WordCheckField, WordCheckResult } from '../aiSettings';
import { callGemini, readGeminiText } from './gemini';
import { normalizeCategoryName } from '../wordCategories';

/**
 * Turns a raw word list into structured word entries via Gemini (the `wordFill`
 * profile). Returns the generated JSON text plus the word count, or an error code.
 */
export async function generateWordFill(input: {
  words: string;
  categories: string[];
  defaultCategory?: string;
}): Promise<{ json: string; count: number }> {
  const stored = await readStored();
  if (!stored?.apiKey) throw new Error('MISSING_API_KEY');
  const profile = stored.profiles[AI_PROFILE_WORD_FILL];
  if (!profile?.model) throw new Error('MISSING_MODEL');

  const text = input.words.trim();
  if (!text) throw new Error('EMPTY_WORDS');
  if (text.length > MAX_WORD_FILL_CHARS) throw new Error('WORDS_TOO_LONG');

  const categoryLine =
    input.categories.length > 0
      ? input.categories.map((c) => `«${c}»`).join(', ')
      : input.defaultCategory
        ? `«${input.defaultCategory}»`
        : '(категорий пока нет — придумай короткие подходящие названия)';

  const prompt = `${profile.prompt}\n\nДоступные категории: ${categoryLine}.${input.defaultCategory ? ` Если в слове не указана категория — используй «${input.defaultCategory}».` : ''}\n\nСписок слов:\n${text}`;

  const response = await callGemini({
    profile,
    apiKey: stored.apiKey,
    profileId: AI_PROFILE_WORD_FILL,
    operation: 'word-fill',
    prompt,
    timeout: 240_000,
    parts: [{ text: prompt }],
  });
  const raw = await readGeminiText(response);

  const json = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('INVALID_AI_RESPONSE');
  }
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('INVALID_AI_RESPONSE');
  if (parsed.length > MAX_WORD_FILL_WORDS) throw new Error('WORDS_TOO_MANY');

  return { json, count: parsed.length };
}

type AiWordInput = { id: string; de: string; ru: string; [key: string]: unknown };

async function generateBatchJson(
  profileId: string,
  words: AiWordInput[],
  context: string,
): Promise<unknown[]> {
  const stored = await readStored();
  if (!stored?.apiKey) throw new Error('MISSING_API_KEY');
  const profile = stored.profiles[profileId];
  if (!profile?.model) throw new Error('MISSING_MODEL');
  if (!words.length) throw new Error('EMPTY_WORDS');
  if (words.length > MAX_AI_BATCH_WORDS) throw new Error('WORDS_TOO_MANY');
  const batchSize = Math.max(
    10,
    Math.min(MAX_AI_BATCH_WORDS, Math.round(Number(profile.batchSize) || DEFAULT_AI_BATCH_SIZE)),
  );
  const chunks: AiWordInput[][] = [];
  for (let i = 0; i < words.length; i += batchSize) chunks.push(words.slice(i, i + batchSize));
  const generate = async (chunk: AiWordInput[]) => {
    const prompt = `${profile.prompt}\n\n${context}\n\nСлова:\n${JSON.stringify(chunk)}`;
    const operation =
      profileId === AI_PROFILE_REQUIRED_CASE
        ? 'required-case'
        : profileId === AI_PROFILE_WORD_CHECK
          ? 'word-check'
          : 'category-redistribution';
    const response = await callGemini({
      profile,
      apiKey: stored.apiKey,
      profileId,
      operation,
      prompt,
      timeout: 240_000,
      parts: [{ text: prompt }],
      json: true,
    });
    return readGeminiText(response);
  };
  const responses = await Promise.all(chunks.map(generate));
  const all: unknown[] = [];
  for (const raw of responses) {
    try {
      const parsed = JSON.parse(
        raw
          .replace(/^```json\s*/i, '')
          .replace(/\s*```$/, '')
          .trim(),
      );
      if (!Array.isArray(parsed)) throw new Error();
      all.push(...parsed);
    } catch {
      throw new Error('INVALID_AI_RESPONSE');
    }
  }
  return all;
}

export async function redistributeCategories(
  words: AiWordInput[],
  categories: string[],
): Promise<Array<{ id: string; categories: string[] }>> {
  const result = await generateBatchJson(
    AI_PROFILE_CATEGORY_REDISTRIBUTION,
    words,
    `Разрешённые категории: ${JSON.stringify(categories)}`,
  );
  const allowed = new Map(categories.map((category) => [normalizeCategoryName(category), category]));
  const expected = new Set(words.map((word) => word.id));
  if (result.length !== words.length) throw new Error('INVALID_AI_RESPONSE');
  const seen = new Set<string>();
  const normalized = result.map((item) => {
    if (typeof item !== 'object' || item === null) throw new Error('INVALID_AI_RESPONSE');
    const row = item as Record<string, unknown>;
    if (
      !Array.isArray(row.categories) ||
      row.categories.length === 0 ||
      row.categories.some((value) => typeof value !== 'string' || !allowed.has(normalizeCategoryName(value)))
    ) {
      throw new Error('INVALID_AI_RESPONSE');
    }
    const names = row.categories.flatMap((value) => {
      const canonical = allowed.get(normalizeCategoryName(value as string));
      return canonical ? [canonical] : [];
    });
    if (typeof row.id !== 'string' || !expected.has(row.id) || seen.has(row.id) || names.length === 0)
      throw new Error('INVALID_AI_RESPONSE');
    seen.add(row.id);
    return { id: row.id, categories: [...new Set(names)] };
  });
  return normalized;
}

export async function detectRequiredCases(
  words: AiWordInput[],
): Promise<Array<{ id: string; requiredCase: 'nominativ' | 'akkusativ' | 'dativ' | 'genitiv' | null }>> {
  const result = await generateBatchJson(
    AI_PROFILE_REQUIRED_CASE,
    words,
    'Допустимые значения requiredCase: nominativ, akkusativ, dativ, genitiv или null.',
  );
  const valid = new Set(['nominativ', 'akkusativ', 'dativ', 'genitiv']);
  const expected = new Set(words.map((word) => word.id));
  if (result.length !== words.length) throw new Error('INVALID_AI_RESPONSE');
  const seen = new Set<string>();
  const normalized = result.map((item) => {
    if (typeof item !== 'object' || item === null) throw new Error('INVALID_AI_RESPONSE');
    const row = item as Record<string, unknown>;
    const requiredCase =
      row.requiredCase === null || row.requiredCase === 'null'
        ? null
        : typeof row.requiredCase === 'string'
          ? row.requiredCase.trim().toLowerCase()
          : row.requiredCase;
    if (
      typeof row.id !== 'string' ||
      !expected.has(row.id) ||
      seen.has(row.id) ||
      (requiredCase !== null && (typeof requiredCase !== 'string' || !valid.has(requiredCase)))
    )
      throw new Error('INVALID_AI_RESPONSE');
    seen.add(row.id);
    return {
      id: row.id,
      requiredCase: requiredCase as 'nominativ' | 'akkusativ' | 'dativ' | 'genitiv' | null,
    };
  });
  return normalized;
}

const WORD_CHECK_FIELDS = new Set<WordCheckField>([
  'de',
  'ru',
  'hint',
  'partOfSpeech',
  'plural',
  'feminine',
  'praeteritum',
  'partizip2',
  'hilfsverb',
  'praesensIch',
  'praesensDu',
  'praesensErSieEs',
  'praesensWir',
  'praesensIhr',
  'praesensSie',
  'requiredCase',
]);
const PART_OF_SPEECH_VALUES = new Set(['noun', 'verb', 'adjective', 'adverb', 'other']);
const REQUIRED_CASE_VALUES = new Set(['nominativ', 'akkusativ', 'dativ', 'genitiv']);

function parseWordCheckCorrections(value: unknown): WordCheckCorrection[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('INVALID_AI_RESPONSE');
  const seen = new Set<string>();
  return value.map((item) => {
    if (typeof item !== 'object' || item === null) throw new Error('INVALID_AI_RESPONSE');
    const row = item as Record<string, unknown>;
    const field = row.field;
    const rawValue = row.value;
    if (typeof field !== 'string' || !WORD_CHECK_FIELDS.has(field as WordCheckField) || seen.has(field))
      throw new Error('INVALID_AI_RESPONSE');
    if (rawValue !== null && typeof rawValue !== 'string') throw new Error('INVALID_AI_RESPONSE');
    if (typeof rawValue === 'string' && rawValue.length > 2000) throw new Error('INVALID_AI_RESPONSE');
    if ((field === 'de' || field === 'ru') && (typeof rawValue !== 'string' || !rawValue.trim()))
      throw new Error('INVALID_AI_RESPONSE');
    if (field === 'partOfSpeech' && rawValue !== null && !PART_OF_SPEECH_VALUES.has(rawValue))
      throw new Error('INVALID_AI_RESPONSE');
    if (field === 'hilfsverb' && rawValue !== null && rawValue !== 'haben' && rawValue !== 'sein')
      throw new Error('INVALID_AI_RESPONSE');
    if (field === 'requiredCase' && rawValue !== null && !REQUIRED_CASE_VALUES.has(rawValue))
      throw new Error('INVALID_AI_RESPONSE');
    seen.add(field);
    return { field: field as WordCheckField, value: typeof rawValue === 'string' ? rawValue.trim() : null };
  });
}

export async function checkWordsWithAI(words: AiWordInput[]): Promise<WordCheckResult[]> {
  const result = await generateBatchJson(
    AI_PROFILE_WORD_CHECK,
    words,
    'Проверяй каждую запись полностью, включая все переданные формы и категорию. Помимо issues обязательно верни corrections: массив безопасных исправлений с полями field и value. Добавляй туда только изменения, в которых уверен; если уверенного исправления нет, верни corrections=[].',
  );
  const expected = new Set(words.map((word) => word.id));
  if (result.length !== words.length) throw new Error('INVALID_AI_RESPONSE');
  const seen = new Set<string>();
  return result.map((item) => {
    if (typeof item !== 'object' || item === null) throw new Error('INVALID_AI_RESPONSE');
    const row = item as Record<string, unknown>;
    if (typeof row.id !== 'string' || !expected.has(row.id) || seen.has(row.id) || !Array.isArray(row.issues))
      throw new Error('INVALID_AI_RESPONSE');
    seen.add(row.id);
    const issues = row.issues.map((issue) => {
      if (typeof issue !== 'object' || issue === null) throw new Error('INVALID_AI_RESPONSE');
      const value = issue as Record<string, unknown>;
      if (
        typeof value.field !== 'string' ||
        (value.severity !== 'error' && value.severity !== 'warning') ||
        typeof value.message !== 'string' ||
        (value.suggestion !== undefined && typeof value.suggestion !== 'string')
      )
        throw new Error('INVALID_AI_RESPONSE');
      return {
        field: value.field,
        severity: value.severity as 'error' | 'warning',
        message: value.message,
        ...(value.suggestion ? { suggestion: value.suggestion } : {}),
      };
    });
    return { id: row.id, issues, corrections: parseWordCheckCorrections(row.corrections) };
  });
}
