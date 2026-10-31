import { useSyncExternalStore } from 'react';

// The weights of the five Leitner boxes (how often a card from each box is asked).
// They are a server-wide setting edited in the admin panel; the app loads them on
// start (hooks/useSrsWeightsSync.ts) and keeps them in this tiny store, so the card
// picker (utils/srs.ts) and the SRS screens always see the current values. Until
// they are loaded (or when the server can't be reached) the defaults apply.
//
// Keep DEFAULT_SRS_BOX_WEIGHTS in sync with backend/src/services/srsSettings.ts.

export const SRS_WEIGHTS_BOX_COUNT = 5;
export const MAX_BOX_WEIGHT = 1000;

/** Index 0 = box 1 (new cards and mistakes) … index 4 = box 5 (learned). */
export const DEFAULT_SRS_BOX_WEIGHTS: readonly number[] = [60, 15, 10, 5, 10];

/** Five finite numbers in [0, MAX_BOX_WEIGHT] with at least one above zero; anything else → null. */
export function sanitizeWeights(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length !== SRS_WEIGHTS_BOX_COUNT) return null;
  if (!raw.every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_BOX_WEIGHT)) return null;
  const weights = raw as number[];
  return weights.some((v) => v > 0) ? [...weights] : null;
}

let current: readonly number[] = DEFAULT_SRS_BOX_WEIGHTS;
const listeners = new Set<() => void>();

const sameWeights = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

export const getSrsWeights = (): readonly number[] => current;

/** Applies weights from the server; invalid input falls back to the defaults. */
export function setSrsWeights(raw: unknown): void {
  const next = sanitizeWeights(raw) ?? DEFAULT_SRS_BOX_WEIGHTS;
  if (sameWeights(current, next)) return;
  current = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSrsWeights(): readonly number[] {
  return useSyncExternalStore(subscribe, getSrsWeights, getSrsWeights);
}
