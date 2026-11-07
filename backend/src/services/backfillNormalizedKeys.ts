import { prisma } from '../db';

const normalize = (value: string): string => value.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();

/** Fills nullable normalized columns without breaking an existing database that contains duplicates. */
export async function backfillNormalizedKeys(): Promise<void> {
  const [words, categories] = await Promise.all([
    prisma.word.findMany({ where: { normalizedDe: null }, select: { id: true, de: true } }),
    prisma.category.findMany({ where: { normalizedName: null }, select: { id: true, name: true } }),
  ]);
  const wordKeys = new Map<string, string>();
  for (const word of words) {
    const key = normalize(word.de);
    if (wordKeys.has(key)) continue; // Leave legacy duplicates for the admin merge tool.
    wordKeys.set(key, word.id);
    await prisma.word.update({ where: { id: word.id }, data: { normalizedDe: key } });
  }
  const categoryKeys = new Map<string, string>();
  for (const category of categories) {
    const key = normalize(category.name);
    if (categoryKeys.has(key)) continue;
    categoryKeys.set(key, category.id);
    await prisma.category.update({ where: { id: category.id }, data: { normalizedName: key } });
  }
}
