import { useCallback, useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { markSyncSettingsChanged } from '../utils/srsSync';
import { getAccountSettingValue, hasAccountTrainerSettings, updateAccountSetting } from '../utils/trainerSettingsStore';

const ACCOUNT_SETTING_KEYS = new Set([
  'words_settings', 'numbers_direction', 'numbers_range', 'verbs_mode',
  'verbs_praesens_submode', 'time_display_mode', 'time_step_mode', 'articles_category',
]);

/**
 * `useState` whose value lives in localStorage, so a setting survives a reload
 * and a visit weeks later. The stored value is run through `sanitize` first:
 * anything missing, corrupted or from an older version falls back to defaults
 * instead of breaking the trainer. Every storage access is in try/catch.
 *
 * Add the key to BACKUP_KEYS (utils/progressBackup.ts) — it belongs to the learner.
 */
export function usePersistentState<T>(
  key: string,
  defaultValue: T,
  sanitize: (raw: unknown) => T
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (ACCOUNT_SETTING_KEYS.has(key) && hasAccountTrainerSettings()) {
      return sanitize(getAccountSettingValue(key));
    }
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? defaultValue : sanitize(JSON.parse(raw));
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    if (ACCOUNT_SETTING_KEYS.has(key) && hasAccountTrainerSettings()) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Non-blocking: the setting just won't persist across reloads.
    }
  }, [key, value]);

  useEffect(() => {
    const onSynced = (event: Event) => {
      const keys = (event as CustomEvent<{ keys?: unknown }>).detail?.keys;
      if (Array.isArray(keys) && !keys.includes(key)) return;
      try {
        if (ACCOUNT_SETTING_KEYS.has(key) && hasAccountTrainerSettings()) {
          const next = sanitize(getAccountSettingValue(key));
          setValue((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
          return;
        }
        const raw = localStorage.getItem(key);
        if (raw !== null) {
          const next = sanitize(JSON.parse(raw));
          setValue((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
        } else if (ACCOUNT_SETTING_KEYS.has(key)) {
          setValue((previous) => JSON.stringify(previous) === JSON.stringify(defaultValue) ? previous : defaultValue);
        }
      } catch {
        // ignore unavailable or malformed storage
      }
    };
    window.addEventListener('app-storage-updated', onSynced);
    return () => window.removeEventListener('app-storage-updated', onSynced);
  }, [key, sanitize, defaultValue]);

  const setPersistentValue: Dispatch<SetStateAction<T>> = useCallback((action) => {
    const next = typeof action === 'function' ? (action as (previous: T) => T)(value) : action;
    setValue(next);
    if (ACCOUNT_SETTING_KEYS.has(key)) {
      if (hasAccountTrainerSettings()) updateAccountSetting(key, next);
      markSyncSettingsChanged();
    }
  }, [key, value]);
  return [value, setPersistentValue];
}

/** Sanitizer for a value that must be one of a fixed list of strings. */
export const oneOf =
  <T extends string>(allowed: readonly T[], fallback: T) =>
  (raw: unknown): T =>
    allowed.includes(raw as T) ? (raw as T) : fallback;

/** Sanitizer for a boolean field of a stored object. */
export const asBool = (raw: unknown, fallback: boolean): boolean => (typeof raw === 'boolean' ? raw : fallback);
