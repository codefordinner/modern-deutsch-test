import { useSyncExternalStore } from 'react';
import { localDayKey } from './srs';
import {
  hasAccountTrainerSettings,
  updateAccountDailyGoal,
  updateAccountDueOnly,
} from './trainerSettingsStore';

// Study preferences shared by every trainer, plus the "answers today" counter
// behind the daily goal. Persisted in localStorage; every mounted component
// follows changes through useSyncExternalStore (no context provider needed).
//
//  - dueOnly:   in SRS mode ask only cards whose review date has come (see srsDue.ts);
//  - dailyGoal: how many answers per day the learner aims for (0 = no goal).

export interface StudyPrefs {
  dueOnly: boolean;
  dailyGoal: number;
}

export const DEFAULT_STUDY_PREFS: StudyPrefs = { dueOnly: false, dailyGoal: 20 };
export const MAX_DAILY_GOAL = 1000;

const PREFS_KEY = 'app_study_prefs';
const DAILY_KEY = 'app_daily_progress';

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function sanitizeGoal(value: unknown): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(MAX_DAILY_GOAL, Math.max(0, n)) : DEFAULT_STUDY_PREFS.dailyGoal;
}

function loadPrefs(): StudyPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_STUDY_PREFS;
    const parsed = JSON.parse(raw) as Partial<StudyPrefs>;
    return {
      dueOnly: parsed.dueOnly === true,
      dailyGoal: parsed.dailyGoal === undefined ? DEFAULT_STUDY_PREFS.dailyGoal : sanitizeGoal(parsed.dailyGoal),
    };
  } catch {
    return DEFAULT_STUDY_PREFS;
  }
}

let prefs: StudyPrefs = loadPrefs();

export const getStudyPrefs = (): StudyPrefs => prefs;

export function setStudyPrefs(partial: Partial<StudyPrefs>): void {
  prefs = {
    dueOnly: partial.dueOnly ?? prefs.dueOnly,
    dailyGoal: partial.dailyGoal === undefined ? prefs.dailyGoal : sanitizeGoal(partial.dailyGoal),
  };
  if (hasAccountTrainerSettings()) {
    updateAccountDueOnly(prefs.dueOnly);
    updateAccountDailyGoal(prefs.dailyGoal);
    window.dispatchEvent(new Event('learner-account-setting-changed'));
  } else {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // Non-blocking: the setting just won't persist across reloads.
    }
  }
  notify();
}

/** Applies settings received from another device without touching the daily counter. */
export function applySyncedDailyGoal(dailyGoal: number): void {
  prefs = { ...prefs, dailyGoal: sanitizeGoal(dailyGoal) };
  if (!hasAccountTrainerSettings()) {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // Non-blocking
    }
  }
  notify();
}

export function applySyncedStudyPrefs(dailyGoal: number, dueOnly: boolean): void {
  prefs = { dailyGoal: sanitizeGoal(dailyGoal), dueOnly };
  if (!hasAccountTrainerSettings()) {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // Non-blocking
    }
  }
  notify();
}

export function resetAccountStudyPrefs(): void {
  prefs = { ...DEFAULT_STUDY_PREFS };
  notify();
}

export function useStudyPrefs(): [StudyPrefs, typeof setStudyPrefs] {
  const current = useSyncExternalStore(subscribe, getStudyPrefs, getStudyPrefs);
  return [current, setStudyPrefs];
}

// ---- Answers today ----------------------------------------------------------------

interface DailyProgress {
  day: string;
  count: number;
}

function loadDaily(): DailyProgress {
  const today = localDayKey(new Date());
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DailyProgress>;
      if (parsed.day === today && Number.isInteger(parsed.count) && (parsed.count as number) >= 0) {
        return { day: today, count: parsed.count as number };
      }
    }
  } catch {
    // fall through to a fresh day
  }
  return { day: today, count: 0 };
}

let daily: DailyProgress = loadDaily();

function persistDaily(): void {
  try {
    localStorage.setItem(DAILY_KEY, JSON.stringify(daily));
  } catch {
    // Non-blocking
  }
}

/** Answers given today (the counter starts over at local midnight). */
export function getDailyCount(): number {
  if (daily.day !== localDayKey(new Date())) daily = { day: localDayKey(new Date()), count: 0 };
  return daily.count;
}

/** Today's counter together with its day, for the cross-device sync. */
export function getDailyProgress(): { day: string; count: number } {
  const count = getDailyCount(); // rolls the day over first
  return { day: daily.day, count };
}

export function incrementDailyCount(): void {
  const count = getDailyCount() + 1;
  daily = { day: daily.day, count };
  persistDaily();
  notify();
}

/**
 * Applies "answers today" received from another device: only for the current local day and only
 * upwards (the counter never decreases), so answers given here are never lost.
 */
export function applySyncedDailyProgress(day: string, count: number, replace = false): void {
  if (replace) {
    daily = { day, count };
    persistDaily();
    notify();
    return;
  }
  if (day !== localDayKey(new Date())) return;
  if (count <= getDailyCount()) return;
  daily = { day, count };
  persistDaily();
  notify();
}

export function useDailyCount(): number {
  return useSyncExternalStore(subscribe, getDailyCount, getDailyCount);
}
