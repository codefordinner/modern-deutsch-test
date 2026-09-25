import React, { useState, useEffect } from 'react';
import { Sliders } from 'lucide-react';
import { NumbersQuizCard } from './numbers/NumbersQuizCard';
import { NumbersRangeModal } from './numbers/NumbersRangeModal';
import { numberToGermanWords } from '../utils/numbers-generator';
import { answersMatch, cleanText, currentMatchOptions, parseTypedInteger } from '../utils/answerMatch';
import type { NumberRangeSettings, Feedback } from '../types';

interface NumbersTrainerProps {
  onAnswer: (isCorrect: boolean) => void;
}

// Spaces never matter in a German number word: "zwei und vierzig" is as good as "zweiundvierzig".
const withoutSpaces = (text: string) => cleanText(text).replace(/ /g, '');

export const NumbersTrainer: React.FC<NumbersTrainerProps> = ({ onAnswer }) => {
  const [directionMode, setDirectionMode] = useState<'de_to_num' | 'num_to_de' | 'mixed'>('num_to_de');
  const [activeDirection, setActiveDirection] = useState<'de_to_num' | 'num_to_de'>('num_to_de');
  const [settings, setSettings] = useState<NumberRangeSettings>({ min: 0, max: 100, allowLarge: false });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentNum, setCurrentNum] = useState<number>(0);
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const nextQuestion = () => {
    const min = settings.min;
    const max = settings.max;
    const num = Math.floor(Math.random() * (max - min + 1)) + min;
    setCurrentNum(num);
    setUserInput('');
    setFeedback(null);

    if (directionMode === 'mixed') {
      setActiveDirection(Math.random() > 0.5 ? 'num_to_de' : 'de_to_num');
    } else {
      setActiveDirection(directionMode);
    }
  };

  useEffect(() => { nextQuestion(); }, [settings, directionMode]);

  const german = numberToGermanWords(currentNum);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (feedback) { nextQuestion(); return; }

    const isCorrect =
      activeDirection === 'num_to_de'
        ? answersMatch(withoutSpaces(userInput), withoutSpaces(german), currentMatchOptions())
        : parseTypedInteger(userInput) === currentNum;

    const expectedAnswer = activeDirection === 'num_to_de' ? german : String(currentNum);
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
          <button className={`mode-pill ${directionMode === 'num_to_de' ? 'active' : ''}`} onClick={() => setDirectionMode('num_to_de')}>Цифры → Немецкий</button>
          <button className={`mode-pill ${directionMode === 'de_to_num' ? 'active' : ''}`} onClick={() => setDirectionMode('de_to_num')}>Немецкий → Цифры</button>
          <button className={`mode-pill ${directionMode === 'mixed' ? 'active' : ''}`} onClick={() => setDirectionMode('mixed')}>Случайно (Оба)</button>
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
