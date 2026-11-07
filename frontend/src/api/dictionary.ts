import type { Category, Word, WordsPage } from '../types';
import { request } from './request';

export interface WordsQuery { categoryId?: string; search?: string; limit?: number }

export function getWords({ categoryId, search, limit }: WordsQuery = {}): Promise<WordsPage> {
  const params = new URLSearchParams();
  if (categoryId) params.set('categoryId', categoryId);
  if (search) params.set('search', search);
  if (limit) params.set('limit', String(limit));
  const query = params.toString();
  return request<WordsPage>(`/words${query ? `?${query}` : ''}`);
}

export const WORDS_PAGE_SIZE = 1000;
const MAX_WORD_PAGES = 50;

export async function getAllWords({ categoryId, search }: Omit<WordsQuery, 'limit'> = {}): Promise<WordsPage> {
  const params = new URLSearchParams();
  if (categoryId) params.set('categoryId', categoryId);
  if (search) params.set('search', search);
  params.set('limit', String(WORDS_PAGE_SIZE));

  const words: Word[] = [];
  let total = 0;
  for (let page = 1; page <= MAX_WORD_PAGES; page++) {
    params.set('page', String(page));
    const result = await request<WordsPage>(`/words?${params.toString()}`);
    total = result.total;
    words.push(...result.words);
    if (result.words.length === 0 || words.length >= total) break;
  }
  return { words, total, page: 1, limit: words.length };
}

export function getCategories(): Promise<Category[]> {
  return request<Category[]>('/categories');
}
