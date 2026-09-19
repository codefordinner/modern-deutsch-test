import React from 'react';
import { Volume2, Check, X } from 'lucide-react';
import { UmlautBar } from '../UmlautBar';
import { speakGerman } from '../../utils/audio';
import type { Word, SRSState } from '../../types';

interface StammformenQuizProps {
  verb: Word;
  srsItem?: SRSState;
  praeteritumInput: string;
  partizip2Input: string;
  hilfsverbInput: string;
  feedback: { isCorrect: boolean; message: string } | null;
  onPraeteritumChange: (val: string) => void;
  onPartizip2Change: (val: string) => void;
  onHilfsverbChange: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onNext: () => void;
  onInsertChar: (char: string) => void;
}

export const StammformenQuiz: React.FC<StammformenQuizProps> = ({
  verb,
  srsItem,
  praeteritumInput,
  partizip2Input,
  hilfsverbInput,
  feedback,
  onPraeteritumChange,
  onPartizip2Change,
  onHilfsverbChange,
  onSubmit,
  onNext,
  onInsertChar: _onInsertChar,
}) => {
  const [activeField, setActiveField] = React.useState<'praeteritum' | 'partizip2'>('praeteritum');
  const currentBox = srsItem ? srsItem.box : 1;

  const handleInsert = (char: string) => {
    if (activeField === 'partizip2') {
      onPartizip2Change(partizip2Input + char);
    } else {
      onPraeteritumChange(praeteritumInput + char);
    }
  };

  return (
    <div className="question-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 540, marginBottom: 12 }}>
        <div className="question-prompt-label" style={{ margin: 0 }}>3 Основные формы глагола</div>
        <span className={`leitner-badge box-${currentBox}`}>Ящик {currentBox}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <h2 className="question-text">{verb.de}</h2>
        <button type="button" className="icon-btn" onClick={() => speakGerman(verb.de)} title="Озвучить">
          <Volume2 size={18} />
        </button>
      </div>
      <div className="question-subtext">{verb.ru}</div>

      <form onSubmit={onSubmit} style={{ width: '100%', maxWidth: 540 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', gap: 10, marginBottom: 14 }}>
          <input
            type="text"
            className="text-input"
            placeholder="Präteritum (ging)"
            value={praeteritumInput}
            onFocus={() => setActiveField('praeteritum')}
            onChange={(e) => onPraeteritumChange(e.target.value)}
            autoFocus
          />
          <input
            type="text"
            className="text-input"
            placeholder="Partizip II (gegangen)"
            value={partizip2Input}
            onFocus={() => setActiveField('partizip2')}
            onChange={(e) => onPartizip2Change(e.target.value)}
          />
          <select
            className="text-input"
            value={hilfsverbInput}
            onChange={(e) => onHilfsverbChange(e.target.value)}
          >
            <option value="haben">haben</option>
            <option value="sein">sein</option>
          </select>
        </div>

        {feedback ? (
          <button type="button" className="btn-primary" style={{ width: '100%' }} onClick={onNext} autoFocus>
            Дальше (Enter)
          </button>
        ) : (
          <button type="submit" className="btn-primary" style={{ width: '100%' }}>
            Проверить
          </button>
        )}
      </form>

      <UmlautBar onInsert={handleInsert} />

      {feedback && (
        <div className={`feedback-box ${feedback.isCorrect ? 'feedback-success' : 'feedback-error'}`}>
          {feedback.isCorrect ? <Check size={20} /> : <X size={20} />}
          <div>
            <div style={{ fontWeight: 700 }}>{feedback.isCorrect ? 'Верно!' : 'Ошибка!'}</div>
            <div style={{ fontSize: 14 }}>{feedback.message}</div>
          </div>
        </div>
      )}
    </div>
  );
};
