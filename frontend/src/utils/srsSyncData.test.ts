import { describe, expect, it } from 'vitest';
import { emptySyncData, mergeSyncData, sanitizeSyncData } from './srsSyncData';

describe('SRS sync data', () => {
  it('keeps the newer card and applies a reset timestamp', () => {
    const old = new Date('2025-01-01T00:00:00Z').toISOString();
    const fresh = new Date('2025-01-02T00:00:00Z').toISOString();
    const a = sanitizeSyncData({ srs: { words: { card: { box: 1, streak: 0, mistakes: 1, lastReviewed: old, nextReview: old } } } });
    const b = sanitizeSyncData({ srs: { words: { card: { box: 3, streak: 2, mistakes: 1, lastReviewed: fresh, nextReview: fresh } } } });
    expect(mergeSyncData(a, b).srs.words.card.box).toBe(3);
    expect(mergeSyncData({ ...emptySyncData(), resetAt: { words: Date.parse(fresh), verbs: 0, articles: 0 } }, a).srs.words).toEqual({});
  });

  it('drops malformed records', () => {
    expect(sanitizeSyncData({ srs: { words: { bad: { box: 99 } } } }).srs.words).toEqual({});
  });
});
