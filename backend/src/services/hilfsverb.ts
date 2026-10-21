import { prisma } from '../db';

/**
 * Canonical values of `Word.hilfsverb` are exactly 'haben' | 'sein' — that is
 * what the admin form, the import and the verbs trainer compare against.
 * Older data (and the old seed) used the conjugated forms 'hat' / 'ist'.
 */
export type Hilfsverb = 'haben' | 'sein';

export function normalizeHilfsverb(value: unknown): Hilfsverb | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  if (v === 'sein' || v === 'ist') return 'sein';
  if (v === 'haben' || v === 'hat') return 'haben';
  return null;
}

/**
 * Rewrites legacy values ('ist', 'hat', 'Sein', ' haben ' …) already stored in
 * the database to the canonical ones. Rows that are already canonical, empty
 * or unrecognisable are left alone, so it is safe to run on every start.
 */
export async function normalizeStoredHilfsverb(): Promise<number> {
  const rows = await prisma.word.findMany({
    where: { hilfsverb: { notIn: ['haben', 'sein'] } },
    select: { id: true, hilfsverb: true },
  });

  const idsByValue = new Map<Hilfsverb, string[]>();
  for (const row of rows) {
    if (!row.hilfsverb) continue; // NULL stays NULL (the trainer falls back to 'haben')
    const value = normalizeHilfsverb(row.hilfsverb);
    if (!value) continue;
    const ids = idsByValue.get(value) ?? [];
    ids.push(row.id);
    idsByValue.set(value, ids);
  }

  let updated = 0;
  for (const [value, ids] of idsByValue) {
    const result = await prisma.word.updateMany({ where: { id: { in: ids } }, data: { hilfsverb: value } });
    updated += result.count;
  }

  if (updated > 0) console.log(`[hilfsverb] normalized ${updated} word(s)`);
  return updated;
}
