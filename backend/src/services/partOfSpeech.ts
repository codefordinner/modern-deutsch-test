/**
 * Explicit part of speech of a dictionary entry. Trainers rely on it instead of
 * guessing from category names ("глагол…") or from which form fields happen to
 * be filled in.
 *
 * Stored as a plain string (Prisma 5 has no enums for SQLite) and validated here.
 */
export const PARTS_OF_SPEECH = ['noun', 'verb', 'adjective', 'adverb', 'other'] as const;
export type PartOfSpeech = (typeof PARTS_OF_SPEECH)[number];

export const isPartOfSpeech = (value: unknown): value is PartOfSpeech =>
  typeof value === 'string' && (PARTS_OF_SPEECH as readonly string[]).includes(value);

interface InferInput {
  de?: string | null;
  praeteritum?: string | null;
  partizip2?: string | null;
  categoryName?: string | null;
}

const hasText = (value: string | null | undefined): boolean => Boolean(value && value.trim());

/**
 * Best guess for entries saved without an explicit part of speech (imports,
 * old clients, legacy rows). Returns null when nothing reliable points to an answer.
 */
export function inferPartOfSpeech({ de, praeteritum, partizip2, categoryName }: InferInput): PartOfSpeech | null {
  if (hasText(praeteritum) || hasText(partizip2)) return 'verb';
  if (categoryName && /глагол/i.test(categoryName)) return 'verb';
  if (de && /^(der|die|das)\s+\S/i.test(de.trim())) return 'noun';
  return null;
}

export type PartOfSpeechInput =
  | { ok: true; value: PartOfSpeech | null | undefined }
  | { ok: false; error: string };

/**
 * Interprets the `partOfSpeech` field of a request body.
 *  - a valid value                → used as is;
 *  - null / '' (the "auto" choice) → inferred from the rest of the entry;
 *  - missing                       → `undefined` when `keepIfMissing` (updates leave the column alone),
 *                                    otherwise inferred (creates);
 *  - anything else                 → rejected.
 */
export function readPartOfSpeech(
  body: { partOfSpeech?: unknown } & InferInput,
  { keepIfMissing }: { keepIfMissing: boolean }
): PartOfSpeechInput {
  const raw = body.partOfSpeech;

  if (raw === undefined && keepIfMissing) return { ok: true, value: undefined };
  if (raw === undefined || raw === null || raw === '') return { ok: true, value: inferPartOfSpeech(body) };
  if (isPartOfSpeech(raw)) return { ok: true, value: raw };

  return { ok: false, error: `partOfSpeech must be one of: ${PARTS_OF_SPEECH.join(', ')}` };
}
