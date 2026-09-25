import { useCallback, useEffect, useState } from 'react';
import type { ScoreState } from '../types';

/** Trainers that keep a score (the admin panel has none). */
export type ScoredTab = 'numbers' | 'words' | 'verbs' | 'time';

export type Scores = Record<ScoredTab, ScoreState>;

const STORAGE_KEY = 'app_scores';
const SCORED_TABS: readonly ScoredTab[] = ['numbers', 'words', 'verbs', 'time'];

export const emptyScore = (): ScoreState => ({ correct: 0, total: 0, streak: 0, bestStreak: 0 });

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;

function parseScore(value: unknown): ScoreState {
  const v = (value ?? {}) as Partial<Record<keyof ScoreState, unknown>>;
  const score = {
    correct: isCount(v.correct) ? v.correct : 0,
    total: isCount(v.total) ? v.total : 0,
    streak: isCount(v.streak) ? v.streak : 0,
    bestStreak: isCount(v.bestStreak) ? v.bestStreak : 0,
  };
  // Guard against a hand-edited / corrupted value producing "5 / 3" or a streak above the best one.
  score.correct = Math.min(score.correct, score.total);
  score.bestStreak = Math.max(score.bestStreak, score.streak);
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

  const recordAnswer = useCallback((tab: ScoredTab, isCorrect: boolean) => {
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
        },
      };
    });
  }, []);

  const resetScore = useCallback((tab: ScoredTab) => {
    setScores((prev) => ({ ...prev, [tab]: emptyScore() }));
  }, []);

  return { scores, recordAnswer, resetScore };
}
