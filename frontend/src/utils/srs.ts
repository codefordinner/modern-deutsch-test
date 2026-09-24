import type { SRSRecord, VerbFormSource, WordDirection, WordFormType } from '../types';

/** Leitner progress keyed by card id (build keys with `srsKeys` below). */
export type SRSMap = Record<string, SRSRecord>;

// Days until the next review, indexed by box (1..5); index 0 is unused.
export const SRS_INTERVALS_DAYS = [0, 1, 3, 7, 14, 30];

const DAY_MS = 24 * 60 * 60 * 1000;

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
 * a correct answer moves it up one box, a mistake sends it back to box 1
 * (classic Leitner), and `nextReview` is set from the new box's interval.
 */
export function updateSRS(records: SRSMap, id: string, isCorrect: boolean): SRSMap {
  const current = records[id];
  const box = isCorrect ? Math.min(5, (current?.box || 1) + 1) : 1;
  const now = new Date();
  const daysUntilNext = SRS_INTERVALS_DAYS[box] ?? 1;

  return {
    ...records,
    [id]: {
      box,
      streak: isCorrect ? (current?.streak || 0) + 1 : 0,
      mistakes: (current?.mistakes || 0) + (isCorrect ? 0 : 1),
      lastReviewed: now.toISOString(),
      nextReview: new Date(now.getTime() + daysUntilNext * DAY_MS).toISOString(),
    },
  };
}

/**
 * Picks the next card to practise. Among the cards that are due (never
 * seen, or `nextReview` has passed) it takes one from the lowest box; if
 * nothing is due it falls back to any card at random.
 *
 * `keyFn` builds the progress key for an item, so the same word/verb can
 * carry independent progress per direction, form or quiz mode.
 */
export function pickCardBySRS<T>(items: T[], records: SRSMap, keyFn: (item: T) => string): T | undefined {
  const now = Date.now();
  let candidates: T[] = [];
  let lowestBox = Infinity;

  for (const item of items) {
    const record = records[keyFn(item)];
    const nextReview = record?.nextReview ? new Date(record.nextReview).getTime() : 0;
    if (nextReview > now) continue; // not due yet

    const box = record?.box || 1;
    if (box < lowestBox) {
      lowestBox = box;
      candidates = [item];
    } else if (box === lowestBox) {
      candidates.push(item);
    }
  }

  const pool = candidates.length > 0 ? candidates : items;
  return pool[Math.floor(Math.random() * pool.length)];
}
