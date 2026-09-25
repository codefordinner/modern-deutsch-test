import React from 'react';
import { Volume2 } from 'lucide-react';
import { UmlautBar } from '../UmlautBar';
import { FeedbackBox } from '../FeedbackBox';
import { speakGerman } from '../../utils/audio';
import { useUISettings } from '../../hooks/useUISettings';
import type { Word, SRSRecord, Feedback } from '../../types';

interface StammformenQuizProps {
  verb: Word;
  srsItem?: SRSRecord;
  praeteritumInput: string;
  partizip2Input: string;
  hilfsverbInput: string;
  feedback: Feedback | null;
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
  const [settings] = useUISettings();
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
      <div className="question-header">
        <div className="question-prompt-label">3 Основные формы глагола</div>
        <span className={`leitner-badge box-${currentBox}`}>Ящик {currentBox}</span>
      </div>

      <div className="question-title-row">
        <h2 className="question-text">{verb.de}</h2>
        <button type="button" className="icon-btn" onClick={() => speakGerman(verb.de)} title="Озвучить" aria-label="Озвучить">
          <Volume2 size={18} />
        </button>
      </div>

      <form onSubmit={onSubmit} className="question-form question-form--wide">
        <div className="quiz-grid-3 quiz-fields">
          <input
            type="text"
            className="text-input"
            placeholder="Präteritum (ging)"
            value={praeteritumInput}
            onFocus={() => setActiveField('praeteritum')}
            onChange={(e) => onPraeteritumChange(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            autoFocus
          />
          <input
            type="text"
            className="text-input"
            placeholder="Partizip II (gegangen)"
            value={partizip2Input}
            onFocus={() => setActiveField('partizip2')}
            onChange={(e) => onPartizip2Change(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
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
          <button
            key="next"
            type="button"
            className="btn-primary btn-block"
            onClick={onNext}
            autoFocus={settings.collapseKeyboardAfterAnswer}
          >
            Дальше (Enter)
          </button>
        ) : (
          <button key="check" type="submit" className="btn-primary btn-block">
            Проверить
          </button>
        )}
      </form>

      <UmlautBar onInsert={handleInsert} />

      {feedback && <FeedbackBox feedback={feedback} />}
    </div>
  );
};
