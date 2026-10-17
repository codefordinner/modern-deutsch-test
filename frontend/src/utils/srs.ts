import type { SRSRecord, VerbFormSource, WordDirection, WordFormType } from '../types';
import { pickRandom } from './random';

/** Leitner progress keyed by card id (build keys with `srsKeys` below). */
export type SRSMap = Record<string, SRSRecord>;

export const SRS_BOX_COUNT = 5;

/**
 * How often a card from each box is asked: index 0 = box 1 (the lowest: new
 * cards and cards that were just answered wrongly), index 4 = box 5 (the highest).
 * The numbers are relative weights (they happen to add up to 100, so they read as
 * percentages). Boxes that hold no card in the current pool are skipped and the
 * rest are renormalised — e.g. with only boxes 1 and 5 filled the split is 60:10.
 */
export const SRS_BOX_WEIGHTS: readonly number[] = [60, 15, 10, 5, 10];

/** Nominal share (in %) of questions that come from the given box (1..5). */
export function boxProbabilityPercent(box: number, weights: readonly number[] = SRS_BOX_WEIGHTS): number {
  const total = weights.reduce((sum, w) => sum + Math.max(0, w), 0);
  if (total <= 0) return 0;
  return Math.round((Math.max(0, weights[box - 1] ?? 0) / total) * 100);
}

// Informational only: `nextReview` is still stored with every record, but it no
// longer influences which card is asked (selection is purely by box weights).
export const SRS_INTERVALS_DAYS = [0, 1, 3, 7, 14, 30];

const DAY_MS = 24 * 60 * 60 * 1000;

/** The box (1..5) of a record; a card that was never answered is in box 1. */
const boxOf = (record: SRSRecord | undefined): number =>
  Math.min(SRS_BOX_COUNT, Math.max(1, Math.round(record?.box || 1)));

/** Local calendar day as `YYYY-MM-DD` — "a day" for the one-promotion-per-day rule. */
export function localDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * The single source of truth for SRS card keys. The trainers use these to
 * read/write progress and the SRS screens use them to count boxes, so the two
 * can't drift apart. The formats are persisted in localStorage — changing them
 * throws away everybody's progress.
 */
export const srsKeys = {
  /**
   * Each (word, direction, form) combination tracks its own Leitner box, so
   * e.g. knowing "der Tisch" ru→de doesn't hide that its plural or de→ru
   * direction still needs practice.
   */
  word: (wordId: string, direction: WordDirection, formType: WordFormType) => `${wordId}:${direction}:${formType}`,

  verb: {
    /** "Спряжение": infinitive + pronoun → Präsens form. */
    praesens: (verbId: string, pronoun: string) => `${verbId}:praesens:${pronoun}`,
    /** "3 Формы": Präteritum + Partizip II + Hilfsverb. */
    stammformen: (verbId: string) => `${verbId}:stammformen`,
    /** "Тест": pick the right Partizip II. */
    multipleChoice: (verbId: string) => `${verbId}:multiple_choice`,
    /**
     * "Форма → Инфинитив". Präsens-sourced cards carry the pronoun (and keep
     * the original key format so old progress survives); Präteritum and
     * Partizip II cards are single fixed forms and ignore `pronoun`.
     */
    formToInfinitive: (verbId: string, source: VerbFormSource, pronoun = '') => {
      if (source === 'praesens') return `${verbId}:form_to_infinitive:${pronoun}`;
      if (source === 'praeteritum') return `${verbId}:form_to_infinitive_praeteritum`;
      return `${verbId}:form_to_infinitive_partizip2`;
    },
  },
};

/**
 * Returns a copy of `records` with the card `id` updated after an answer:
 *  - a mistake sends the card back to box 1 (classic Leitner);
 *  - a correct answer moves it up ONE box — but at most once per calendar day:
 *    further correct answers the same day keep the box, so a card can never jump
 *    from box 1 to box 5 in a single day.
 */
export function updateSRS(records: SRSMap, id: string, isCorrect: boolean, now: Date = new Date()): SRSMap {
  const current = records[id];
  const currentBox = boxOf(current);
  const today = localDayKey(now);

  let box = 1;
  let promotedOn: string | undefined;
  if (isCorrect) {
    if (current?.promotedOn === today || currentBox >= SRS_BOX_COUNT) {
      box = currentBox; // already promoted today (or nowhere higher to go)
      promotedOn = current?.promotedOn;
    } else {
      box = currentBox + 1;
      promotedOn = today;
    }
  }

  const daysUntilNext = SRS_INTERVALS_DAYS[box] ?? 1;
  const record: SRSRecord = {
    box,
    streak: isCorrect ? (current?.streak || 0) + 1 : 0,
    mistakes: (current?.mistakes || 0) + (isCorrect ? 0 : 1),
    lastReviewed: now.toISOString(),
    nextReview: new Date(now.getTime() + daysUntilNext * DAY_MS).toISOString(),
  };
  if (promotedOn) record.promotedOn = promotedOn;

  return { ...records, [id]: record };
}

export interface PickOptions {
  /** Key of a card that should not be asked again right away (ignored when it is the only card). */
  excludeKey?: string;
  /** Replaces `SRS_BOX_WEIGHTS`. */
  weights?: readonly number[];
  /** Replaces `Math.random` (for tests). */
  random?: () => number;
}

/**
 * Picks the next card to practise: first a box is drawn with the probabilities
 * from `SRS_BOX_WEIGHTS` (only among boxes that hold at least one of `items`),
 * then a random card of that box.
 *
 * Only the cards in `items` take part, so it behaves the same whether all
 * categories or just a few are selected. Due dates play no role: a word that
 * has not got past box 1 is never crowded out by words from higher boxes
 * more often than the weights say.
 *
 * `keyFn` builds the progress key for an item, so the same word/verb can
 * carry independent progress per direction, form or quiz mode.
 */
export function pickCardBySRS<T>(
  items: T[],
  records: SRSMap,
  keyFn: (item: T) => string,
  { excludeKey, weights = SRS_BOX_WEIGHTS, random = Math.random }: PickOptions = {}
): T | undefined {
  if (items.length === 0) return undefined;

  const withoutLast = excludeKey !== undefined && items.length > 1 ? items.filter((item) => keyFn(item) !== excludeKey) : items;
  const pool = withoutLast.length > 0 ? withoutLast : items;

  const buckets: T[][] = Array.from({ length: SRS_BOX_COUNT }, () => []);
  for (const item of pool) buckets[boxOf(records[keyFn(item)]) - 1].push(item);

  const boxWeights = buckets.map((bucket, i) => (bucket.length > 0 ? Math.max(0, weights[i] ?? 0) : 0));
  const total = boxWeights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return pickRandom(pool);

  let roll = random() * total;
  let chosen = boxWeights.findIndex((w) => w > 0);
  for (let i = 0; i < boxWeights.length; i++) {
    if (boxWeights[i] <= 0) continue;
    chosen = i;
    roll -= boxWeights[i];
    if (roll < 0) break;
  }

  return pickRandom(buckets[chosen]);
}
