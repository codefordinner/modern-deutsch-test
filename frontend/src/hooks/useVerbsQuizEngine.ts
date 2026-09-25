import { useState, useEffect, useCallback, useMemo } from 'react';
import type { FormEvent } from 'react';
import { getErrorMessage } from '../api/client';
import { useVerbs } from './useDictionary';
import { useSRSProgress } from './useSRSProgress';
import { answersMatch, currentMatchOptions } from '../utils/answerMatch';
import { buildVerbCards, isCardInSelection, selectVerbCards } from '../utils/verbCards';
import type { PraesensSubMode, VerbCard, VerbQuizMode } from '../utils/verbCards';
import { buildPartizip2Options } from '../utils/verbQuiz';
import type { Feedback, SRSRecord } from '../types';

export type { PraesensSubMode, VerbQuizMode } from '../utils/verbCards';

const SUBMODE_STORAGE_KEY = 'verbs_praesens_submode';

/**
 * State and rules of the verbs trainer: loading, choosing the next question,
 * checking answers and recording SRS progress. `VerbsTrainer` is left with
 * layout only.
 *
 * What can be asked is defined by the cards from `utils/verbCards.ts` (the SRS
 * screen counts the same cards). Each card has its own Leitner box: every verb
 * quiz mode, every Präsens pronoun and each direction (Спряжение vs
 * Форма → Инфинитив) is tracked separately, so mastering one form doesn't hide
 * the others.
 */
export function useVerbsQuizEngine(onAnswer: (ok: boolean) => void) {
  const [mode, setMode] = useState<VerbQuizMode>('stammformen');
  const { verbs, error, hasData, isLoading: isFetchingVerbs, refetch } = useVerbs();
  const loadError = !hasData && error !== undefined ? getErrorMessage(error, 'Не удалось загрузить глаголы') : null;
  const isLoading = !loadError && isFetchingVerbs;

  const [currentCard, setCurrentCard] = useState<VerbCard | null>(null);
  const [praesensSubMode, setPraesensSubMode] = useState<PraesensSubMode>(() => {
    try {
      const saved = localStorage.getItem(SUBMODE_STORAGE_KEY);
      return saved === 'praesens' || saved === 'form_to_infinitive' || saved === 'both' ? saved : 'both';
    } catch {
      return 'both';
    }
  });

  const [userInput, setUserInput] = useState('');
  const [praeteritumInput, setPraeteritumInput] = useState('');
  const [partizip2Input, setPartizip2Input] = useState('');
  const [hilfsverbInput, setHilfsverbInput] = useState('haben');
  const [mcOptions, setMcOptions] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const { useSRS, setUseSRS, srsMap, recordAnswer, resetSRS, pickCard } = useSRSProgress('verbs');

  const reload = useCallback(() => {
    void refetch();
  }, [refetch]);

  const handleSetPraesensSubMode = (val: PraesensSubMode) => {
    setPraesensSubMode(val);
    try {
      localStorage.setItem(SUBMODE_STORAGE_KEY, val);
    } catch {
      // Non-blocking: the choice just won't persist across reloads.
    }
  };

  const allCards = useMemo(() => buildVerbCards(verbs), [verbs]);
  const pool = useMemo(() => selectVerbCards(allCards, mode, praesensSubMode), [allCards, mode, praesensSubMode]);
  // Wrong options of the multiple-choice question are other verbs' real Partizip II forms.
  const partizip2Pool = useMemo(
    () => allCards.filter((c) => c.kind === 'multiple_choice').map((c) => c.verb),
    [allCards]
  );

  const nextQuestion = useCallback(() => {
    setUserInput('');
    setPraeteritumInput('');
    setPartizip2Input('');
    setHilfsverbInput('haben');
    setFeedback(null);

    const chosen = pickCard(pool, (card) => card.key);
    setCurrentCard(chosen ?? null);
    if (chosen?.kind === 'multiple_choice') setMcOptions(buildPartizip2Options(chosen.verb, partizip2Pool));
  }, [pool, pickCard, partizip2Pool]);

  // `nextQuestion` changes exactly when the verbs, the mode, the sub-mode or
  // the SRS switch change, so this re-deals a question whenever any of them does.
  useEffect(() => {
    if (verbs.length > 0) nextQuestion();
  }, [verbs.length, nextQuestion]);

  // Right after a mode switch the old card is still in state for one render; never show it in the new mode.
  const card = currentCard && isCardInSelection(currentCard.kind, mode, praesensSubMode) ? currentCard : null;
  const currentVerb = card?.verb ?? null;
  const isReverse = card !== null && card.kind.startsWith('infinitive_from_');

  const currentSrsItem: SRSRecord | undefined = card ? srsMap[card.key] : undefined;

  const recordResult = (ok: boolean) => {
    if (!card) return;
    recordAnswer(card.key, ok);
    onAnswer(ok);
  };

  const handlePraesensSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (feedback) { nextQuestion(); return; }
    if (!card || card.kind !== 'praesens') return;
    const expected = card.form ?? '';
    const ok = answersMatch(userInput, expected, currentMatchOptions());
    setFeedback({
      isCorrect: ok,
      message: `Верно: ${card.pronoun} ${expected}`,
      checks: [{ user: userInput, expected, isCorrect: ok }],
    });
    recordResult(ok);
  };

  const handleFormToInfinitiveSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (feedback) { nextQuestion(); return; }
    if (!card || !isReverse) return;
    const infinitive = card.verb.de.trim();
    const ok = answersMatch(userInput, infinitive, currentMatchOptions());
    // Präsens-sourced forms are shown with their pronoun (ich/du/...);
    // Präteritum and Partizip II are a single fixed form with no pronoun.
    const shownForm = card.kind === 'infinitive_from_praesens' ? `${card.pronoun} ${card.form}` : card.form;
    setFeedback({
      isCorrect: ok,
      message: `Верно: ${shownForm} → ${card.verb.de}`,
      checks: [{ user: userInput, expected: infinitive, isCorrect: ok }],
    });
    recordResult(ok);
  };

  const handleStammSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (feedback) { nextQuestion(); return; }
    if (!card || card.kind !== 'stammformen') return;
    const verb = card.verb;
    const options = currentMatchOptions();
    const expectedHilfsverb = verb.hilfsverb || 'haben';
    const okPr = answersMatch(praeteritumInput, verb.praeteritum || '', options);
    const okP2 = answersMatch(partizip2Input, verb.partizip2 || '', options);
    const okH = answersMatch(hilfsverbInput, expectedHilfsverb);
    const ok = okPr && okP2 && okH;
    setFeedback({
      isCorrect: ok,
      message: `${verb.de} – ${verb.praeteritum || '—'} – ${verb.partizip2 || '—'} (${expectedHilfsverb})`,
      // All three fields are listed: the wrong ones as "Вы ввели / Правильно", the right ones as a single ✓ line.
      checks: [
        { label: 'Präteritum', user: praeteritumInput, expected: verb.praeteritum || '', isCorrect: okPr },
        { label: 'Partizip II', user: partizip2Input, expected: verb.partizip2 || '', isCorrect: okP2 },
        { label: 'Hilfsverb', user: hilfsverbInput, expected: expectedHilfsverb, isCorrect: okH, userLabel: 'Вы выбрали' },
      ],
    });
    recordResult(ok);
  };

  const handleSelectOption = (option: string) => {
    if (!card || card.kind !== 'multiple_choice') return;
    const ok = option === card.verb.partizip2?.trim();
    setFeedback({ isCorrect: ok, message: `${card.verb.de} -> Partizip II: ${card.verb.partizip2}` });
    recordResult(ok);
  };

  const isPoolEmpty = !isLoading && verbs.length > 0 && pool.length === 0;

  return {
    // data
    verbs, isLoading, loadError, reload, isPoolEmpty,
    // mode
    mode, setMode, praesensSubMode, handleSetPraesensSubMode,
    // SRS
    useSRS, setUseSRS, srsMap, resetSRS,
    // current question
    currentVerb,
    currentPronoun: card?.pronoun ?? '',
    currentPraesensType: (card?.kind === 'praesens' ? 'praesens' : 'form_to_infinitive') as 'praesens' | 'form_to_infinitive',
    currentFormText: isReverse ? (card.form ?? '') : '',
    expectedPraesens: card?.kind === 'praesens' ? (card.form ?? '') : '',
    mcOptions,
    currentSrsItem,
    // inputs
    userInput, setUserInput,
    praeteritumInput, setPraeteritumInput, partizip2Input, setPartizip2Input, hilfsverbInput, setHilfsverbInput,
    feedback,
    // actions
    nextQuestion, handlePraesensSubmit, handleFormToInfinitiveSubmit, handleStammSubmit, handleSelectOption,
  };
}
