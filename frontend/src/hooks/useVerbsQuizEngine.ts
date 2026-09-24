import { useState, useEffect, useCallback, useMemo } from 'react';
import type { FormEvent } from 'react';
import { getErrorMessage, getWords } from '../api/client';
import { useSRSProgress } from './useSRSProgress';
import { srsKeys } from '../utils/srs';
import { buildKnownPraesensCards, hasStammformen, hasPartizip2, hasPraeteritum } from '../utils/verbConjugation';
import type { Word, Feedback, SRSRecord, VerbFormSource } from '../types';

export type VerbQuizMode = 'praesens' | 'stammformen' | 'multiple_choice';

// Within the "Спряжение / Форма → Инфинитив" mode:
//  - 'praesens'           only asks the forward direction: given the
//                         pronoun + infinitive, produce the conjugated
//                         Präsens form.
//  - 'form_to_infinitive' only asks reverse directions: given a form,
//                         produce the infinitive. The form shown can come
//                         from Präsens (per pronoun), Präteritum, or
//                         Partizip II — whichever the verb has data for.
//  - 'both'               draws from either direction at random, per
//                         question, so they can turn up in the same session.
export type PraesensSubMode = 'praesens' | 'form_to_infinitive' | 'both';

const SUBMODE_STORAGE_KEY = 'verbs_praesens_submode';

/**
 * State and rules of the verbs trainer: loading, the per-mode card pools,
 * choosing the next question, checking answers and recording SRS progress.
 * `VerbsTrainer` is left with layout only.
 *
 * Each verb quiz mode (Präsens / 3 Formen / Multiple choice) tracks its own
 * Leitner box per verb (see `srsKeys.verb`), so mastering one form doesn't
 * hide the others. Within Präsens, each pronoun *and* each direction
 * (Спряжение vs Форма→Инфинитив) is a separate card as well.
 */
export function useVerbsQuizEngine(onAnswer: (ok: boolean) => void) {
  const [mode, setMode] = useState<VerbQuizMode>('stammformen');
  const [verbs, setVerbs] = useState<Word[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [currentVerb, setCurrentVerb] = useState<Word | null>(null);
  const [currentPronoun, setCurrentPronoun] = useState<string>('du');
  const [expectedPraesens, setExpectedPraesens] = useState('');
  const [currentFormText, setCurrentFormText] = useState('');
  // Which direction the *current* praesens-mode question is asking in.
  // Only meaningful when mode === 'praesens'; when praesensSubMode is
  // 'both' this is chosen at random per question in nextQuestion().
  const [currentPraesensType, setCurrentPraesensType] = useState<'praesens' | 'form_to_infinitive'>('praesens');
  // Only meaningful for 'form_to_infinitive': which form the displayed word
  // is, so we know whether a pronoun applies and which SRS box to use.
  const [currentFormSource, setCurrentFormSource] = useState<VerbFormSource>('praesens');
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

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    getWords({ limit: 500 })
      .then((data) => {
        if (cancelled) return;
        const vList = (data.words || []).filter((w) => w.praeteritum || w.partizip2 || w.category?.name.toLowerCase().includes('глагол'));
        setVerbs(vList);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        console.error(e);
        setLoadError(getErrorMessage(e, 'Не удалось загрузить глаголы'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  const handleSetPraesensSubMode = (val: PraesensSubMode) => {
    setPraesensSubMode(val);
    try {
      localStorage.setItem(SUBMODE_STORAGE_KEY, val);
    } catch {
      // Non-blocking: the choice just won't persist across reloads.
    }
  };

  // Not every verb has every form filled in by the admin, and for Präsens we
  // never guess a missing conjugation (see utils/verbConjugation.ts) — so
  // each mode gets its own pool, limited to verbs/pronouns we actually have
  // reliable data for. Modes with an empty pool show a dedicated message
  // instead of a broken, unsolvable question.
  const praesensCards = useMemo(() => buildKnownPraesensCards(verbs), [verbs]);
  const stammPool = useMemo(() => verbs.filter(hasStammformen), [verbs]);
  const mcPool = useMemo(() => verbs.filter(hasPartizip2), [verbs]);
  // Reused for the "Partizip II → Инфинитив" reverse card — same
  // requirement (a known Partizip II) as the multiple-choice pool.
  const partizip2ReversePool = mcPool;
  const praeteritumReversePool = useMemo(() => verbs.filter(hasPraeteritum), [verbs]);

  // Whether the combined "Спряжение / Форма → Инфинитив" pool has anything to
  // ask for the selected direction(s). 'form_to_infinitive' and 'both' share
  // the same formula because 'both' is only truly empty when the reverse pool
  // (which already includes the Präsens-sourced reverse cards) is also empty.
  const praesensPoolEmpty = useMemo(() => {
    if (praesensSubMode === 'praesens') return praesensCards.length === 0;
    return praesensCards.length === 0 && praeteritumReversePool.length === 0 && partizip2ReversePool.length === 0;
  }, [praesensSubMode, praesensCards, praeteritumReversePool, partizip2ReversePool]);

  const nextQuestion = useCallback(() => {
    setUserInput('');
    setPraeteritumInput('');
    setPartizip2Input('');
    setHilfsverbInput('haben');
    setFeedback(null);

    if (mode === 'praesens') {
      if (praesensPoolEmpty) { setCurrentVerb(null); return; }

      // Build the pool for whichever direction(s) are enabled:
      //  - 'forward'            : infinitive + pronoun -> Präsens form
      //  - 'reverse_praesens'   : Präsens form + pronoun -> infinitive
      //  - 'reverse_praeteritum': Präteritum form (no pronoun) -> infinitive
      //  - 'reverse_partizip2'  : Partizip II form (no pronoun) -> infinitive
      // Each kind keeps its own independent SRS box (see srsKeys.verb), so
      // mastering one never hides that another still needs practice.
      type PoolEntry =
        | { kind: 'forward'; verb: Word; pronoun: string; form: string }
        | { kind: 'reverse_praesens'; verb: Word; pronoun: string; form: string }
        | { kind: 'reverse_praeteritum'; verb: Word; form: string }
        | { kind: 'reverse_partizip2'; verb: Word; form: string };

      const wantForward = praesensSubMode === 'praesens' || praesensSubMode === 'both';
      const wantReverse = praesensSubMode === 'form_to_infinitive' || praesensSubMode === 'both';

      const pool: PoolEntry[] = [];
      if (wantForward) {
        for (const c of praesensCards) pool.push({ kind: 'forward', verb: c.verb, pronoun: c.pronoun, form: c.form });
      }
      if (wantReverse) {
        for (const c of praesensCards) pool.push({ kind: 'reverse_praesens', verb: c.verb, pronoun: c.pronoun, form: c.form });
        for (const v of praeteritumReversePool) pool.push({ kind: 'reverse_praeteritum', verb: v, form: v.praeteritum as string });
        for (const v of partizip2ReversePool) pool.push({ kind: 'reverse_partizip2', verb: v, form: v.partizip2 as string });
      }

      const keyFor = (e: PoolEntry): string => {
        if (e.kind === 'forward') return srsKeys.verb.praesens(e.verb.id, e.pronoun);
        if (e.kind === 'reverse_praesens') return srsKeys.verb.formToInfinitive(e.verb.id, 'praesens', e.pronoun);
        if (e.kind === 'reverse_praeteritum') return srsKeys.verb.formToInfinitive(e.verb.id, 'praeteritum');
        return srsKeys.verb.formToInfinitive(e.verb.id, 'partizip2');
      };

      const chosen = pickCard(pool, keyFor);
      if (!chosen) { setCurrentVerb(null); return; }

      setCurrentVerb(chosen.verb);
      if (chosen.kind === 'forward') {
        setCurrentPronoun(chosen.pronoun);
        setCurrentPraesensType('praesens');
        setExpectedPraesens(chosen.form);
      } else if (chosen.kind === 'reverse_praesens') {
        setCurrentPronoun(chosen.pronoun);
        setCurrentPraesensType('form_to_infinitive');
        setCurrentFormSource('praesens');
        setCurrentFormText(chosen.form);
      } else if (chosen.kind === 'reverse_praeteritum') {
        setCurrentPronoun('');
        setCurrentPraesensType('form_to_infinitive');
        setCurrentFormSource('praeteritum');
        setCurrentFormText(chosen.form);
      } else {
        setCurrentPronoun('');
        setCurrentPraesensType('form_to_infinitive');
        setCurrentFormSource('partizip2');
        setCurrentFormText(chosen.form);
      }
      return;
    }

    if (mode === 'stammformen') {
      const chosen = pickCard(stammPool, (v) => srsKeys.verb.stammformen(v.id));
      setCurrentVerb(chosen ?? null);
      return;
    }

    // multiple_choice
    const chosen = pickCard(mcPool, (v) => srsKeys.verb.multipleChoice(v.id));
    if (!chosen) { setCurrentVerb(null); return; }
    setCurrentVerb(chosen);
    const correctP2 = chosen.partizip2 as string;
    const fake1 = `ge${chosen.de.replace(/en$/, '')}en`;
    const fake2 = `be${chosen.de.replace(/en$/, '')}t`;
    const fake3 = `ver${chosen.de.replace(/en$/, '')}t`;
    const fakes = Array.from(new Set([fake1, fake2, fake3])).filter((f) => f !== correctP2);
    setMcOptions([correctP2, ...fakes].slice(0, 4).sort(() => Math.random() - 0.5));
  }, [mode, pickCard, praesensCards, stammPool, mcPool, praesensSubMode, praesensPoolEmpty, praeteritumReversePool, partizip2ReversePool]);

  // `nextQuestion` changes exactly when the verbs, the mode, the sub-mode or
  // the SRS switch change, so this re-deals a question whenever any of them does.
  useEffect(() => {
    if (verbs.length > 0) nextQuestion();
  }, [verbs.length, nextQuestion]);

  /** SRS key of the question currently on screen. */
  const currentCardKey = (verb: Word): string => {
    if (mode === 'praesens') {
      return currentPraesensType === 'praesens'
        ? srsKeys.verb.praesens(verb.id, currentPronoun)
        : srsKeys.verb.formToInfinitive(verb.id, currentFormSource, currentPronoun);
    }
    return mode === 'stammformen' ? srsKeys.verb.stammformen(verb.id) : srsKeys.verb.multipleChoice(verb.id);
  };

  const currentSrsItem: SRSRecord | undefined = currentVerb ? srsMap[currentCardKey(currentVerb)] : undefined;

  const recordResult = (ok: boolean) => {
    if (!currentVerb) return;
    recordAnswer(currentCardKey(currentVerb), ok);
    onAnswer(ok);
  };

  const handlePraesensSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (feedback) { nextQuestion(); return; }
    if (!currentVerb) return;
    const cleanIn = userInput.trim().toLowerCase();
    const ok = cleanIn.length > 0 && cleanIn === expectedPraesens.toLowerCase();
    setFeedback({
      isCorrect: ok,
      message: `Верно: ${currentPronoun} ${expectedPraesens}`,
      checks: [{ user: userInput, expected: expectedPraesens, isCorrect: ok }],
    });
    recordResult(ok);
  };

  const handleFormToInfinitiveSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (feedback) { nextQuestion(); return; }
    if (!currentVerb) return;
    const cleanIn = userInput.trim().toLowerCase();
    const ok = cleanIn.length > 0 && cleanIn === currentVerb.de.trim().toLowerCase();
    // Präsens-sourced forms are shown with their pronoun (ich/du/...);
    // Präteritum and Partizip II are a single fixed form with no pronoun.
    const shownForm = currentFormSource === 'praesens' ? `${currentPronoun} ${currentFormText}` : currentFormText;
    setFeedback({
      isCorrect: ok,
      message: `Верно: ${shownForm} → ${currentVerb.de}`,
      checks: [{ user: userInput, expected: currentVerb.de.trim(), isCorrect: ok }],
    });
    recordResult(ok);
  };

  const handleStammSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (feedback) { nextQuestion(); return; }
    if (!currentVerb) return;
    const cleanPr = praeteritumInput.trim().toLowerCase();
    const cleanP2 = partizip2Input.trim().toLowerCase();
    const okPr = cleanPr.length > 0 && cleanPr === (currentVerb.praeteritum || '').toLowerCase();
    const okP2 = cleanP2.length > 0 && cleanP2 === (currentVerb.partizip2 || '').toLowerCase();
    const okH = hilfsverbInput.trim().toLowerCase() === (currentVerb.hilfsverb || 'haben').toLowerCase();
    const ok = okPr && okP2 && okH;
    const expectedHilfsverb = currentVerb.hilfsverb || 'haben';
    setFeedback({
      isCorrect: ok,
      message: `${currentVerb.de} – ${currentVerb.praeteritum || '—'} – ${currentVerb.partizip2 || '—'} (${expectedHilfsverb})`,
      // All three fields are listed: the wrong ones as "Вы ввели / Правильно", the right ones as a single ✓ line.
      checks: [
        { label: 'Präteritum', user: praeteritumInput, expected: currentVerb.praeteritum || '', isCorrect: okPr },
        { label: 'Partizip II', user: partizip2Input, expected: currentVerb.partizip2 || '', isCorrect: okP2 },
        { label: 'Hilfsverb', user: hilfsverbInput, expected: expectedHilfsverb, isCorrect: okH, userLabel: 'Вы выбрали' },
      ],
    });
    recordResult(ok);
  };

  const handleSelectOption = (option: string) => {
    if (!currentVerb) return;
    const ok = option === currentVerb.partizip2;
    setFeedback({ isCorrect: ok, message: `${currentVerb.de} -> Partizip II: ${currentVerb.partizip2}` });
    recordResult(ok);
  };

  const isPoolEmpty =
    !isLoading && verbs.length > 0 && !currentVerb &&
    ((mode === 'stammformen' && stammPool.length === 0) ||
      (mode === 'multiple_choice' && mcPool.length === 0) ||
      (mode === 'praesens' && praesensPoolEmpty));

  return {
    // data
    verbs, isLoading, loadError, reload, isPoolEmpty,
    // mode
    mode, setMode, praesensSubMode, handleSetPraesensSubMode,
    // SRS
    useSRS, setUseSRS, srsMap, resetSRS,
    // current question
    currentVerb, currentPronoun, currentPraesensType, currentFormText, expectedPraesens, mcOptions, currentSrsItem,
    // inputs
    userInput, setUserInput,
    praeteritumInput, setPraeteritumInput, partizip2Input, setPartizip2Input, hilfsverbInput, setHilfsverbInput,
    feedback,
    // actions
    nextQuestion, handlePraesensSubmit, handleFormToInfinitiveSubmit, handleStammSubmit, handleSelectOption,
  };
}
