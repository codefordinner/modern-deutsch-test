import { useState, useEffect, useCallback, useMemo } from 'react';
import type { FormEvent } from 'react';
import { getErrorMessage } from '../api/client';
import { useCategories, useWords } from './useDictionary';
import { useSRSProgress } from './useSRSProgress';
import { asBool, oneOf, usePersistentState } from './usePersistentState';
import { srsKeys } from '../utils/srs';
import { pickClosestAnswer } from '../utils/answerDiff';
import { answersMatch, cleanText, currentMatchOptions } from '../utils/answerMatch';
import { buildWordCards } from '../utils/wordCards';
import type { DirectionMode } from '../utils/wordCards';
import type { Word, Feedback, AnswerCheck, WordDirection, WordFormType, SRSRecord } from '../types';

export type { DirectionMode } from '../utils/wordCards';

const ARTICLE_PREFIX = /^(der|die|das)\s+/i;

/** "a, b / c" → ["a", "b", "c"]: any of the listed translations is accepted. */
const splitTranslations = (ru: string): string[] => ru.split(/[,;/]/).map((v) => v.trim()).filter(Boolean);

/** Quiz settings kept in localStorage (`words_settings`). */
interface WordsSettings {
  directionMode: DirectionMode;
  selectedCats: string[];
  requireArticle: boolean;
  enableBase: boolean;
  enablePlural: boolean;
  enableFeminine: boolean;
}

const DEFAULT_SETTINGS: WordsSettings = {
  directionMode: 'ru_to_de',
  selectedCats: ['all'],
  requireArticle: true,
  enableBase: true,
  enablePlural: true,
  enableFeminine: true,
};

function sanitizeSettings(raw: unknown): WordsSettings {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const cats = Array.isArray(r.selectedCats) ? r.selectedCats.filter((c): c is string => typeof c === 'string') : null;
  return {
    directionMode: oneOf<DirectionMode>(['ru_to_de', 'de_to_ru', 'mixed'], DEFAULT_SETTINGS.directionMode)(r.directionMode),
    selectedCats: cats ?? DEFAULT_SETTINGS.selectedCats,
    requireArticle: asBool(r.requireArticle, DEFAULT_SETTINGS.requireArticle),
    enableBase: asBool(r.enableBase, DEFAULT_SETTINGS.enableBase),
    enablePlural: asBool(r.enablePlural, DEFAULT_SETTINGS.enablePlural),
    enableFeminine: asBool(r.enableFeminine, DEFAULT_SETTINGS.enableFeminine),
  };
}

/**
 * State and rules of the words trainer: loading the dictionary, the
 * quiz settings (persisted), building the pool of (word, direction, form) cards,
 * picking the next one (SRS-weighted) and checking an answer. `WordsTrainer` is
 * left with layout only.
 */
export function useWordsQuizEngine(onAnswer: (isCorrect: boolean) => void) {
  // ---- data (shared with the other trainers and the admin panel, see api/queryCache.ts) ----
  const wordsQuery = useWords();
  const categoriesQuery = useCategories();
  const { words } = wordsQuery;
  const { categories } = categoriesQuery;

  // ---- settings (survive reloads and later visits) ----
  const [settings, setSettings] = usePersistentState<WordsSettings>('words_settings', DEFAULT_SETTINGS, sanitizeSettings);
  const { directionMode, requireArticle, enableBase, enablePlural, enableFeminine } = settings;

  const patch = useCallback((p: Partial<WordsSettings>) => setSettings((prev) => ({ ...prev, ...p })), [setSettings]);
  const setDirectionMode = useCallback((v: DirectionMode) => patch({ directionMode: v }), [patch]);
  const setSelectedCats = useCallback((v: string[]) => patch({ selectedCats: v }), [patch]);
  const setRequireArticle = useCallback((v: boolean) => patch({ requireArticle: v }), [patch]);
  const setEnableBase = useCallback((v: boolean) => patch({ enableBase: v }), [patch]);
  const setEnablePlural = useCallback((v: boolean) => patch({ enablePlural: v }), [patch]);
  const setEnableFeminine = useCallback((v: boolean) => patch({ enableFeminine: v }), [patch]);

  // A saved selection may name categories that were deleted (or come from another server's backup):
  // ignore the vanished ones, and if nothing is left fall back to "all". An explicitly cleared list stays empty.
  const selectedCats = useMemo(() => {
    const saved = settings.selectedCats;
    if (saved.length === 0 || saved.includes('all') || categories.length === 0) return saved;
    const valid = saved.filter((id) => categories.some((c) => c.id === id));
    return valid.length > 0 ? valid : ['all'];
  }, [settings.selectedCats, categories]);

  const { useSRS, setUseSRS, srsMap, recordAnswer, resetSRS, pickCard } = useSRSProgress('words');

  // ---- current card ----
  const [currentWord, setCurrentWord] = useState<Word | null>(null);
  const [activeDirection, setActiveDirection] = useState<WordDirection>('ru_to_de');
  const [currentFormType, setCurrentFormType] = useState<WordFormType>('base');
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const failedQuery = [wordsQuery, categoriesQuery].find((q) => !q.hasData && q.error !== undefined);
  const loadError = failedQuery ? getErrorMessage(failedQuery.error, 'Не удалось загрузить слова') : null;
  const isLoading = !loadError && (wordsQuery.isLoading || categoriesQuery.isLoading);

  const reload = useCallback(() => {
    void wordsQuery.refetch();
    void categoriesQuery.refetch();
  }, [wordsQuery.refetch, categoriesQuery.refetch]);

  // Every card the trainer can ask with the current filters (also what the SRS screen counts).
  const cards = useMemo(
    () => buildWordCards(words, { directionMode, selectedCats, enableBase, enablePlural, enableFeminine }),
    [words, directionMode, selectedCats, enableBase, enablePlural, enableFeminine]
  );
  const poolKeys = useMemo(() => cards.map((c) => c.key), [cards]);
  // Words exist and a category is chosen, yet the form filters leave nothing to ask.
  const isPoolEmpty = !isLoading && !loadError && words.length > 0 && selectedCats.length > 0 && cards.length === 0;

  const nextWord = useCallback(() => {
    const chosenCard = pickCard(cards, (c) => c.key);
    if (!chosenCard) { setCurrentWord(null); return; }

    setCurrentWord(chosenCard.word);
    setActiveDirection(chosenCard.direction);
    setCurrentFormType(chosenCard.formType);
    setUserInput('');
    setFeedback(null);
  }, [cards, pickCard]);

  // `nextWord` changes exactly when the dictionary, the filters or the SRS
  // switch change, so this re-deals a card whenever any of them does.
  useEffect(() => {
    if (words.length > 0) nextWord();
  }, [words.length, nextWord]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (feedback) { nextWord(); return; }
    if (!currentWord) return;
    // An accidental Enter in an empty field is not an answer: it must not reset the card or the streak.
    if (!cleanText(userInput)) return;

    let expectedTarget = currentWord.de;
    if (currentFormType === 'plural' && currentWord.plural) expectedTarget = currentWord.plural;
    if (currentFormType === 'feminine' && currentWord.feminine) expectedTarget = currentWord.feminine;

    // Case, stray/double spaces and Unicode form never matter; ae/oe/ue/ss for ä/ö/ü/ß is a user setting.
    let isCorrect: boolean;
    if (activeDirection === 'ru_to_de') {
      // Without the article requirement both "der Tisch" and "Tisch" are right.
      const accepted = requireArticle ? [expectedTarget] : [expectedTarget, expectedTarget.replace(ARTICLE_PREFIX, '')];
      isCorrect = answersMatch(userInput, accepted, currentMatchOptions());
    } else {
      isCorrect = answersMatch(userInput, splitTranslations(currentWord.ru), { foldYo: true });
    }

    recordAnswer(srsKeys.word(currentWord.id, activeDirection, currentFormType), isCorrect);

    // What to show as "Правильно" and what to compare the input against.
    let check: AnswerCheck;
    if (activeDirection === 'ru_to_de') {
      // With the article requirement off, the article is displayed but not
      // part of the comparison (the user wasn't asked to type it).
      const article = requireArticle ? undefined : expectedTarget.match(ARTICLE_PREFIX)?.[0];
      check = { user: userInput, expected: expectedTarget, isCorrect, neutralPrefix: article };
    } else {
      // Several translations may be accepted ("a, b / c") — diff against the
      // one the user came closest to and list the rest.
      const variants = splitTranslations(currentWord.ru);
      const closest = pickClosestAnswer(userInput, variants);
      check = {
        user: userInput,
        expected: closest || currentWord.ru,
        isCorrect,
        alternatives: variants.length > 1 ? variants : undefined,
      };
    }

    const hintSuffix = currentWord.hint ? ` (${currentWord.hint})` : '';
    setFeedback({
      isCorrect,
      message: `Отлично! ${expectedTarget} = ${currentWord.ru}${hintSuffix}`,
      checks: [check],
    });
    onAnswer(isCorrect);
  };

  const currentSrsItem: SRSRecord | undefined = currentWord
    ? srsMap[srsKeys.word(currentWord.id, activeDirection, currentFormType)]
    : undefined;

  return {
    // data
    words, categories, isLoading, loadError, reload, isPoolEmpty,
    // settings
    directionMode, setDirectionMode,
    selectedCats, setSelectedCats,
    requireArticle, setRequireArticle,
    enableBase, setEnableBase,
    enablePlural, setEnablePlural,
    enableFeminine, setEnableFeminine,
    // SRS
    useSRS, setUseSRS, srsMap, resetSRS, poolKeys,
    // current card
    currentWord, activeDirection, currentFormType, currentSrsItem,
    userInput, setUserInput, feedback,
    nextWord, handleSubmit,
  };
}
