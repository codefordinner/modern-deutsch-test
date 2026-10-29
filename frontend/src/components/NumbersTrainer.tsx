import React, { useState, useEffect, useCallback } from 'react';
import { Sliders } from 'lucide-react';
import { NumbersQuizCard } from './numbers/NumbersQuizCard';
import { NumbersRangeModal } from './numbers/NumbersRangeModal';
import { oneOf, usePersistentState } from '../hooks/usePersistentState';
import { germanNumberVariants } from '../utils/numbers-generator';
import { pickClosestAnswer } from '../utils/answerDiff';
import { answersMatch, cleanText, currentMatchOptions, parseTypedInteger } from '../utils/answerMatch';
import type { NumberRangeSettings, Feedback } from '../types';

interface NumbersTrainerProps {
  onAnswer: (isCorrect: boolean) => void;
}

type DirectionMode = 'de_to_num' | 'num_to_de' | 'mixed';

const DEFAULT_RANGE: NumberRangeSettings = { min: 0, max: 100 };

function sanitizeRange(raw: unknown): NumberRangeSettings {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const min = Number(r.min);
  const max = Number(r.max);
  // numberToGerman handles 0 … 999 999 999; anything else in storage is junk.
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max <= min || max > 999999999) return DEFAULT_RANGE;
  return { min, max };
}

// Spaces never matter in a German number word: "zwei und vierzig" is as good as "zweiundvierzig".
const withoutSpaces = (text: string) => cleanText(text).replace(/ /g, '');

export const NumbersTrainer: React.FC<NumbersTrainerProps> = ({ onAnswer }) => {
  const [directionMode, setDirectionMode] = usePersistentState<DirectionMode>(
    'numbers_direction',
    'num_to_de',
    oneOf<DirectionMode>(['de_to_num', 'num_to_de', 'mixed'], 'num_to_de')
  );
  const [activeDirection, setActiveDirection] = useState<'de_to_num' | 'num_to_de'>('num_to_de');
  const [settings, setSettings] = usePersistentState<NumberRangeSettings>('numbers_range', DEFAULT_RANGE, sanitizeRange);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentNum, setCurrentNum] = useState<number>(0);
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const nextQuestion = useCallback(() => {
    const { min, max } = settings;
    const num = Math.floor(Math.random() * (max - min + 1)) + min;
    setCurrentNum(num);
    setUserInput('');
    setFeedback(null);

    if (directionMode === 'mixed') {
      setActiveDirection(Math.random() > 0.5 ? 'num_to_de' : 'de_to_num');
    } else {
      setActiveDirection(directionMode);
    }
  }, [settings, directionMode]);

  useEffect(() => { nextQuestion(); }, [nextQuestion]);

  // All accepted spellings; the first is the canonical one (shown as the question and as "Правильно").
  const variants = germanNumberVariants(currentNum);
  const german = variants[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (feedback) { nextQuestion(); return; }

    const isCorrect =
      activeDirection === 'num_to_de'
        ? answersMatch(withoutSpaces(userInput), variants.map(withoutSpaces), currentMatchOptions())
        : parseTypedInteger(userInput) === currentNum;

    // For a wrong answer, diff against the accepted spelling the input is closest to ("hundert" vs "einhundert").
    const expectedAnswer =
      activeDirection === 'num_to_de' ? pickClosestAnswer(userInput, variants, { ignoreSpaces: true }) : String(currentNum);
    setFeedback({
      isCorrect,
      message: `Правильно: ${german}`,
      // Spaces are never an error here ("zwei und vierzig" is accepted), so they're ignored in the diff too.
      checks: [{ user: cleanText(userInput), expected: expectedAnswer, isCorrect, ignoreSpaces: true }],
    });
    onAnswer(isCorrect);
  };

  return (
    <div>
      <div className="trainer-toolbar">
        <div className="trainer-modes trainer-modes--flush">
          <button type="button" className={`mode-pill ${directionMode === 'num_to_de' ? 'active' : ''}`} aria-pressed={directionMode === 'num_to_de'} onClick={() => setDirectionMode('num_to_de')}>Цифры → Немецкий</button>
          <button type="button" className={`mode-pill ${directionMode === 'de_to_num' ? 'active' : ''}`} aria-pressed={directionMode === 'de_to_num'} onClick={() => setDirectionMode('de_to_num')}>Немецкий → Цифры</button>
          <button type="button" className={`mode-pill ${directionMode === 'mixed' ? 'active' : ''}`} aria-pressed={directionMode === 'mixed'} onClick={() => setDirectionMode('mixed')}>Случайно (Оба)</button>
        </div>
        <button className="btn-secondary" onClick={() => setIsModalOpen(true)}>
          <Sliders size={15} /> Диапазон: {settings.min} – {settings.max}
        </button>
      </div>

      <NumbersQuizCard
        currentNumber={currentNum}
        expectedGerman={german}
        isGermanToDigits={activeDirection === 'de_to_num'}
        userInput={userInput}
        feedback={feedback}
        onInputChange={setUserInput}
        onSubmit={handleSubmit}
        onNext={nextQuestion}
        onInsertChar={(char) => setUserInput((prev) => prev + char)}
      />

      {isModalOpen && (
        <NumbersRangeModal settings={settings} onClose={() => setIsModalOpen(false)} onSave={setSettings} />
      )}
    </div>
  );
};
