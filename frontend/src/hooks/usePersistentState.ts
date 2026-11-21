import { useCallback, useSyncExternalStore } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { markSyncSettingsChanged } from '../utils/srsSync';
import { getAccountSettingValue, hasAccountTrainerSettings, readDeviceSetting, refreshDeviceSetting, updateAccountSetting, writeDeviceSetting } from '../utils/trainerSettingsStore';

const ACCOUNT_SETTING_KEYS = new Set([
  'words_settings', 'numbers_direction', 'numbers_range', 'verbs_mode',
  'verbs_praesens_submode', 'time_display_mode', 'time_step_mode', 'articles_category',
]);
const values = new Map<string, unknown>();
const listeners = new Map<string, Set<() => void>>();

function notify(key: string): void {
  listeners.get(key)?.forEach((listener) => listener());
}

/**
 * One external settings store backed by the learner profile or device storage.
 * Stored values are run through `sanitize` first:
 * anything missing, corrupted or from an older version falls back to defaults
 * instead of breaking the trainer. Every storage access is in try/catch.
 *
 * Learner settings are immutable account-store entries; device-only settings
 * are persisted through the same store API.
 */
export function usePersistentState<T>(
  key: string,
  defaultValue: T,
  sanitize: (raw: unknown) => T
): [T, Dispatch<SetStateAction<T>>] {
  const isAccountSetting = ACCOUNT_SETTING_KEYS.has(key);
  const readCurrent = useCallback((): T => {
    if (isAccountSetting) return hasAccountTrainerSettings() ? sanitize(getAccountSettingValue(key)) : defaultValue;
    return readDeviceSetting(key, defaultValue, sanitize);
  }, [defaultValue, isAccountSetting, key, sanitize]);
  const getSnapshot = useCallback((): T => {
    if (!values.has(key)) values.set(key, readCurrent());
    return values.get(key) as T;
  }, [key, readCurrent]);
  const subscribe = useCallback((listener: () => void) => {
    const keyListeners = listeners.get(key) ?? new Set<() => void>();
    keyListeners.add(listener);
    listeners.set(key, keyListeners);
    const onSynced = (event: Event) => {
      const keys = (event as CustomEvent<{ keys?: unknown }>).detail?.keys;
      if (Array.isArray(keys) && !keys.includes(key)) return;
      try {
        const next = isAccountSetting
          ? readCurrent()
          : refreshDeviceSetting(key, defaultValue, sanitize);
        if (JSON.stringify(values.get(key)) === JSON.stringify(next)) return;
        values.set(key, next);
        notify(key);
      } catch {
        // ignore unavailable or malformed storage
      }
    };
    window.addEventListener('app-storage-updated', onSynced);
    return () => {
      keyListeners.delete(listener);
      if (keyListeners.size === 0) listeners.delete(key);
      window.removeEventListener('app-storage-updated', onSynced);
    };
  }, [defaultValue, isAccountSetting, key, readCurrent, sanitize]);
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setPersistentValue: Dispatch<SetStateAction<T>> = useCallback((action) => {
    const previous = getSnapshot();
    const next = typeof action === 'function' ? (action as (previous: T) => T)(previous) : action;
    values.set(key, next);
    if (isAccountSetting) {
      if (hasAccountTrainerSettings()) updateAccountSetting(key, next);
      markSyncSettingsChanged();
    } else {
      writeDeviceSetting(key, next);
    }
    notify(key);
  }, [getSnapshot, isAccountSetting, key]);
  return [value, setPersistentValue];
}

/** Sanitizer for a value that must be one of a fixed list of strings. */
export const oneOf =
  <T extends string>(allowed: readonly T[], fallback: T) =>
  (raw: unknown): T =>
    allowed.includes(raw as T) ? (raw as T) : fallback;

/** Sanitizer for a boolean field of a stored object. */
export const asBool = (raw: unknown, fallback: boolean): boolean => (typeof raw === 'boolean' ? raw : fallback);
