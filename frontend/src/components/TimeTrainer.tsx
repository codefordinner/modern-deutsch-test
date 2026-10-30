import React, { useState, useEffect, useCallback } from 'react';
import { HelpCircle, Clock, Sparkles } from 'lucide-react';
import { TimeFlashCard } from './time/TimeFlashCard';
import { TimeRulesModal } from './time/TimeRulesModal';
import { ModeSwitch } from './ModeSwitch';
import { ToolbarButton } from './ToolbarButton';
import { oneOf, usePersistentState } from '../hooks/usePersistentState';
import { getGermanTime, generateRandomTime } from '../utils/time-generator';

type DisplayMode = 'analog' | 'digital' | 'both';
type StepMode = 'any' | '5min';

export const TimeTrainer: React.FC = () => {
  const [displayMode, setDisplayMode] = usePersistentState<DisplayMode>(
    'time_display_mode',
    'analog',
    oneOf<DisplayMode>(['analog', 'digital', 'both'], 'analog')
  );
  const [stepMode, setStepMode] = usePersistentState<StepMode>('time_step_mode', 'any', oneOf<StepMode>(['any', '5min'], 'any'));
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
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || isRulesOpen) return;
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
        <div className="toolbar-filters">
          <ModeSwitch<StepMode>
            ariaLabel="Какие минуты"
            value={stepMode}
            onChange={setStepMode}
            options={[
              { value: 'any', label: 'Любая минута (kurz vor / nach)', short: 'Любая минута', icon: <Sparkles size={13} /> },
              { value: '5min', label: 'Шаг 5 минут', short: 'Шаг 5 минут' },
            ]}
          />
          <ModeSwitch<DisplayMode>
            ariaLabel="Вид времени"
            value={displayMode}
            onChange={setDisplayMode}
            options={[
              { value: 'analog', label: 'Стрелки', short: 'Стрелки', icon: <Clock size={13} /> },
              { value: 'digital', label: 'Цифры', short: 'Цифры' },
              { value: 'both', label: 'Оба (Стрелки + Цифры)', short: 'Стрелки + цифры' },
            ]}
          />
        </div>
        <ToolbarButton icon={<HelpCircle size={15} />} label="Справка и правила" onClick={() => setIsRulesOpen(true)} />
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
