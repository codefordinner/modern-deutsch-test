import { useState, useEffect, useCallback } from 'react';
import type { FormEvent } from 'react';
import { getCategories, getErrorMessage, getWords } from '../api/client';
import { useSRSProgress } from './useSRSProgress';
import { srsKeys } from '../utils/srs';
import { pickClosestAnswer } from '../utils/answerDiff';
import type { Word, Category, Feedback, AnswerCheck, WordDirection, WordFormType, SRSRecord } from '../types';

export type DirectionMode = WordDirection | 'mixed';

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
  // ---- data ----
  const [words, setWords] = useState<Word[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

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

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    Promise.all([getWords({ limit: 1000 }), getCategories()])
      .then(([wordsPage, cats]) => {
        if (cancelled) return;
        setWords(wordsPage.words || []);
        setCategories(cats || []);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        console.error(e);
        setLoadError(getErrorMessage(e, 'Не удалось загрузить слова'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

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

    let isCorrect = false;
    let expectedTarget = currentWord.de;
    if (currentFormType === 'plural' && currentWord.plural) expectedTarget = currentWord.plural;
    if (currentFormType === 'feminine' && currentWord.feminine) expectedTarget = currentWord.feminine;

    const cleanIn = userInput.trim().toLowerCase();
    if (cleanIn.length === 0) {
      isCorrect = false;
    } else if (activeDirection === 'ru_to_de') {
      const cleanDe = expectedTarget.trim().toLowerCase();
      if (requireArticle) isCorrect = cleanIn === cleanDe;
      else isCorrect = cleanIn === cleanDe.replace(/^(der|die|das)\s+/, '');
    } else {
      isCorrect = currentWord.ru.toLowerCase().split(/[,;/]/).map((s) => s.trim()).includes(cleanIn);
    }

    recordAnswer(srsKeys.word(currentWord.id, activeDirection, currentFormType), isCorrect);

    // What to show as "Правильно" and what to compare the input against.
    let check: AnswerCheck;
    if (activeDirection === 'ru_to_de') {
      // With the article requirement off, the article is displayed but not
      // part of the comparison (the user wasn't asked to type it).
      const article = requireArticle ? undefined : expectedTarget.match(/^(der|die|das)\s+/i)?.[0];
      check = { user: userInput, expected: expectedTarget, isCorrect, neutralPrefix: article };
    } else {
      // Several translations may be accepted ("a, b / c") — diff against the
      // one the user came closest to and list the rest.
      const variants = currentWord.ru.split(/[,;/]/).map((v) => v.trim()).filter(Boolean);
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
