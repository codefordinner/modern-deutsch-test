import React, { useState, useEffect } from 'react';
import { Sliders } from 'lucide-react';
import { NumbersQuizCard } from './numbers/NumbersQuizCard';
import { NumbersRangeModal } from './numbers/NumbersRangeModal';
import { numberToGermanWords } from '../utils/numbers-generator';
import type { ScoreState, NumberRangeSettings } from '../types';

interface NumbersTrainerProps {
  score: ScoreState;
  onAnswer: (isCorrect: boolean) => void;
}

export const NumbersTrainer: React.FC<NumbersTrainerProps> = ({ onAnswer }) => {
  const [directionMode, setDirectionMode] = useState<'de_to_num' | 'num_to_de' | 'mixed'>('num_to_de');
  const [activeDirection, setActiveDirection] = useState<'de_to_num' | 'num_to_de'>('num_to_de');
  const [settings, setSettings] = useState<NumberRangeSettings>({ min: 0, max: 100, allowLarge: false });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentNum, setCurrentNum] = useState<number>(0);
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; message: string } | null>(null);

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

    let isCorrect = false;
    const cleanIn = userInput.trim();
    if (cleanIn.length === 0) {
      isCorrect = false;
    } else if (activeDirection === 'num_to_de') {
      const cleanInput = cleanIn.toLowerCase().replace(/\s+/g, '');
      const cleanTarget = german.toLowerCase().replace(/\s+/g, '');
      isCorrect = cleanInput === cleanTarget;
    } else {
      isCorrect = parseInt(cleanIn.replace(/\s+/g, ''), 10) === currentNum;
    }

    setFeedback({
      isCorrect,
      message: isCorrect ? `Правильно: ${german}` : `Правильный ответ: ${activeDirection === 'num_to_de' ? german : currentNum}`,
    });
    onAnswer(isCorrect);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div className="trainer-modes" style={{ margin: 0 }}>
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
