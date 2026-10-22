import { useEffect, useMemo } from 'react';
import { getAllWords, getCategories } from '../api/client';
import type { WordsQuery } from '../api/client';
import { useQuery } from '../api/queryCache';
import type { Category, Word } from '../types';
import { isVerb } from '../utils/partOfSpeech';
import { showToast } from '../utils/toast';

// Every screen that needs the dictionary goes through these hooks, so the word
// list is requested once and shared between the four trainers and the admin panel.

/** The whole dictionary (`getAllWords` follows the server's pages, so there is no 1000-word ceiling). */
export const ALL_WORDS_QUERY: WordsQuery = {};

export const WORDS_KEY = 'words';
export const CATEGORIES_KEY = 'categories';

const EMPTY_WORDS: Word[] = [];
const EMPTY_CATEGORIES: Category[] = [];

const wordsKey = ({ categoryId, search }: WordsQuery): string =>
  `${WORDS_KEY}:${categoryId && categoryId !== 'all' ? categoryId : 'all'}:${search ?? ''}`;

let truncationWarned = false;

export function useWords(query: WordsQuery = ALL_WORDS_QUERY) {
  const { data, error, isLoading, isFetching, refetch } = useQuery(wordsKey(query), () => getAllWords(query));
  const words = data?.words ?? EMPTY_WORDS;
  const total = data?.total ?? 0;
  // Only possible if the safety cap in getAllWords was hit: say so instead of silently showing a partial dictionary.
  const isTruncated = data !== undefined && total > words.length;

  useEffect(() => {
    if (!isTruncated || truncationWarned) return;
    truncationWarned = true;
    showToast(`Загружено ${words.length} слов из ${total}: словарь слишком большой, часть слов не показана.`, 'info');
  }, [isTruncated, words.length, total]);

  return {
    words,
    total,
    isTruncated,
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
