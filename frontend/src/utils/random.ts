/** Uniformly random integer in `[0, maxExclusive)`. */
export function randomInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

/** A uniformly random element, or `undefined` for an empty list. */
export function pickRandom<T>(items: readonly T[]): T | undefined {
  return items.length === 0 ? undefined : items[randomInt(items.length)];
}

/**
 * Fisher–Yates shuffle: every permutation is equally likely. Returns a new array.
 *
 * (`array.sort(() => Math.random() - 0.5)` is NOT a substitute: the comparator is
 * inconsistent, so the result is biased and depends on the engine's sort algorithm.)
 */
export function shuffle<T>(items: readonly T[]): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
