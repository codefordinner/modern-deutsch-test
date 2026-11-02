import type { Category, Word } from '../types';

// A word can belong to several categories but is still ONE dictionary entry, so it is one card in
// every trainer. Use these helpers instead of reading `word.categoryId` (that is only the primary
// category). They also work with an older cached API response that has no `categoryIds`.

/** Ids of all the word's categories (the primary one first). */
export function wordCategoryIds(word: Word): string[] {
  return word.categoryIds && word.categoryIds.length > 0 ? word.categoryIds : [word.categoryId];
}

/** All the word's categories (the primary one first). */
export function wordCategories(word: Word): Category[] {
  if (word.categories && word.categories.length > 0) return word.categories;
  return word.category ? [word.category] : [];
}

export const wordInCategory = (word: Word, categoryId: string): boolean => wordCategoryIds(word).includes(categoryId);

/** Whether the word is in at least one of the selected categories (`'all'` selects everything). */
export const wordInAnyCategory = (word: Word, selected: readonly string[]): boolean =>
  selected.includes('all') || wordCategoryIds(word).some((id) => selected.includes(id));

/** "☕ Повседневные слова, 👥 Семья и люди" */
export const formatCategories = (word: Word, fallbackIcon = '📌'): string =>
  wordCategories(word)
    .map((c) => `${c.icon || fallbackIcon} ${c.name}`)
    .join(', ');
