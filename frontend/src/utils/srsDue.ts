import type { SRSRecord } from '../types';

/**
 * Whether a card should be asked in "only cards to review" mode.
 *
 *  - never answered      → due (a new card);
 *  - box 1               → due: a record sits in box 1 only after a wrong answer
 *                          (a correct one always promotes it), so a card that was
 *                          just failed comes back in the same session;
 *  - otherwise           → due once `nextReview` (set by `updateSRS` from
 *                          SRS_INTERVALS_DAYS) has passed.
 */
export function isDue(record: SRSRecord | undefined, now: number = Date.now()): boolean {
  if (!record) return true;
  if (record.box <= 1) return true;
  const next = Date.parse(record.nextReview);
  return Number.isNaN(next) || next <= now;
}

/** How many of the cards with these keys are due. */
export function countDue(keys: readonly string[], records: Record<string, SRSRecord>, now: number = Date.now()): number {
  let due = 0;
  for (const key of keys) if (isDue(records[key], now)) due += 1;
  return due;
}
