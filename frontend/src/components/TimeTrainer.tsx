import React, { useState, useEffect, useCallback } from 'react';
import { HelpCircle, Clock, Sparkles } from 'lucide-react';
import { TimeFlashCard } from './time/TimeFlashCard';
import { TimeRulesModal } from './time/TimeRulesModal';
import { getGermanTime, generateRandomTime } from '../utils/time-generator';

export const TimeTrainer: React.FC = () => {
  const [displayMode, setDisplayMode] = useState<'analog' | 'digital' | 'both'>('analog');
  const [stepMode, setStepMode] = useState<'any' | '5min'>('any');
  const [time, setTime] = useState({ hours: 14, minutes: 28 });
  const [isRevealed, setIsRevealed] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);

  const nextQuestion = useCallback(() => {
    const nextT = generateRandomTime(stepMode);
    setTime(nextT);
    setIsRevealed(false);
  }, [stepMode]);

  useEffect(() => {
    nextQuestion();
  }, [nextQuestion]);

  // Keyboard shortcut listener for space/enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || isRulesOpen) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!isRevealed) setIsRevealed(true);
        else nextQuestion();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRevealed, isRulesOpen, nextQuestion]);

  const timeData = getGermanTime(time.hours, time.minutes);

  return (
    <div>
      <div className="trainer-toolbar">
        <div className="trainer-modes trainer-modes--flush">
          <button className={`mode-pill ${stepMode === 'any' ? 'active' : ''}`} onClick={() => setStepMode('any')}>
            <Sparkles size={13} /> Любая минута (kurz vor / nach)
          </button>
          <button className={`mode-pill ${stepMode === '5min' ? 'active' : ''}`} onClick={() => setStepMode('5min')}>
            Шаг 5 минут
          </button>

          <div className="mode-divider" aria-hidden="true" />

          <button className={`mode-pill ${displayMode === 'analog' ? 'active' : ''}`} onClick={() => setDisplayMode('analog')}>
            <Clock size={13} /> Стрелки
          </button>
          <button className={`mode-pill ${displayMode === 'digital' ? 'active' : ''}`} onClick={() => setDisplayMode('digital')}>
            Цифры
          </button>
          <button className={`mode-pill ${displayMode === 'both' ? 'active' : ''}`} onClick={() => setDisplayMode('both')}>
            Оба (Стрелки + Цифры)
          </button>
        </div>
        <button className="btn-secondary" onClick={() => setIsRulesOpen(true)}>
          <HelpCircle size={15} /> Справка и правила
        </button>
      </div>

      <TimeFlashCard
        timeData={timeData}
        displayMode={displayMode}
        formatMode="both"
        isRevealed={isRevealed}
        onReveal={() => setIsRevealed(true)}
        onNext={nextQuestion}
      />

      {isRulesOpen && <TimeRulesModal onClose={() => setIsRulesOpen(false)} />}
    </div>
  );
};
