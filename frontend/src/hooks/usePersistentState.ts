import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

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
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? defaultValue : sanitize(JSON.parse(raw));
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Non-blocking: the setting just won't persist across reloads.
    }
  }, [key, value]);

  return [value, setValue];
}

/** Sanitizer for a value that must be one of a fixed list of strings. */
export const oneOf =
  <T extends string>(allowed: readonly T[], fallback: T) =>
  (raw: unknown): T =>
    allowed.includes(raw as T) ? (raw as T) : fallback;

/** Sanitizer for a boolean field of a stored object. */
export const asBool = (raw: unknown, fallback: boolean): boolean => (typeof raw === 'boolean' ? raw : fallback);
