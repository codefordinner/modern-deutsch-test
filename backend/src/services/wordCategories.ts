import type { Category, Word } from '@prisma/client';
import { prisma } from '../db';

/**
 * A word belongs to one or more categories. The FIRST one is stored in `Word.categoryId` (the
 * "primary" category — no migration of old data needed), the others in the many-to-many
 * relation `extraCategories`. The API hides this split: it returns
 *   categories:  Category[]  (primary first)
 *   categoryIds: string[]
 * and still `categoryId` / `category` for the primary one.
 *
 * A word is ONE row, so it is one flash card in every trainer no matter how many categories it has.
 */
export const WORD_INCLUDE = { category: true, extraCategories: true } as const;

type WordWithCategories = Word & { category: Category; extraCategories: Category[] };

export function serializeWord<T extends WordWithCategories>(word: T) {
  const { extraCategories, ...rest } = word;
  const categories = [word.category, ...extraCategories.filter((c) => c.id !== word.category.id)];
  return { ...rest, categories, categoryIds: categories.map((c) => c.id) };
}

/**
 * Category ids from a request body: `categoryIds` (array, first = primary) or the legacy single
 * `categoryId`. Duplicates are dropped. null = nothing (usable) was sent.
 */
export function readCategoryIds(body: { categoryIds?: unknown; categoryId?: unknown } | undefined): string[] | null {
  const raw = Array.isArray(body?.categoryIds) ? body.categoryIds : typeof body?.categoryId === 'string' ? [body.categoryId] : null;
  if (!raw) return null;
  const ids = [...new Set(raw.filter((v): v is string => typeof v === 'string' && v.length > 0))];
  return ids.length > 0 ? ids : null;
}

export async function allCategoriesExist(ids: string[]): Promise<boolean> {
  return (await prisma.category.count({ where: { id: { in: ids } } })) === ids.length;
}
