import React from 'react';
import { Volume2 } from 'lucide-react';
import { UmlautBar } from '../UmlautBar';
import { FeedbackBox } from '../FeedbackBox';
import { speakGerman } from '../../utils/audio';
import { useUISettings } from '../../hooks/useUISettings';
import type { Word, SRSRecord, Feedback } from '../../types';

interface PraesensQuizProps {
  verb: Word;
  srsItem?: SRSRecord;
  pronoun: string;
  expected: string;
  userInput: string;
  feedback: Feedback | null;
  onInputChange: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onNext: () => void;
  onInsertChar: (char: string) => void;
}

export const PraesensQuiz: React.FC<PraesensQuizProps> = ({
  verb,
  srsItem,
  pronoun,
  userInput,
  feedback,
  onInputChange,
  onSubmit,
  onNext,
  onInsertChar,
}) => {
  const [settings] = useUISettings();
  const currentBox = srsItem ? srsItem.box : 1;

  return (
    <div className="question-card">
      <div className="question-header">
        <div className="question-prompt-label">Спряжение (Präsens)</div>
        <span className={`leitner-badge box-${currentBox}`}>Ящик {currentBox}</span>
      </div>

      <div className="question-title-row">
        <h2 className="question-text">{verb.de}</h2>
        <button type="button" className="icon-btn" onClick={() => speakGerman(verb.de)} title="Озвучить" aria-label="Озвучить">
          <Volume2 size={18} />
        </button>
      </div>

      <div className="question-pronoun">{pronoun} ... ?</div>

      <form onSubmit={onSubmit} className="question-form">
        <div className="input-group">
          <input
            type="text"
            className="text-input"
            placeholder={`Форма для "${pronoun}"`}
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
            <button key="check" type="submit" className="btn-primary">Проверить</button>
          )}
        </div>
      </form>

      <UmlautBar onInsert={onInsertChar} />

      {feedback && <FeedbackBox feedback={feedback} />}
    </div>
  );
};
