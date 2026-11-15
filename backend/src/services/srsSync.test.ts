import assert from 'node:assert/strict';
import test from 'node:test';
import { emptySyncData, mergeSyncData, sanitizeSyncData } from './srsSync';

const withScore = (trainer: 'words' | 'verbs', score: Partial<ReturnType<typeof emptySyncData>['scores']['words']>) => {
  const data = emptySyncData();
  data.scores[trainer] = { ...data.scores[trainer], ...score };
  return data;
};

test('the score changed later wins, and a reset (zeros with a newer time) propagates', () => {
  const old = withScore('words', { correct: 8, total: 10, streak: 3, bestStreak: 5, updatedAt: 1000 });
  const fresh = withScore('words', { correct: 9, total: 11, streak: 4, bestStreak: 5, updatedAt: 2000 });
  assert.equal(mergeSyncData(old, fresh).scores.words.total, 11);
  assert.equal(mergeSyncData(fresh, old).scores.words.total, 11);

  const reset = withScore('words', { updatedAt: 3000 });
  assert.equal(mergeSyncData(fresh, reset).scores.words.total, 0);
});

test('on equal timestamps the score with more answers wins in either order', () => {
  const a = withScore('verbs', { correct: 1, total: 2, updatedAt: 0 });
  const b = withScore('verbs', { correct: 5, total: 9, updatedAt: 0 });
  assert.equal(mergeSyncData(a, b).scores.verbs.total, 9);
  assert.equal(mergeSyncData(b, a).scores.verbs.total, 9);
});

test('daily counter: same day keeps the maximum, a later day replaces an earlier one', () => {
  const a = emptySyncData();
  a.daily = { day: '2026-03-10', count: 4 };
  const b = emptySyncData();
  b.daily = { day: '2026-03-10', count: 7 };
  const next = emptySyncData();
  next.daily = { day: '2026-03-11', count: 1 };

  assert.deepEqual(mergeSyncData(a, b).daily, { day: '2026-03-10', count: 7 });
  assert.deepEqual(mergeSyncData(a, next).daily, { day: '2026-03-11', count: 1 });
  assert.deepEqual(mergeSyncData(next, a).daily, { day: '2026-03-11', count: 1 });
});

test('sanitizing clamps impossible scores and ignores junk', () => {
  const data = sanitizeSyncData({
    scores: { words: { correct: 50, total: 10, streak: 7, bestStreak: 2, updatedAt: 5 }, verbs: 'junk' },
    daily: { day: 'yesterday', count: 3 },
  });
  assert.deepEqual(data.scores.words, { correct: 10, total: 10, streak: 7, bestStreak: 7, updatedAt: 5 });
  assert.deepEqual(data.scores.verbs, emptySyncData().scores.verbs);
  assert.deepEqual(data.daily, { day: '', count: 0 });
});
