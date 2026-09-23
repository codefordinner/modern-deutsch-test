import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BookOpen, Layers } from 'lucide-react';
import { VerbsTableModal } from './verbs/VerbsTableModal';
import { VerbsSRSModal } from './verbs/VerbsSRSModal';
import { PraesensQuiz } from './verbs/PraesensQuiz';
import { StammformenQuiz } from './verbs/StammformenQuiz';
import { MultipleChoiceQuiz } from './verbs/MultipleChoiceQuiz';
import { FormToInfinitiveQuiz } from './verbs/FormToInfinitiveQuiz';
import { useSRSProgress } from '../hooks/useSRSProgress';
import { buildKnownPraesensCards, hasStammformen, hasPartizip2, hasPraeteritum } from '../utils/verbConjugation';
import type { Word, ScoreState, Feedback } from '../types';

type Mode = 'praesens' | 'stammformen' | 'multiple_choice';

// Within the "Спряжение / Форма → Инфинитив" mode:
//  - 'praesens'          only asks the forward direction: given the
//                         pronoun + infinitive, produce the conjugated
//                         Präsens form.
//  - 'form_to_infinitive' only asks reverse directions: given a form,
//                         produce the infinitive. The form shown can come
//                         from Präsens (per pronoun), Präteritum, or
//                         Partizip II — whichever the verb has data for.
//  - 'both'               draws from either direction at random, per
//                         question, so they can turn up in the same random
//                         session.
type PraesensSubMode = 'praesens' | 'form_to_infinitive' | 'both';

// Which underlying form a "форма → инфинитив" question is quizzing on.
// Präsens forms are per-pronoun; Präteritum and Partizip II are a single
// fixed form per verb (no pronoun involved).
type FormSource = 'praesens' | 'praeteritum' | 'partizip2';

export const VerbsTrainer: React.FC<{ score: ScoreState; onAnswer: (ok: boolean) => void }> = ({ onAnswer }) => {
  const [mode, setMode] = useState<Mode>('stammformen');
  const [verbs, setVerbs] = useState<Word[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentVerb, setCurrentVerb] = useState<Word | null>(null);
  const [currentPronoun, setCurrentPronoun] = useState<string>('du');
  const [expectedPraesens, setExpectedPraesens] = useState('');
  const [currentFormText, setCurrentFormText] = useState('');
  // Which direction the *current* praesens-mode question is asking in.
  // Only meaningful when mode === 'praesens'; when praesensSubMode is
  // 'both' this is chosen at random per question in nextQuestion().
  const [currentPraesensType, setCurrentPraesensType] = useState<'praesens' | 'form_to_infinitive'>('praesens');
  // Only meaningful when currentPraesensType === 'form_to_infinitive': which
  // form the displayed word is (Präsens/Präteritum/Partizip II), so we know
  // whether a pronoun applies and which independent SRS box to use.
  const [currentFormSource, setCurrentFormSource] = useState<FormSource>('praesens');
  const [praesensSubMode, setPraesensSubMode] = useState<PraesensSubMode>(() => {
    try {
      const saved = localStorage.getItem('verbs_praesens_submode');
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
  const [isTableOpen, setIsTableOpen] = useState(false);
  const [isSrsOpen, setIsSrsOpen] = useState(false);
  const { useSRS, setUseSRS, srsMap, recordAnswer, resetSRS, pickCard } = useSRSProgress('verbs');

  // Each verb quiz mode (Präsens / 3 Formen / Multiple choice) tracks its
  // own Leitner box per verb, so mastering one form doesn't hide the
  // others. Within Präsens, each pronoun (ich/du/er-sie-es/wir/ihr/sie-Sie)
  // *and* each direction (Спряжение vs Форма→Инфинитив) additionally gets
  // its own box — mastering "ihr" doesn't hide that "du" still needs
  // practice, and mastering the "спряжение" side of a verb doesn't hide
  // that its "форма→инфинитив" side still needs practice. They're separate
  // cards, not one shared box.
  const srsKey = (verbId: string, quizMode: string, pronoun?: string) =>
    pronoun ? `${verbId}:${quizMode}:${pronoun}` : `${verbId}:${quizMode}`;

  // The SRS key for the currently displayed "форма → инфинитив" question.
  // Präsens-sourced reverse cards keep the pre-existing key format (so old
  // progress isn't lost); Präteritum/Partizip II reverse cards are brand
  // new card types with their own dedicated keys (no pronoun involved).
  const reverseFormSrsKey = (verbId: string, formSource: FormSource, pronoun: string) => {
    if (formSource === 'praesens') return srsKey(verbId, 'form_to_infinitive', pronoun);
    if (formSource === 'praeteritum') return srsKey(verbId, 'form_to_infinitive_praeteritum');
    return srsKey(verbId, 'form_to_infinitive_partizip2');
  };

  useEffect(() => {
    setIsLoading(true);
    fetch('/api/words?limit=500')
      .then((r) => r.json())
      .then((data) => {
        const vList = (data.words || []).filter((w: Word) => w.praeteritum || w.partizip2 || w.category?.name.toLowerCase().includes('глагол'));
        setVerbs(vList);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const handleSetPraesensSubMode = (val: PraesensSubMode) => {
    setPraesensSubMode(val);
    localStorage.setItem('verbs_praesens_submode', val);
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

  // Whether the combined "Спряжение / Форма → Инфинитив" pool has anything
  // to ask for the currently selected direction(s). The 'form_to_infinitive'
  // and 'both' cases share the same formula because 'both' is only truly
  // empty when the reverse pool (which already includes the Präsens-sourced
  // reverse cards) is also empty.
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
      //    (only the "Спряжение" side; always sourced from Präsens data)
      //  - 'reverse_praesens'   : Präsens form + pronoun -> infinitive
      //  - 'reverse_praeteritum': Präteritum form (no pronoun) -> infinitive
      //  - 'reverse_partizip2'  : Partizip II form (no pronoun) -> infinitive
      // Each kind keeps its own independent SRS box (see reverseFormSrsKey /
      // srsKey below), so mastering one never hides that another still needs
      // practice.
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
        if (e.kind === 'forward') return srsKey(e.verb.id, 'praesens', e.pronoun);
        if (e.kind === 'reverse_praesens') return reverseFormSrsKey(e.verb.id, 'praesens', e.pronoun);
        if (e.kind === 'reverse_praeteritum') return reverseFormSrsKey(e.verb.id, 'praeteritum', '');
        return reverseFormSrsKey(e.verb.id, 'partizip2', '');
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
      const chosen = pickCard(stammPool, (v) => srsKey(v.id, mode));
      setCurrentVerb(chosen ?? null);
      return;
    }

    // multiple_choice
    const chosen = pickCard(mcPool, (v) => srsKey(v.id, mode));
    if (!chosen) { setCurrentVerb(null); return; }
    setCurrentVerb(chosen);
    const correctP2 = chosen.partizip2 as string;
    const fake1 = `ge${chosen.de.replace(/en$/, '')}en`;
    const fake2 = `be${chosen.de.replace(/en$/, '')}t`;
    const fake3 = `ver${chosen.de.replace(/en$/, '')}t`;
    const fakes = Array.from(new Set([fake1, fake2, fake3])).filter((f) => f !== correctP2);
    setMcOptions([correctP2, ...fakes].slice(0, 4).sort(() => Math.random() - 0.5));
  }, [mode, pickCard, praesensCards, stammPool, mcPool, praesensSubMode, praesensPoolEmpty, praeteritumReversePool, partizip2ReversePool]);

  useEffect(() => { if (verbs.length > 0) nextQuestion(); }, [verbs, mode, useSRS, praesensSubMode]);

  const recordResult = (ok: boolean) => {
    if (!currentVerb) return;
    let key: string;
    if (mode === 'praesens' && currentPraesensType === 'praesens') {
      key = srsKey(currentVerb.id, 'praesens', currentPronoun);
    } else if (mode === 'praesens' && currentPraesensType === 'form_to_infinitive') {
      key = reverseFormSrsKey(currentVerb.id, currentFormSource, currentPronoun);
    } else {
      key = srsKey(currentVerb.id, mode);
    }
    recordAnswer(key, ok);
    onAnswer(ok);
  };

  const handlePraesensSubmit = (e: React.FormEvent) => {
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

  const handleFormToInfinitiveSubmit = (e: React.FormEvent) => {
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

  const handleStammSubmit = (e: React.FormEvent) => {
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

  const emptyPoolMessage: Record<Mode, string> = {
    stammformen: 'Нет глаголов, у которых заполнены обе формы — Präteritum и Partizip II. Заполните их в «Панели управления», чтобы этот режим заработал.',
    multiple_choice: 'Нет глаголов с заполненной формой Partizip II. Заполните её в «Панели управления», чтобы этот режим заработал.',
    praesens: 'Нет данных для этого режима. Заполните спряжение Präsens (ich/du/er.../wir/ihr/sie), Präteritum и/или Partizip II в «Панели управления» — формы «wir» и «sie/Sie» подставляются автоматически, остальное нужно указать вручную.',
  };

  const isPoolEmpty =
    !isLoading && verbs.length > 0 && !currentVerb &&
    ((mode === 'stammformen' && stammPool.length === 0) ||
      (mode === 'multiple_choice' && mcPool.length === 0) ||
      (mode === 'praesens' && praesensPoolEmpty));

  return (
    <div>
      <div className="trainer-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div className="trainer-modes" style={{ margin: 0 }}>
          <button className={`mode-pill ${mode === 'stammformen' ? 'active' : ''}`} onClick={() => setMode('stammformen')}>3 Формы (Stammformen)</button>
          <button className={`mode-pill ${mode === 'praesens' ? 'active' : ''}`} onClick={() => setMode('praesens')}>Спряжение / Форма → Инфинитив</button>
          <button className={`mode-pill ${mode === 'multiple_choice' ? 'active' : ''}`} onClick={() => setMode('multiple_choice')}>Тест (4 варианта)</button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={() => setIsSrsOpen(true)}><Layers size={15} /> SRS</button>
          <button className="btn-secondary" onClick={() => setIsTableOpen(true)}><BookOpen size={15} /> Таблица глаголов</button>
        </div>
      </div>

      {mode === 'praesens' && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Направление:</span>
            <div className="trainer-modes" style={{ margin: 0 }}>
              <button
                className={`mode-pill ${praesensSubMode === 'both' ? 'active' : ''}`}
                onClick={() => handleSetPraesensSubMode('both')}
              >
                Вперемешку
              </button>
              <button
                className={`mode-pill ${praesensSubMode === 'praesens' ? 'active' : ''}`}
                onClick={() => handleSetPraesensSubMode('praesens')}
              >
                Только Спряжение
              </button>
              <button
                className={`mode-pill ${praesensSubMode === 'form_to_infinitive' ? 'active' : ''}`}
                onClick={() => handleSetPraesensSubMode('form_to_infinitive')}
              >
                Только Форма → Инфинитив
              </button>
            </div>
          </div>
          {praesensSubMode !== 'praesens' && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
              «Форма → Инфинитив» показывает форму Präsens (по лицам), Präteritum или Partizip II — в зависимости от того, что заполнено у глагола.
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>Загрузка глаголов...</div>
      ) : verbs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚡</div>
          <h3 style={{ margin: '0 0 8px' }}>В базе пока нет глаголов</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 460, margin: '0 auto 16px', fontSize: 14 }}>
            Чтобы тренировать формы глаголов (Präsens, Präteritum, Partizip II), добавьте глаголы через <strong>«Панель управления»</strong> (Админка), заполнив их формы.
          </p>
        </div>
      ) : isPoolEmpty ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✍️</div>
          <h3 style={{ margin: '0 0 8px' }}>Недостаточно данных для этого режима</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 460, margin: '0 auto', fontSize: 14 }}>
            {emptyPoolMessage[mode]}
          </p>
        </div>
      ) : currentVerb && mode === 'stammformen' ? (
        <StammformenQuiz
          verb={currentVerb} srsItem={srsMap[srsKey(currentVerb.id, mode)]} praeteritumInput={praeteritumInput} partizip2Input={partizip2Input} hilfsverbInput={hilfsverbInput} feedback={feedback}
          onPraeteritumChange={setPraeteritumInput} onPartizip2Change={setPartizip2Input} onHilfsverbChange={setHilfsverbInput}
          onSubmit={handleStammSubmit} onNext={nextQuestion} onInsertChar={(c) => setPraeteritumInput((p) => p + c)}
        />
      ) : currentVerb && mode === 'praesens' && currentPraesensType === 'praesens' ? (
        <PraesensQuiz
          verb={currentVerb} srsItem={srsMap[srsKey(currentVerb.id, 'praesens', currentPronoun)]} pronoun={currentPronoun} expected={expectedPraesens} userInput={userInput} feedback={feedback}
          onInputChange={setUserInput} onSubmit={handlePraesensSubmit} onNext={nextQuestion} onInsertChar={(c) => setUserInput((p) => p + c)}
        />
      ) : currentVerb && mode === 'praesens' && currentPraesensType === 'form_to_infinitive' ? (
        <FormToInfinitiveQuiz
          srsItem={srsMap[reverseFormSrsKey(currentVerb.id, currentFormSource, currentPronoun)]} formText={currentFormText} userInput={userInput} feedback={feedback}
          onInputChange={setUserInput} onSubmit={handleFormToInfinitiveSubmit} onNext={nextQuestion} onInsertChar={(c) => setUserInput((p) => p + c)}
        />
      ) : currentVerb && mode === 'multiple_choice' ? (
        <MultipleChoiceQuiz
          verb={currentVerb} srsItem={srsMap[srsKey(currentVerb.id, mode)]} options={mcOptions} feedback={feedback}
          onSelectOption={(opt) => {
            const ok = opt === currentVerb.partizip2;
            setFeedback({ isCorrect: ok, message: `${currentVerb.de} -> Partizip II: ${currentVerb.partizip2}` });
            recordResult(ok);
          }}
          onNext={nextQuestion}
        />
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>Загрузка...</div>
      )}

      {isTableOpen && <VerbsTableModal verbs={verbs} onClose={() => setIsTableOpen(false)} />}
      {isSrsOpen && (
        <VerbsSRSModal
          verbs={verbs}
          srsState={srsMap}
          useSRS={useSRS}
          onClose={() => setIsSrsOpen(false)}
          onResetSRS={resetSRS}
          onToggleUseSRS={setUseSRS}
        />
      )}
    </div>
  );
};
