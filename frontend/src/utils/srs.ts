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

  return {
    ...records,
    [id]: {
      ...current,
      box: newBox,
      streak: newStreak,
      mistakes: newMistakes,
      lastReviewed: new Date().toISOString(),
    },
  };
}

export function getDueCards<T extends { id: string }>(words: T[], _records: Record<string, any>): T[] {
  return sortWordsBySRSPriority(words);
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
