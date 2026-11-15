import { useSyncExternalStore } from 'react';
import { DEFAULT_SRS_WEIGHTS, MAX_BOX_WEIGHT as SHARED_MAX_BOX_WEIGHT, SRS_BOX_COUNT, sanitizeWeights as sanitizeSharedWeights } from '@sprachfunke/shared';

// The weights of the five Leitner boxes (how often a card from each box is asked).
// They are a server-wide setting edited in the admin panel; the app loads them on
// start (hooks/useSrsWeightsSync.ts) and keeps them in this tiny store, so the card
// picker (utils/srs.ts) and the SRS screens always see the current values. Until
// they are loaded (or when the server can't be reached) the defaults apply.
//
// Keep DEFAULT_SRS_BOX_WEIGHTS in sync with backend/src/services/srsSettings.ts.

export const SRS_WEIGHTS_BOX_COUNT = SRS_BOX_COUNT;
export const MAX_BOX_WEIGHT = SHARED_MAX_BOX_WEIGHT;

/** Index 0 = box 1 (new cards and mistakes) … index 4 = box 5 (learned). */
export const DEFAULT_SRS_BOX_WEIGHTS: readonly number[] = DEFAULT_SRS_WEIGHTS;

/** Five finite numbers in [0, MAX_BOX_WEIGHT] with at least one above zero; anything else → null. */
export function sanitizeWeights(raw: unknown): number[] | null {
  return sanitizeSharedWeights(raw);
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
