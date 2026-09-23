import { useCallback, useRef, useState } from 'react';
import { pickCardBySRS, updateSRS } from '../utils/srs';
import type { SRSMap } from '../utils/srs';

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return (JSON.parse(raw) as T) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Non-blocking: progress just won't persist across reloads.
  }
}

/**
 * Shared SRS (Leitner) state for a trainer: the "use SRS" flag and the
 * per-card progress map, both persisted in localStorage under
 * `${storagePrefix}_use_srs` / `${storagePrefix}_srs_state`.
 *
 * - `pickCard` chooses the next card (SRS-weighted when enabled, uniformly
 *   random otherwise) and always reads the latest progress, so it is safe
 *   to call from memoised callbacks.
 * - `recordAnswer` updates and persists progress; it does nothing while SRS is off.
 */
export function useSRSProgress(storagePrefix: string) {
  const useSrsKey = `${storagePrefix}_use_srs`;
  const stateKey = `${storagePrefix}_srs_state`;

  const [useSRS, setUseSRSState] = useState<boolean>(() => readJSON(useSrsKey, true));
  const [srsMap, setSrsMap] = useState<SRSMap>(() => readJSON<SRSMap>(stateKey, {}));

  const srsMapRef = useRef(srsMap);
  srsMapRef.current = srsMap;

  const setUseSRS = useCallback(
    (value: boolean) => {
      setUseSRSState(value);
      writeJSON(useSrsKey, value);
    },
    [useSrsKey]
  );

  const recordAnswer = useCallback(
    (key: string, isCorrect: boolean) => {
      if (!useSRS) return;
      const next = updateSRS(srsMapRef.current, key, isCorrect);
      srsMapRef.current = next;
      setSrsMap(next);
      writeJSON(stateKey, next);
    },
    [useSRS, stateKey]
  );

  const resetSRS = useCallback(() => {
    srsMapRef.current = {};
    setSrsMap({});
    try {
      localStorage.removeItem(stateKey);
    } catch {
      // ignore
    }
  }, [stateKey]);

  const pickCard = useCallback(
    <T>(items: T[], keyFn: (item: T) => string): T | undefined => {
      if (items.length === 0) return undefined;
      if (!useSRS) return items[Math.floor(Math.random() * items.length)];
      return pickCardBySRS(items, srsMapRef.current, keyFn);
    },
    [useSRS]
  );

  return { useSRS, setUseSRS, srsMap, recordAnswer, resetSRS, pickCard };
}
