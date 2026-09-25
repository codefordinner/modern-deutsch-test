import { prisma } from '../db';
import { inferPartOfSpeech } from './partOfSpeech';
import type { PartOfSpeech } from './partOfSpeech';

const BACKFILL_CHUNK = 500; // stays well below SQLite's bound-variable limit

/**
 * Fills `partOfSpeech` for rows created before the column existed, using the
 * rules the frontend used to apply at runtime (form fields / "глагол" in the
 * category name), so nothing drops out of the verbs trainer after the upgrade.
 * Only touches rows where it is still NULL, so it is safe to run on every start.
 */
export async function backfillPartOfSpeech(): Promise<number> {
  const rows = await prisma.word.findMany({
    where: { partOfSpeech: null },
    select: { id: true, de: true, praeteritum: true, partizip2: true, category: { select: { name: true } } },
  });

  const idsByValue = new Map<PartOfSpeech, string[]>();
  for (const row of rows) {
    const value = inferPartOfSpeech({ ...row, categoryName: row.category.name });
    if (!value) continue;
    const ids = idsByValue.get(value) ?? [];
    ids.push(row.id);
    idsByValue.set(value, ids);
  }

  let updated = 0;
  for (const [value, ids] of idsByValue) {
    for (let i = 0; i < ids.length; i += BACKFILL_CHUNK) {
      const chunk = ids.slice(i, i + BACKFILL_CHUNK);
      const result = await prisma.word.updateMany({ where: { id: { in: chunk } }, data: { partOfSpeech: value } });
      updated += result.count;
    }
  }

  if (updated > 0) console.log(`[partOfSpeech] backfilled ${updated} word(s)`);
  return updated;
}
