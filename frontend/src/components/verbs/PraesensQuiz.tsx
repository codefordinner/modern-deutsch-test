import React from 'react';
import { Volume2 } from 'lucide-react';
import { UmlautBar } from '../UmlautBar';
import { FeedbackBox } from '../FeedbackBox';
import { speakGerman } from '../../utils/audio';
import { useUISettings } from '../../hooks/useUISettings';
import type { Word, SRSState, Feedback } from '../../types';

interface PraesensQuizProps {
  verb: Word;
  srsItem?: SRSState;
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 540, marginBottom: 12 }}>
        <div className="question-prompt-label" style={{ margin: 0 }}>Спряжение (Präsens)</div>
        <span className={`leitner-badge box-${currentBox}`}>Ящик {currentBox}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <h2 className="question-text">{verb.de}</h2>
        <button type="button" className="icon-btn" onClick={() => speakGerman(verb.de)} title="Озвучить">
          <Volume2 size={18} />
        </button>
      </div>

      <div style={{ fontSize: 22, fontWeight: 700, margin: '10px 0 20px', color: 'var(--accent-primary)' }}>
        {pronoun} ... ?
      </div>

      <form onSubmit={onSubmit} style={{ width: '100%' }}>
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
