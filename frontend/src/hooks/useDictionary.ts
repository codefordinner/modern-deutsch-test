import { useMemo } from 'react';
import { getCategories, getWords } from '../api/client';
import type { WordsQuery } from '../api/client';
import { useQuery } from '../api/queryCache';
import type { Category, Word } from '../types';
import { isVerb } from '../utils/partOfSpeech';

// Every screen that needs the dictionary goes through these hooks, so the word
// list is requested once and shared between the four trainers and the admin panel.

/** The whole dictionary (the server caps a page at 1000 words). */
export const ALL_WORDS_QUERY: WordsQuery = { limit: 1000 };

export const WORDS_KEY = 'words';
export const CATEGORIES_KEY = 'categories';

const EMPTY_WORDS: Word[] = [];
const EMPTY_CATEGORIES: Category[] = [];

const wordsKey = ({ categoryId, search, limit }: WordsQuery): string =>
  `${WORDS_KEY}:${categoryId && categoryId !== 'all' ? categoryId : 'all'}:${search ?? ''}:${limit ?? ''}`;

export function useWords(query: WordsQuery = ALL_WORDS_QUERY) {
  const { data, error, isLoading, isFetching, refetch } = useQuery(wordsKey(query), () => getWords(query));
  return {
    words: data?.words ?? EMPTY_WORDS,
    total: data?.total ?? 0,
    hasData: data !== undefined,
    error,
    isLoading,
    isFetching,
    refetch,
  };
}

export function useCategories() {
  const { data, error, isLoading, isFetching, refetch } = useQuery(CATEGORIES_KEY, getCategories);
  return { categories: data ?? EMPTY_CATEGORIES, hasData: data !== undefined, error, isLoading, isFetching, refetch };
}

/** Dictionary entries marked as verbs (`partOfSpeech: 'verb'`) — the verbs trainer's material. */
export function useVerbs() {
  const result = useWords();
  const verbs = useMemo(() => result.words.filter(isVerb), [result.words]);
  return { ...result, verbs };
}
