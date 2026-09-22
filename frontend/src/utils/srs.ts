import type { SRSRecord } from '../types';

const STORAGE_KEY = 'modern_deutsch_srs_data';

export const SRS_INTERVALS_DAYS = [0, 1, 3, 7, 14, 30]; // Index maps to box 1..5

export function getAllSRSRecords(): Record<string, SRSRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function saveAllSRSRecords(data: Record<string, SRSRecord>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save SRS records:', e);
  }
}

export function getCardSRS(id: string): SRSRecord {
  const records = getAllSRSRecords();
  if (records[id]) {
    return records[id];
  }
  return {
    box: 1,
    streak: 0,
    mistakes: 0,
    lastReviewed: new Date(0).toISOString(),
    nextReview: new Date().toISOString(),
  };
}

export function recordSRSAnswer(id: string, isCorrect: boolean): SRSRecord {
  const records = getAllSRSRecords();
  const current = getCardSRS(id);

  let newBox = current.box;
  let newStreak = current.streak;
  let newMistakes = current.mistakes;

  if (isCorrect) {
    newBox = Math.min(5, current.box + 1);
    newStreak += 1;
  } else {
    newBox = 1; // Reset to Box 1 upon mistake (classic Leitner)
    newStreak = 0;
    newMistakes += 1;
  }

  const daysUntilNext = SRS_INTERVALS_DAYS[newBox] || 1;
  const now = new Date();
  const nextDate = new Date(now.getTime() + daysUntilNext * 24 * 60 * 60 * 1000);

  const updated: SRSRecord = {
    box: newBox,
    streak: newStreak,
    mistakes: newMistakes,
    lastReviewed: now.toISOString(),
    nextReview: nextDate.toISOString(),
  };

  records[id] = updated;
  saveAllSRSRecords(records);
  return updated;
}

// Sorts / samples items favoring:
// 1. Due for review (nextReview <= now)
// 2. Lower boxes (box 1, 2, etc.)
export function sortWordsBySRSPriority<T extends { id: string }>(words: T[]): T[] {
  const now = new Date().getTime();
  const records = getAllSRSRecords();

  return [...words].sort((a, b) => {
    const srsA = records[a.id] || { box: 1, nextReview: new Date(0).toISOString() };
    const srsB = records[b.id] || { box: 1, nextReview: new Date(0).toISOString() };

    const dueA = new Date(srsA.nextReview).getTime() <= now ? 0 : 1;
    const dueB = new Date(srsB.nextReview).getTime() <= now ? 0 : 1;

    if (dueA !== dueB) return dueA - dueB; // Due first
    if (srsA.box !== srsB.box) return srsA.box - srsB.box; // Lower box first

    // Add slight random jitter for equal priorities
    return Math.random() - 0.5;
  });
}

export function updateSRS(
  records: Record<string, any>,
  id: string,
  isCorrect: boolean
): Record<string, any> {
  const current = records[id] || { box: 1, streak: 0, mistakes: 0 };
  const newBox = isCorrect ? Math.min(5, (current.box || 1) + 1) : 1;
  const newStreak = isCorrect ? (current.streak || 0) + 1 : 0;
  const newMistakes = !isCorrect ? (current.mistakes || 0) + 1 : current.mistakes || 0;

  // IMPORTANT FIX: this previously never set `nextReview`, which meant the
  // due-card selector always treated every reviewed card as "not due" (it
  // compared `now` against `new Date(undefined)`, i.e. NaN). Compute it
  // properly from the Leitner box interval so due-based selection works.
  const daysUntilNext = SRS_INTERVALS_DAYS[newBox] ?? 1;
  const now = new Date();
  const nextReview = new Date(now.getTime() + daysUntilNext * 24 * 60 * 60 * 1000).toISOString();

  return {
    ...records,
    [id]: {
      ...current,
      box: newBox,
      streak: newStreak,
      mistakes: newMistakes,
      lastReviewed: now.toISOString(),
      nextReview,
    },
  };
}

// Sorts/selects "due" items from any collection using a caller-provided key.
// Using a composite key (e.g. `${word.id}:${direction}:${formType}` or
// `${verb.id}:${mode}`) lets the same word/verb carry independent Leitner
// progress per direction, per form (plural/feminine/base), or per verb-quiz
// mode, instead of sharing a single box across all of them.
export function getDueCardsByKey<T>(
  items: T[],
  records: Record<string, any>,
  keyFn: (item: T) => string
): T[] {
  const now = new Date().getTime();

  return [...items].sort((a, b) => {
    const srsA = records[keyFn(a)];
    const srsB = records[keyFn(b)];

    const boxA = srsA?.box || 1;
    const boxB = srsB?.box || 1;

    const nextReviewA = srsA?.nextReview ? new Date(srsA.nextReview).getTime() : 0;
    const nextReviewB = srsB?.nextReview ? new Date(srsB.nextReview).getTime() : 0;

    const dueA = nextReviewA <= now ? 0 : 1;
    const dueB = nextReviewB <= now ? 0 : 1;

    if (dueA !== dueB) return dueA - dueB; // Due first
    if (boxA !== boxB) return boxA - boxB; // Lower box first

    return Math.random() - 0.5; // Jitter for equal priority
  });
}

// IMPORTANT FIX: previously this ignored the `records` argument completely
// and read from an unrelated localStorage store (`sortWordsBySRSPriority`,
// backed by `modern_deutsch_srs_data`) that nothing else in the app ever
// wrote to. Due-card selection was therefore completely disconnected from
// the actual box progress shown in the SRS modals. Kept for compatibility,
// now delegates to getDueCardsByKey using the item's own id.
export function getDueCards<T extends { id: string }>(words: T[], records: Record<string, any>): T[] {
  return getDueCardsByKey(words, records, (w) => w.id);
}

export function getSRSStats(wordIds: string[]): any {

  const records = getAllSRSRecords();
  const boxes: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  for (const id of wordIds) {
    const r = records[id];
    const b = r ? r.box : 1;
    boxes[b] = (boxes[b] || 0) + 1;
  }

  const total = wordIds.length;
  const mastered = boxes[5] || 0;
  // Weighted mastery formula (Box 1 = 0%, Box 2 = 25%, Box 3 = 50%, Box 4 = 75%, Box 5 = 100%)
  const score = (boxes[1] * 0 + boxes[2] * 0.25 + boxes[3] * 0.5 + boxes[4] * 0.75 + boxes[5] * 1);
  const masteryRate = total > 0 ? Math.round((score / total) * 100) : 0;

  return {
    boxes,
    totalLearned: total,
    mastered,
    masteryRate,
  };
}
