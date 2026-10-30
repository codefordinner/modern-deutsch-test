import React from 'react';
import { Volume2 } from 'lucide-react';
import { LeitnerBadge } from '../srs/LeitnerBadge';
import { UmlautBar } from '../UmlautBar';
import { FeedbackSlot } from '../FeedbackBox';
import { speakGerman } from '../../utils/audio';
import { useUISettings } from '../../hooks/useUISettings';
import type { SRSRecord, Feedback } from '../../types';

interface FormToInfinitiveQuizProps {
  srsItem?: SRSRecord;
  formText: string;
  /** Präsens cards: the pronoun shown with the form ("ihr geht"), so er/sie/es and ihr are not the same question. */
  pronoun?: string;
  useSRS?: boolean;
  userInput: string;
  feedback: Feedback | null;
  onInputChange: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onNext: () => void;
  onInsertChar: (char: string) => void;
}

export const FormToInfinitiveQuiz: React.FC<FormToInfinitiveQuizProps> = ({
  srsItem,
  formText,
  pronoun,
  useSRS = true,
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
        <div className="question-prompt-label">Форма → Инфинитив</div>
        <LeitnerBadge box={currentBox} useSRS={useSRS} />
      </div>

      <div className="question-title-row">
        <h2 className="question-text">{pronoun ? `${pronoun} ${formText}` : formText}</h2>
        <button type="button" className="icon-btn" onClick={() => speakGerman(formText)} title="Озвучить" aria-label="Озвучить">
          <Volume2 size={18} />
        </button>
      </div>

      <div className="question-subtext">Напишите глагол в инфинитиве (начальной форме)</div>

      <form onSubmit={onSubmit} className="question-form">
        <div className="input-group">
          <input
            type="text"
            className="text-input"
            placeholder="gehen, sein, machen..."
            value={userInput}
            onChange={(e) => onInputChange(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            autoFocus={settings.autoFocus}
          />
          {feedback ? (
            <button
              key="next"
              type="button"
              className="btn-primary"
              onClick={onNext}
              autoFocus={settings.autoFocus && settings.collapseKeyboardAfterAnswer}
            >
              Дальше (Enter)
            </button>
          ) : (
            <button key="check" type="submit" className="btn-primary">Проверить</button>
          )}
        </div>
      </form>

      <UmlautBar onInsert={onInsertChar} />

      <FeedbackSlot feedback={feedback} />
    </div>
  );
};
