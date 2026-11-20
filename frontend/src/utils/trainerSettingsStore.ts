import type { SyncSettings, SrsTrainer } from '../types';

const ACCOUNT_KEYS = [
  'words_settings', 'articles_category', 'numbers_direction', 'numbers_range',
  'verbs_mode', 'verbs_praesens_submode', 'time_display_mode', 'time_step_mode',
  'words_use_srs', 'verbs_use_srs', 'articles_use_srs',
] as const;

let settings: SyncSettings | null = null;
let settingsUserId: string | null = null;

export const hasAccountTrainerSettings = (): boolean => settings !== null;
export const getAccountTrainerSettings = (): SyncSettings | null => settings;

export function getAccountSettingValue(key: string): unknown {
  if (!settings) return undefined;
  const prefs = settings.trainerPrefs;
  switch (key) {
    case 'words_settings':
      return {
        ...prefs.words,
        selectedCats: settings.wordsCategories,
      };
    case 'articles_category': return settings.articlesCategories;
    case 'numbers_direction': return prefs.numbers.directionMode;
    case 'numbers_range': return prefs.numbers.range;
    case 'verbs_mode': return prefs.verbs.mode;
    case 'verbs_praesens_submode': return prefs.verbs.praesensSubMode;
    case 'time_display_mode': return prefs.time.displayMode;
    case 'time_step_mode': return prefs.time.stepMode;
    case 'words_use_srs': return prefs.srs.words;
    case 'verbs_use_srs': return prefs.srs.verbs;
    case 'articles_use_srs': return prefs.srs.articles;
    default: return undefined;
  }
}

export function setAccountTrainerSettings(next: SyncSettings, userId: string): void {
  settings = next;
  settingsUserId = userId;
  window.dispatchEvent(new CustomEvent('app-storage-updated', {
    detail: { keys: [...ACCOUNT_KEYS] },
  }));
}

export function clearAccountTrainerSettings(userId?: string): void {
  if (!settings || (userId && settingsUserId !== userId)) return;
  settings = null;
  settingsUserId = null;
  window.dispatchEvent(new CustomEvent('app-storage-updated', {
    detail: { keys: [...ACCOUNT_KEYS] },
  }));
}

export function updateAccountDueOnly(value: boolean): void {
  if (!settings) return;
  const timestamp = Date.now();
  settings = {
    ...settings,
    updatedAt: timestamp,
    trainerPrefsUpdatedAt: timestamp,
    trainerPrefs: {
      ...settings.trainerPrefs,
      srs: { ...settings.trainerPrefs.srs, dueOnly: value },
    },
  };
}

export function updateAccountDailyGoal(value: number): void {
  if (!settings) return;
  const timestamp = Date.now();
  settings = { ...settings, dailyGoal: value, updatedAt: timestamp, trainerPrefsUpdatedAt: timestamp };
}

export function updateAccountSetting(key: string, value: unknown): void {
  if (!settings) return;
  const prefs = settings.trainerPrefs;
  switch (key) {
    case 'words_settings': {
      const raw = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
      prefs.words = {
        directionMode: raw.directionMode as typeof prefs.words.directionMode,
        requireArticle: raw.requireArticle as boolean,
        enableBase: raw.enableBase as boolean,
        enablePlural: raw.enablePlural as boolean,
        enableFeminine: raw.enableFeminine as boolean,
      };
      if (Array.isArray(raw.selectedCats)) settings.wordsCategories = raw.selectedCats.filter((item): item is string => typeof item === 'string');
      break;
    }
    case 'articles_category':
      if (Array.isArray(value)) settings.articlesCategories = value.filter((item): item is string => typeof item === 'string');
      break;
    case 'numbers_direction': prefs.numbers.directionMode = value as typeof prefs.numbers.directionMode; break;
    case 'numbers_range': prefs.numbers.range = value as typeof prefs.numbers.range; break;
    case 'verbs_mode': prefs.verbs.mode = value as typeof prefs.verbs.mode; break;
    case 'verbs_praesens_submode': prefs.verbs.praesensSubMode = value as typeof prefs.verbs.praesensSubMode; break;
    case 'time_display_mode': prefs.time.displayMode = value as typeof prefs.time.displayMode; break;
    case 'time_step_mode': prefs.time.stepMode = value as typeof prefs.time.stepMode; break;
    case 'words_use_srs':
    case 'verbs_use_srs':
    case 'articles_use_srs': {
      const trainer = key.replace('_use_srs', '') as SrsTrainer;
      prefs.srs[trainer] = value === true;
      break;
    }
    default: return;
  }
  const timestamp = Date.now();
  settings = { ...settings, updatedAt: timestamp, trainerPrefsUpdatedAt: timestamp };
}

export function clearLocalAccountSettings(): void {
  try {
    for (const key of ACCOUNT_KEYS) localStorage.removeItem(key);
  } catch {
    // The server profile remains authoritative when browser storage is unavailable.
  }
}
