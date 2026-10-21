import { useCallback, useRef, useState } from 'react';
import { pickCardBySRS, updateSRS } from '../utils/srs';
import type { SRSMap } from '../utils/srs';
import { isDue } from '../utils/srsDue';
import { useStudyPrefs } from '../utils/studyPrefs';
import { pickRandom } from '../utils/random';

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
 * - `pickCard` chooses the next card (box-weighted when SRS is on, uniformly
 *   random otherwise), never repeats the previous card straight away when
 *   there is a choice, and always reads the latest progress, so it is safe
 *   to call from memoised callbacks.
 *   With SRS on and the global "only cards to review" preference set, only due
 *   cards (see utils/srsDue.ts) are considered; when none is due it returns
 *   `undefined` — the trainer then shows its "all done for today" state.
 *   `pickCard` changes identity when that preference changes, which makes the
 *   trainers deal a fresh card.
 * - `recordAnswer` updates and persists progress; it does nothing while SRS is off.
 */
export function useSRSProgress(storagePrefix: string) {
  const useSrsKey = `${storagePrefix}_use_srs`;
  const stateKey = `${storagePrefix}_srs_state`;

  const [useSRS, setUseSRSState] = useState<boolean>(() => readJSON(useSrsKey, true));
  const [srsMap, setSrsMap] = useState<SRSMap>(() => readJSON<SRSMap>(stateKey, {}));
  const [{ dueOnly }] = useStudyPrefs();

  const srsMapRef = useRef(srsMap);
  srsMapRef.current = srsMap;

  const lastKeyRef = useRef<string | undefined>(undefined);

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
      let pool = items;
      if (useSRS && dueOnly) {
        const now = Date.now();
        pool = items.filter((item) => isDue(srsMapRef.current[keyFn(item)], now));
      }
      if (pool.length === 0) return undefined;

      const excludeKey = lastKeyRef.current;
      let picked: T | undefined;
      if (useSRS) {
        picked = pickCardBySRS(pool, srsMapRef.current, keyFn, { excludeKey });
      } else {
        const others = excludeKey !== undefined ? pool.filter((item) => keyFn(item) !== excludeKey) : pool;
        picked = pickRandom(others.length > 0 ? others : pool);
      }

      if (picked !== undefined) lastKeyRef.current = keyFn(picked);
      return picked;
    },
    [useSRS, dueOnly]
  );

  return { useSRS, setUseSRS, srsMap, recordAnswer, resetSRS, pickCard };
}
