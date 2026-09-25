import { useState, useEffect, useCallback } from 'react';
import type { FormEvent } from 'react';
import { getErrorMessage } from '../api/client';
import { useCategories, useWords } from './useDictionary';
import { useSRSProgress } from './useSRSProgress';
import { srsKeys } from '../utils/srs';
import { pickClosestAnswer } from '../utils/answerDiff';
import { answersMatch, currentMatchOptions } from '../utils/answerMatch';
import type { Word, Feedback, AnswerCheck, WordDirection, WordFormType, SRSRecord } from '../types';

export type DirectionMode = WordDirection | 'mixed';

const ARTICLE_PREFIX = /^(der|die|das)\s+/i;

/** "a, b / c" → ["a", "b", "c"]: any of the listed translations is accepted. */
const splitTranslations = (ru: string): string[] => ru.split(/[,;/]/).map((v) => v.trim()).filter(Boolean);

interface Card {
  word: Word;
  direction: WordDirection;
  formType: WordFormType;
}

/**
 * State and rules of the words trainer: loading the dictionary, the
 * quiz settings, building the pool of (word, direction, form) cards, picking
 * the next one (SRS-weighted) and checking an answer. `WordsTrainer` is left
 * with layout only.
 */
export function useWordsQuizEngine(onAnswer: (isCorrect: boolean) => void) {
  // ---- data (shared with the other trainers and the admin panel, see api/queryCache.ts) ----
  const wordsQuery = useWords();
  const categoriesQuery = useCategories();
  const { words } = wordsQuery;
  const { categories } = categoriesQuery;

  // ---- settings ----
  const [directionMode, setDirectionMode] = useState<DirectionMode>('ru_to_de');
  const [selectedCats, setSelectedCats] = useState<string[]>(['all']);
  const [requireArticle, setRequireArticle] = useState(true);
  const [enableBase, setEnableBase] = useState(true);
  const [enablePlural, setEnablePlural] = useState(true);
  const [enableFeminine, setEnableFeminine] = useState(true);
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

  const nextWord = useCallback(() => {
    if (selectedCats.length === 0) {
      setCurrentWord(null);
      return;
    }

    const isAll = selectedCats.includes('all');
    const activePool = words.filter((w) => isAll || selectedCats.includes(w.categoryId));
    if (activePool.length === 0) { setCurrentWord(null); return; }

    const directions: WordDirection[] = directionMode === 'mixed' ? ['ru_to_de', 'de_to_ru'] : [directionMode];

    const cards: Card[] = [];
    for (const w of activePool) {
      const possibleForms: WordFormType[] = [];
      if (enableBase) possibleForms.push('base');
      if (enablePlural && w.plural) possibleForms.push('plural');
      if (enableFeminine && w.feminine) possibleForms.push('feminine');
      const forms = possibleForms.length > 0 ? possibleForms : (['base'] as WordFormType[]);
      for (const direction of directions) {
        for (const formType of forms) {
          cards.push({ word: w, direction, formType });
        }
      }
    }

    if (cards.length === 0) { setCurrentWord(null); return; }

    const chosenCard = pickCard(cards, (c) => srsKeys.word(c.word.id, c.direction, c.formType));
    if (!chosenCard) { setCurrentWord(null); return; }

    setCurrentWord(chosenCard.word);
    setActiveDirection(chosenCard.direction);
    setCurrentFormType(chosenCard.formType);
    setUserInput('');
    setFeedback(null);
  }, [words, selectedCats, pickCard, directionMode, enableBase, enablePlural, enableFeminine]);

  // `nextWord` changes exactly when the dictionary, the filters or the SRS
  // switch change, so this re-deals a card whenever any of them does.
  useEffect(() => {
    if (words.length > 0) nextWord();
  }, [words.length, nextWord]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (feedback) { nextWord(); return; }
    if (!currentWord) return;

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
    words, categories, isLoading, loadError, reload,
    // settings
    directionMode, setDirectionMode,
    selectedCats, setSelectedCats,
    requireArticle, setRequireArticle,
    enableBase, setEnableBase,
    enablePlural, setEnablePlural,
    enableFeminine, setEnableFeminine,
    // SRS
    useSRS, setUseSRS, srsMap, resetSRS,
    // current card
    currentWord, activeDirection, currentFormType, currentSrsItem,
    userInput, setUserInput, feedback,
    nextWord, handleSubmit,
  };
}
