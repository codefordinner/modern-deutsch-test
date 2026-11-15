import { prisma } from '../db';
import { DEFAULT_SRS_WEIGHTS, MAX_BOX_WEIGHT, SRS_BOX_COUNT, sanitizeWeights } from '@sprachfunke/shared';
export { DEFAULT_SRS_WEIGHTS, MAX_BOX_WEIGHT, SRS_BOX_COUNT, sanitizeWeights } from '@sprachfunke/shared';

/**
 * Relative weights of the five Leitner boxes: how often a card from box N is asked.
 * Stored as JSON under one key of the `Setting` table; no row = the defaults below.
 * Keep DEFAULT_WEIGHTS in sync with frontend/src/utils/srsWeights.ts.
 */
export const SRS_WEIGHTS_SETTING_KEY = 'srsBoxWeights';
export const SRS_PROMOTION_THRESHOLD_SETTING_KEY = 'srsPromotionThreshold';
export const DEFAULT_SRS_PROMOTION_THRESHOLD = 1;
export const MIN_SRS_PROMOTION_THRESHOLD = 1;
export const MAX_SRS_PROMOTION_THRESHOLD = 10;
export interface SrsWeightsState {
  weights: number[];
  promotionThreshold: number;
  /** true = nothing saved, the built-in defaults are in use. */
  isDefault: boolean;
}

export function sanitizePromotionThreshold(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) &&
    value >= MIN_SRS_PROMOTION_THRESHOLD && value <= MAX_SRS_PROMOTION_THRESHOLD ? value : null;
}

export async function readSrsWeights(): Promise<SrsWeightsState> {
  const row = await prisma.setting.findUnique({ where: { key: SRS_WEIGHTS_SETTING_KEY } });
  const thresholdRow = await prisma.setting.findUnique({ where: { key: SRS_PROMOTION_THRESHOLD_SETTING_KEY } });
  const threshold = thresholdRow ? sanitizePromotionThreshold(Number(thresholdRow.value)) : null;
  if (row) {
    try {
      const clean = sanitizeWeights(JSON.parse(row.value));
      if (clean) return {
        weights: clean,
        promotionThreshold: threshold ?? DEFAULT_SRS_PROMOTION_THRESHOLD,
        isDefault: false,
      };
    } catch {
      // corrupted value: fall back to the defaults
    }
  }
  return {
    weights: [...DEFAULT_SRS_WEIGHTS],
    promotionThreshold: threshold ?? DEFAULT_SRS_PROMOTION_THRESHOLD,
    isDefault: !row && !thresholdRow,
  };
}

export async function writeSrsWeights(weights: number[], promotionThreshold: number): Promise<void> {
  await prisma.$transaction([
    prisma.setting.upsert({
      where: { key: SRS_WEIGHTS_SETTING_KEY },
      create: { key: SRS_WEIGHTS_SETTING_KEY, value: JSON.stringify(weights) },
      update: { value: JSON.stringify(weights) },
    }),
    prisma.setting.upsert({
      where: { key: SRS_PROMOTION_THRESHOLD_SETTING_KEY },
      create: { key: SRS_PROMOTION_THRESHOLD_SETTING_KEY, value: String(promotionThreshold) },
      update: { value: String(promotionThreshold) },
    }),
  ]);
}

export async function resetSrsWeights(): Promise<void> {
  await prisma.setting.deleteMany({ where: { key: { in: [SRS_WEIGHTS_SETTING_KEY, SRS_PROMOTION_THRESHOLD_SETTING_KEY] } } });
}
