import React from 'react';
import { Volume2 } from 'lucide-react';
import { AnalogClock } from './AnalogClock';
import { DigitalDisplay } from './DigitalDisplay';
import { UmlautBar } from '../UmlautBar';
import { FeedbackBox } from '../FeedbackBox';
import { speakGerman } from '../../utils/audio';
import { useUISettings } from '../../hooks/useUISettings';
import type { Feedback } from '../../types';

interface TimeQuizCardProps {
  hours: number;
  minutes: number;
  displayMode: 'analog' | 'digital';
  formatMode: 'informal' | 'formal';
  targetGerman: string;
  userInput: string;
  feedback: Feedback | null;
  onInputChange: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onNext: () => void;
  onInsertChar: (char: string) => void;
}

export const TimeQuizCard: React.FC<TimeQuizCardProps> = ({
  hours,
  minutes,
  displayMode,
  formatMode,
  targetGerman,
  userInput,
  feedback,
  onInputChange,
  onSubmit,
  onNext,
  onInsertChar,
}) => {
  const [settings] = useUISettings();

  return (
    <div className="question-card">
      <div className="question-prompt-label">
        {formatMode === 'informal' ? 'Разговорный формат (Viertel nach, halb...)' : 'Официальный формат (14 Uhr 25)'}
      </div>

      {displayMode === 'analog' ? (
        <AnalogClock hours={hours} minutes={minutes} />
      ) : (
        <DigitalDisplay hours={hours} minutes={minutes} />
      )}

      <form onSubmit={onSubmit} className="question-form question-form--top-spaced">
        <div className="input-group">
          <input
            type="text"
            className="text-input"
            placeholder={formatMode === 'informal' ? 'Например: Viertel nach drei' : 'Например: fünfzehn Uhr fünfzehn'}
            value={userInput}
            onChange={(e) => onInputChange(e.target.value)}
            disabled={feedback !== null}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            autoFocus
          />
          {feedback ? (
            <button
              key="next"
              type="button"
              className="btn-primary"
              onClick={onNext}
              autoFocus={settings.collapseKeyboardAfterAnswer}
            >
              Дальше (Enter)
            </button>
          ) : (
            <button key="check" type="submit" className="btn-primary">Проверить</button>
          )}
        </div>
      </form>

      {!feedback && <UmlautBar onInsert={onInsertChar} />}

      {feedback && (
        <FeedbackBox
          // If the caller didn't supply its own comparison, compare the typed text with the target phrase.
          feedback={{ ...feedback, checks: feedback.checks ?? [{ user: userInput, expected: targetGerman, isCorrect: feedback.isCorrect }] }}
          action={
            <button type="button" className="icon-btn" onClick={() => speakGerman(targetGerman)} title="Озвучить" aria-label="Озвучить">
              <Volume2 size={16} />
            </button>
          }
        />
      )}
    </div>
  );
};
