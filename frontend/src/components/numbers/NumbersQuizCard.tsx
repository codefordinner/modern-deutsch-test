import React from 'react';
import { Volume2 } from 'lucide-react';
import { UmlautBar } from '../UmlautBar';
import { FeedbackBox } from '../FeedbackBox';
import { speakGerman } from '../../utils/audio';
import { useUISettings } from '../../hooks/useUISettings';
import type { Feedback } from '../../types';

interface NumbersQuizCardProps {
  currentNumber: number;
  expectedGerman: string;
  isGermanToDigits: boolean;
  userInput: string;
  feedback: Feedback | null;
  onInputChange: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onNext: () => void;
  onInsertChar: (char: string) => void;
}

export const NumbersQuizCard: React.FC<NumbersQuizCardProps> = ({
  currentNumber,
  expectedGerman,
  isGermanToDigits,
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
        {isGermanToDigits ? 'Напишите число цифрами' : 'Напишите число прописью по-немецки'}
      </div>

      <div className="question-title-row">
        <h2 className="question-text">{isGermanToDigits ? expectedGerman : currentNumber.toLocaleString('de-DE')}</h2>
        <button
          type="button"
          className="icon-btn quiz-audio-btn"
          onClick={() => speakGerman(expectedGerman)}
          title="Озвучить"
          aria-label="Озвучить"
        >
          <Volume2 size={18} />
        </button>
      </div>

      <form onSubmit={onSubmit} className="question-form">
        <div className="input-group">
          <input
            type="text"
            className="text-input"
            placeholder={isGermanToDigits ? 'Например: 42' : 'Например: zweiundvierzig'}
            value={userInput}
            onChange={(e) => onInputChange(e.target.value)}
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
            <button key="check" type="submit" className="btn-primary">
              Проверить
            </button>
          )}
        </div>
      </form>

      <UmlautBar onInsert={onInsertChar} />

      {feedback && <FeedbackBox feedback={feedback} />}
    </div>
  );
};
