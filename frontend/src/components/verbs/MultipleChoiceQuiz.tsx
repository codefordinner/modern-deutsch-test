import React from 'react';
import { Volume2, Check, X } from 'lucide-react';
import { speakGerman } from '../../utils/audio';
import type { Word, SRSRecord } from '../../types';

interface MultipleChoiceQuizProps {
  verb: Word;
  srsItem?: SRSRecord;
  options: string[];
  feedback: { isCorrect: boolean; message: string } | null;
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
          <div
            className={`feedback-box ${feedback.isCorrect ? 'feedback-success' : 'feedback-error'}`}
            role={feedback.isCorrect ? 'status' : 'alert'}
          >
            {feedback.isCorrect ? <Check size={20} /> : <X size={20} />}
            <div>
              <div className="feedback-title">{feedback.isCorrect ? 'Верно!' : 'Ошибка!'}</div>
              <div className="feedback-message">{feedback.message}</div>
            </div>
          </div>
          <button type="button" className="btn-primary" onClick={onNext} autoFocus>
            Дальше (Enter)
          </button>
        </div>
      )}
    </div>
  );
};
