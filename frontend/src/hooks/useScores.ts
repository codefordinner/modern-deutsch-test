import { useCallback, useEffect, useState } from 'react';
import type { ScoreState } from '../types';
import { SCORED_TABS, type ScoredTab } from '../config/tabs';
import { incrementDailyCount } from '../utils/studyPrefs';
import { SRS_SYNCED_EVENT, scheduleSync } from '../utils/srsSync';

/** Trainers that keep a score (the admin panel has none). */
export type Scores = Record<ScoredTab, ScoreState>;

const STORAGE_KEY = 'app_scores';
export const emptyScore = (): ScoreState => ({ correct: 0, total: 0, streak: 0, bestStreak: 0 });

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;

function parseScore(value: unknown): ScoreState {
  const v = (value ?? {}) as Partial<Record<keyof ScoreState, unknown>>;
  const score: ScoreState = {
    correct: isCount(v.correct) ? v.correct : 0,
    total: isCount(v.total) ? v.total : 0,
    streak: isCount(v.streak) ? v.streak : 0,
    bestStreak: isCount(v.bestStreak) ? v.bestStreak : 0,
  };
  // Guard against a hand-edited / corrupted value producing "5 / 3" or a streak above the best one.
  score.correct = Math.min(score.correct, score.total);
  score.bestStreak = Math.max(score.bestStreak, score.streak);
  // The change time decides which device's score wins in the sync; keep it.
  if (isCount(v.updatedAt) && v.updatedAt > 0) score.updatedAt = v.updatedAt;
  return score;
}

function loadScores(): Scores {
  let stored: Record<string, unknown> = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) stored = JSON.parse(raw) ?? {};
  } catch {
    // Unreadable or unavailable storage: start from zero.
  }
  return Object.fromEntries(SCORED_TABS.map((tab) => [tab, parseScore(stored[tab])])) as Scores;
}

/**
 * Per-trainer score (correct / total / streak / best streak), kept in
 * localStorage so a page reload doesn't wipe it. "Reset" clears one trainer.
 * Every recorded answer also counts towards the daily goal (utils/studyPrefs.ts).
 *
 * When signed in with Telegram, the score is shared between devices (utils/srsSync.ts): every change is
 * stamped with `updatedAt`, pushed shortly after, and a newer score from another device is picked
 * up through SRS_SYNCED_EVENT. The score that changed last wins (a reset is a score of zeros).
 */
export function useScores() {
  const [scores, setScores] = useState<Scores>(loadScores);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
    } catch {
      // Non-blocking: the score just won't survive a reload.
    }
  }, [scores]);

  // A score (or the answers-today counter) arrived from another device.
  useEffect(() => {
    const onSynced = () => setScores(loadScores());
    window.addEventListener(SRS_SYNCED_EVENT, onSynced);
    return () => window.removeEventListener(SRS_SYNCED_EVENT, onSynced);
  }, []);

  const recordAnswer = useCallback((tab: ScoredTab, isCorrect: boolean) => {
    incrementDailyCount();
    setScores((prev) => {
      const current = prev[tab];
      const streak = isCorrect ? current.streak + 1 : 0;
      return {
        ...prev,
        [tab]: {
          correct: current.correct + (isCorrect ? 1 : 0),
          total: current.total + 1,
          streak,
          bestStreak: Math.max(current.bestStreak, streak),
          updatedAt: Date.now(),
        },
      };
    });
    scheduleSync();
  }, []);

  const resetScore = useCallback((tab: ScoredTab) => {
    setScores((prev) => ({ ...prev, [tab]: { ...emptyScore(), updatedAt: Date.now() } }));
    scheduleSync();
  }, []);

  return { scores, recordAnswer, resetScore };
}
