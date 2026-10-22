import React from 'react';
import { Volume2 } from 'lucide-react';
import { FeedbackBox } from '../FeedbackBox';
import { useUISettings } from '../../hooks/useUISettings';
import { speakGerman } from '../../utils/audio';
import type { Feedback, Word, SRSRecord } from '../../types';

interface MultipleChoiceQuizProps {
  verb: Word;
  srsItem?: SRSRecord;
  options: string[];
  feedback: Feedback | null;
  onSelectOption: (opt: string) => void;
  onNext: () => void;
}

export const MultipleChoiceQuiz: React.FC<MultipleChoiceQuizProps> = ({
  verb,
  srsItem,
  options,
  feedback,
  onSelectOption,
  onNext,
}) => {
  const [settings] = useUISettings();
  const currentBox = srsItem ? srsItem.box : 1;

  return (
    <div className="question-card">
      <div className="question-header">
        <div className="question-prompt-label">Partizip II тест</div>
        <span className={`leitner-badge box-${currentBox}`}>Ящик {currentBox}</span>
      </div>

      <div className="question-title-row">
        <h2 className="question-text">{verb.de}</h2>
        <button type="button" className="icon-btn" onClick={() => speakGerman(verb.de)} title="Озвучить" aria-label="Озвучить">
          <Volume2 size={18} />
        </button>
      </div>

      <div className="mc-grid">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            className="btn-secondary mc-option"
            disabled={feedback !== null}
            onClick={() => onSelectOption(opt)}
          >
            {opt}
          </button>
        ))}
      </div>

      {feedback && (
        <div className="mc-result">
          <FeedbackBox feedback={feedback} />
          <button type="button" className="btn-primary" onClick={onNext} autoFocus={settings.autoFocus}>
            Дальше (Enter)
          </button>
        </div>
      )}
    </div>
  );
};
