import React from 'react';
import { Volume2, Eye, ArrowRight } from 'lucide-react';
import { AnalogClock } from './AnalogClock';
import { DigitalDisplay } from './DigitalDisplay';
import { speakGerman } from '../../utils/audio';
import type { GermanTimeOutput } from '../../utils/time-generator';

interface TimeFlashCardProps {
  timeData: GermanTimeOutput;
  displayMode: 'analog' | 'digital' | 'both';
  formatMode: 'informal' | 'formal' | 'both';
  isRevealed: boolean;
  onReveal: () => void;
  onNext: () => void;
}

export const TimeFlashCard: React.FC<TimeFlashCardProps> = ({
  timeData,
  displayMode,
  formatMode,
  isRevealed,
  onReveal,
  onNext,
}) => {
  const mainPhrase = formatMode === 'formal' ? timeData.official : timeData.colloquial;

  return (
    <div className="question-card flash-card">
      {displayMode === 'both' ? (
        <div className="flash-clocks">
          <AnalogClock hours={timeData.hours} minutes={timeData.minutes} />
          <DigitalDisplay hours={timeData.hours} minutes={timeData.minutes} />
        </div>
      ) : displayMode === 'analog' ? (
        <AnalogClock hours={timeData.hours} minutes={timeData.minutes} />
      ) : (
        <DigitalDisplay hours={timeData.hours} minutes={timeData.minutes} />
      )}

      {!isRevealed ? (
        <div className="flash-action">
          <button type="button" className="btn-primary btn-lg" onClick={onReveal} autoFocus>
            <Eye size={18} /> Показать ответ (Пробел / Enter)
          </button>
        </div>
      ) : (
        <div className="flash-reveal">
          <div className="flash-answer">
            <div className="flash-answer-main">{timeData.colloquial}</div>

            <div className="flash-answer-meta">
              <span>Время: <strong>{timeData.timeString24}</strong></span>
              <span>•</span>
              <span>Официально: <strong>{timeData.official}</strong></span>
            </div>

            {timeData.kurzVariant && (
              <div className="flash-kurz">💡 Разговорное использование: «{timeData.kurzVariant}»</div>
            )}

            <button type="button" className="icon-btn flash-audio" onClick={() => speakGerman(mainPhrase)} title="Озвучить" aria-label="Озвучить">
              <Volume2 size={18} />
            </button>
          </div>

          <button type="button" className="btn-primary btn-lg" onClick={onNext} autoFocus>
            Следующее время <ArrowRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
};
