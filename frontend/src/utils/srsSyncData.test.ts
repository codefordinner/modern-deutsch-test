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

  it('sanitizes and syncs account-owned trainer preferences', () => {
    const data = sanitizeSyncData({
      settings: {
        updatedAt: 12,
        trainerPrefs: {
          words: { directionMode: 'de_to_ru', enablePlural: false },
          numbers: { directionMode: 'mixed', range: { min: 10, max: 1000 } },
          verbs: { mode: 'praesens', praesensSubMode: 'form_to_infinitive' },
          time: { displayMode: 'both', stepMode: '5min' },
          srs: { words: false },
        },
      },
    });
    expect(data.settings.trainerPrefs).toMatchObject({
      words: { directionMode: 'de_to_ru', enablePlural: false, enableBase: true },
      numbers: { directionMode: 'mixed', range: { min: 10, max: 1000 } },
      verbs: { mode: 'praesens', praesensSubMode: 'form_to_infinitive' },
      time: { displayMode: 'both', stepMode: '5min' },
      srs: { words: false, verbs: true, articles: true },
    });
    expect(mergeSyncData(data, emptySyncData()).settings.trainerPrefs).toEqual(data.settings.trainerPrefs);
  });
});

describe('score and daily counter sync', () => {
  const withScore = (score: Partial<ReturnType<typeof emptySyncData>['scores']['words']>) => {
    const data = emptySyncData();
    data.scores.words = { ...data.scores.words, ...score };
    return data;
  };

  it('takes the score that changed later, including a reset to zero', () => {
    const old = withScore({ correct: 8, total: 10, streak: 3, bestStreak: 5, updatedAt: 1000 });
    const fresh = withScore({ correct: 9, total: 11, streak: 4, bestStreak: 5, updatedAt: 2000 });
    expect(mergeSyncData(old, fresh).scores.words.total).toBe(11);
    expect(mergeSyncData(fresh, old).scores.words.total).toBe(11);
    expect(mergeSyncData(fresh, withScore({ updatedAt: 3000 })).scores.words.total).toBe(0);
  });

  it('on equal timestamps the score with more answers wins in either order', () => {
    const a = withScore({ correct: 1, total: 2 });
    const b = withScore({ correct: 5, total: 9 });
    expect(mergeSyncData(a, b).scores.words.total).toBe(9);
    expect(mergeSyncData(b, a).scores.words.total).toBe(9);
  });

  it('daily counter: same day keeps the maximum, a later day wins', () => {
    const a = emptySyncData();
    a.daily = { day: '2026-03-10', count: 4 };
    const b = emptySyncData();
    b.daily = { day: '2026-03-10', count: 7 };
    const next = emptySyncData();
    next.daily = { day: '2026-03-11', count: 1 };
    expect(mergeSyncData(a, b).daily).toEqual({ day: '2026-03-10', count: 7 });
    expect(mergeSyncData(next, a).daily).toEqual({ day: '2026-03-11', count: 1 });
  });

  it('clamps impossible scores and ignores junk', () => {
    const data = sanitizeSyncData({
      scores: { words: { correct: 50, total: 10, streak: 7, bestStreak: 2, updatedAt: 5 }, verbs: 'junk' },
      daily: { day: 'yesterday', count: 3 },
    });
    expect(data.scores.words).toEqual({ correct: 10, total: 10, streak: 7, bestStreak: 7, updatedAt: 5 });
    expect(data.scores.verbs).toEqual(emptySyncData().scores.verbs);
    expect(data.daily).toEqual({ day: '', count: 0 });
  });
});
