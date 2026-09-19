import React from 'react';
import { Volume2, Check, X } from 'lucide-react';
import { speakGerman } from '../../utils/audio';
import type { Word, SRSState } from '../../types';

interface MultipleChoiceQuizProps {
  verb: Word;
  srsItem?: SRSState;
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 500, marginBottom: 12 }}>
        <div className="question-prompt-label" style={{ margin: 0 }}>Partizip II тест</div>
        <span className={`leitner-badge box-${currentBox}`}>Ящик {currentBox}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <h2 className="question-text">{verb.de} ({verb.ru})</h2>
        <button type="button" className="icon-btn" onClick={() => speakGerman(verb.de)} title="Озвучить">
          <Volume2 size={18} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: '100%', maxWidth: 500, margin: '20px 0' }}>
        {options.map((opt, idx) => (
          <button
            key={idx}
            type="button"
            className="btn-secondary"
            style={{ padding: '14px', fontSize: 16, fontWeight: 700 }}
            disabled={feedback !== null}
            onClick={() => onSelectOption(opt)}
          >
            {opt}
          </button>
        ))}
      </div>

      {feedback && (
        <div style={{ width: '100%', maxWidth: 500, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className={`feedback-box ${feedback.isCorrect ? 'feedback-success' : 'feedback-error'}`} style={{ width: '100%', margin: 0 }}>
            {feedback.isCorrect ? <Check size={20} /> : <X size={20} />}
            <div>
              <div style={{ fontWeight: 700 }}>{feedback.isCorrect ? 'Верно!' : 'Ошибка!'}</div>
              <div style={{ fontSize: 14 }}>{feedback.message}</div>
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
