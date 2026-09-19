import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BookOpen, Layers } from 'lucide-react';
import { VerbsTableModal } from './verbs/VerbsTableModal';
import { VerbsSRSModal } from './verbs/VerbsSRSModal';
import { PraesensQuiz } from './verbs/PraesensQuiz';
import { StammformenQuiz } from './verbs/StammformenQuiz';
import { MultipleChoiceQuiz } from './verbs/MultipleChoiceQuiz';
import { getDueCardsByKey, updateSRS } from '../utils/srs';
import type { Word, ScoreState, SRSState } from '../types';

const pronouns = ['ich', 'du', 'er/sie/es', 'wir', 'ihr', 'sie/Sie'] as const;

export const VerbsTrainer: React.FC<{ score: ScoreState; onAnswer: (ok: boolean) => void }> = ({ onAnswer }) => {
  const [mode, setMode] = useState<'praesens' | 'stammformen' | 'multiple_choice'>('stammformen');
  const [verbs, setVerbs] = useState<Word[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentVerb, setCurrentVerb] = useState<Word | null>(null);
  const [currentPronoun, setCurrentPronoun] = useState<string>('du');
  const [expectedPraesens, setExpectedPraesens] = useState('');
  const [userInput, setUserInput] = useState('');
  const [praeteritumInput, setPraeteritumInput] = useState('');
  const [partizip2Input, setPartizip2Input] = useState('');
  const [hilfsverbInput, setHilfsverbInput] = useState('haben');
  const [mcOptions, setMcOptions] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; message: string } | null>(null);
  const [isTableOpen, setIsTableOpen] = useState(false);
  const [isSrsOpen, setIsSrsOpen] = useState(false);
  const [useSRS, setUseSRS] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('verbs_use_srs');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [srsMap, setSrsMap] = useState<Record<string, SRSState>>(() => {
    try { return JSON.parse(localStorage.getItem('verbs_srs_state') || '{}'); } catch { return {}; }
  });

  const srsMapRef = useRef(srsMap);
  srsMapRef.current = srsMap;

  // Each verb quiz mode (Präsens / 3 Formen / Multiple choice) tracks its
  // own Leitner box per verb, so mastering one form doesn't hide the others.
  // Within Präsens, each pronoun (ich/du/er-sie-es/wir/ihr/sie-Sie) additionally
  // gets its own box, so e.g. mastering "ihr" doesn't hide that "du" still
  // needs practice — they're separate cards, not one shared box per verb.
  const srsKey = (verbId: string, quizMode: string, pronoun?: string) =>
    pronoun ? `${verbId}:${quizMode}:${pronoun}` : `${verbId}:${quizMode}`;

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

  const handleToggleUseSRS = (val: boolean) => {
    setUseSRS(val);
    localStorage.setItem('verbs_use_srs', JSON.stringify(val));
  };

  const computeExpectedPraesens = (verb: Word, p: string): string => {
    const stem = verb.de.replace(/en$/, '').replace(/n$/, '');
    if (p === 'ich') return verb.praesensIch || (verb.de === 'sein' ? 'bin' : stem + 'e');
    if (p === 'du') return verb.praesensDu || (verb.de === 'sein' ? 'bist' : stem + 'st');
    if (p === 'er/sie/es') return verb.praesensErSieEs || (verb.de === 'sein' ? 'ist' : stem + 't');
    if (p === 'wir') return verb.praesensWir || (verb.de === 'sein' ? 'sind' : verb.de);
    if (p === 'ihr') return verb.praesensIhr || (verb.de === 'sein' ? 'seid' : stem + 't');
    return verb.praesensSie || (verb.de === 'sein' ? 'sind' : verb.de); // sie/Sie
  };

  const nextQuestion = useCallback(() => {
    if (verbs.length === 0) return;

    setUserInput('');
    setPraeteritumInput('');
    setPartizip2Input('');
    setHilfsverbInput('haben');
    setFeedback(null);

    if (mode === 'praesens') {
      // Every (verb, pronoun) pair is its own card with its own Leitner box,
      // so the pool to pick from spans all verbs × all six pronouns.
      type Card = { verb: Word; pronoun: string };
      const cards: Card[] = [];
      for (const v of verbs) {
        for (const p of pronouns) cards.push({ verb: v, pronoun: p });
      }

      let chosen: Card;
      if (useSRS) {
        const due = getDueCardsByKey(cards, srsMapRef.current, (c) => srsKey(c.verb.id, mode, c.pronoun));
        chosen = due.length > 0 ? due[Math.floor(Math.random() * due.length)] : cards[Math.floor(Math.random() * cards.length)];
      } else {
        chosen = cards[Math.floor(Math.random() * cards.length)];
      }

      setCurrentVerb(chosen.verb);
      setCurrentPronoun(chosen.pronoun);
      setExpectedPraesens(computeExpectedPraesens(chosen.verb, chosen.pronoun));
      return;
    }

    // stammformen / multiple_choice: one card, one box, per verb.
    let chosen: Word;
    if (useSRS) {
      const due = getDueCardsByKey(verbs, srsMapRef.current, (v) => srsKey(v.id, mode));
      chosen = due.length > 0 ? due[Math.floor(Math.random() * due.length)] : verbs[Math.floor(Math.random() * verbs.length)];
    } else {
      chosen = verbs[Math.floor(Math.random() * verbs.length)];
    }
    setCurrentVerb(chosen);

    if (mode === 'multiple_choice') {
      const correctP2 = chosen.partizip2 || `ge${chosen.de.replace(/en$/, '')}t`;
      const fake1 = `ge${chosen.de.replace(/en$/, '')}en`;
      const fake2 = `be${chosen.de.replace(/en$/, '')}t`;
      const fake3 = `ver${chosen.de.replace(/en$/, '')}t`;
      setMcOptions([correctP2, fake1, fake2, fake3].sort(() => Math.random() - 0.5));
    }
  }, [verbs, useSRS, mode]);

  useEffect(() => { if (verbs.length > 0) nextQuestion(); }, [verbs, mode, useSRS]);

  const recordResult = (ok: boolean) => {
    if (!currentVerb) return;
    if (useSRS) {
      const key = mode === 'praesens' ? srsKey(currentVerb.id, mode, currentPronoun) : srsKey(currentVerb.id, mode);
      const updated = updateSRS(srsMap, key, ok);
      setSrsMap(updated);
      localStorage.setItem('verbs_srs_state', JSON.stringify(updated));
    }
    onAnswer(ok);
  };

  const handlePraesensSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (feedback) { nextQuestion(); return; }
    if (!currentVerb) return;
    const cleanIn = userInput.trim().toLowerCase();
    const ok = cleanIn.length > 0 && cleanIn === expectedPraesens.toLowerCase();
    setFeedback({ isCorrect: ok, message: ok ? `Верно: ${currentPronoun} ${expectedPraesens}` : `Правильно: ${currentPronoun} ${expectedPraesens}` });
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
    setFeedback({ isCorrect: ok, message: `${currentVerb.de} – ${currentVerb.praeteritum || '—'} – ${currentVerb.partizip2 || '—'} (${currentVerb.hilfsverb || 'haben'})` });
    recordResult(ok);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div className="trainer-modes" style={{ margin: 0 }}>
          <button className={`mode-pill ${mode === 'stammformen' ? 'active' : ''}`} onClick={() => setMode('stammformen')}>3 Формы (Stammformen)</button>
          <button className={`mode-pill ${mode === 'praesens' ? 'active' : ''}`} onClick={() => setMode('praesens')}>Спряжение (Präsens)</button>
          <button className={`mode-pill ${mode === 'multiple_choice' ? 'active' : ''}`} onClick={() => setMode('multiple_choice')}>Тест (4 варианта)</button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={() => setIsSrsOpen(true)}><Layers size={15} /> SRS</button>
          <button className="btn-secondary" onClick={() => setIsTableOpen(true)}><BookOpen size={15} /> Таблица глаголов</button>
        </div>
      </div>

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
      ) : currentVerb && mode === 'stammformen' ? (
        <StammformenQuiz
          verb={currentVerb} srsItem={srsMap[srsKey(currentVerb.id, mode)]} praeteritumInput={praeteritumInput} partizip2Input={partizip2Input} hilfsverbInput={hilfsverbInput} feedback={feedback}
          onPraeteritumChange={setPraeteritumInput} onPartizip2Change={setPartizip2Input} onHilfsverbChange={setHilfsverbInput}
          onSubmit={handleStammSubmit} onNext={nextQuestion} onInsertChar={(c) => setPraeteritumInput((p) => p + c)}
        />
      ) : currentVerb && mode === 'praesens' ? (
        <PraesensQuiz
          verb={currentVerb} srsItem={srsMap[srsKey(currentVerb.id, mode, currentPronoun)]} pronoun={currentPronoun} expected={expectedPraesens} userInput={userInput} feedback={feedback}
          onInputChange={setUserInput} onSubmit={handlePraesensSubmit} onNext={nextQuestion} onInsertChar={(c) => setUserInput((p) => p + c)}
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
          pronouns={pronouns as unknown as string[]}
          srsState={srsMap}
          useSRS={useSRS}
          onClose={() => setIsSrsOpen(false)}
          onResetSRS={() => { setSrsMap({}); localStorage.removeItem('verbs_srs_state'); }}
          onToggleUseSRS={handleToggleUseSRS}
        />
      )}
    </div>
  );
};
