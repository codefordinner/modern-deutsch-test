import { prisma } from '../db';

/**
 * Relative weights of the five Leitner boxes: how often a card from box N is asked.
 * Stored as JSON under one key of the `Setting` table; no row = the defaults below.
 * Keep DEFAULT_WEIGHTS in sync with frontend/src/utils/srsWeights.ts.
 */
export const SRS_WEIGHTS_SETTING_KEY = 'srsBoxWeights';
export const DEFAULT_SRS_WEIGHTS: readonly number[] = [60, 15, 10, 5, 10];
export const SRS_BOX_COUNT = 5;
export const MAX_BOX_WEIGHT = 1000;

/** Five finite numbers in [0, MAX_BOX_WEIGHT], at least one above zero; anything else → null. */
export function sanitizeWeights(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length !== SRS_BOX_COUNT) return null;
  if (!raw.every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_BOX_WEIGHT)) return null;
  const weights = raw as number[];
  return weights.some((v) => v > 0) ? [...weights] : null;
}

export interface SrsWeightsState {
  weights: number[];
  /** true = nothing saved, the built-in defaults are in use. */
  isDefault: boolean;
}

export async function readSrsWeights(): Promise<SrsWeightsState> {
  const row = await prisma.setting.findUnique({ where: { key: SRS_WEIGHTS_SETTING_KEY } });
  if (row) {
    try {
      const clean = sanitizeWeights(JSON.parse(row.value));
      if (clean) return { weights: clean, isDefault: false };
    } catch {
      // corrupted value: fall back to the defaults
    }
  }
  return { weights: [...DEFAULT_SRS_WEIGHTS], isDefault: true };
}

export async function writeSrsWeights(weights: number[]): Promise<void> {
  const value = JSON.stringify(weights);
  await prisma.setting.upsert({
    where: { key: SRS_WEIGHTS_SETTING_KEY },
    create: { key: SRS_WEIGHTS_SETTING_KEY, value },
    update: { value },
  });
}

export async function resetSrsWeights(): Promise<void> {
  await prisma.setting.deleteMany({ where: { key: SRS_WEIGHTS_SETTING_KEY } });
}
