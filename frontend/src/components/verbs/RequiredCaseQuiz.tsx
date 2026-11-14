import React from 'react';
import { Volume2 } from 'lucide-react';
import { LeitnerBadge } from '../srs/LeitnerBadge';
import { FeedbackSlot } from '../FeedbackBox';
import { speakGerman } from '../../utils/audio';
import type { Feedback, SRSRecord, Word } from '../../types';

const options = [['nominativ', 'Nominativ'], ['akkusativ', 'Akkusativ'], ['dativ', 'Dativ'], ['genitiv', 'Genitiv']] as const;

export const RequiredCaseQuiz: React.FC<{ verb: Word; srsItem?: SRSRecord; useSRS: boolean; value: string; feedback: Feedback | null; onSelect: (value: string) => void; onNext: () => void }> = ({ verb, srsItem, useSRS, value, feedback, onSelect, onNext }) => (
  <div className="question-card">
    <div className="question-header"><div className="question-prompt-label">Управление глагола</div><LeitnerBadge box={srsItem?.box ?? 1} useSRS={useSRS} /></div>
    <div className="question-title-row"><h2 className="question-text">{verb.de}</h2><button type="button" className="icon-btn" onClick={() => speakGerman(verb.de)} title="Озвучить" aria-label="Озвучить"><Volume2 size={18} /></button></div>
    <div className="question-subtext">Выберите падеж, которого требует глагол</div>
    <div className="case-answers">
      <div className="case-grid" role="group" aria-label="Выберите падеж">
        {options.map(([key, label]) => {
          const state = !feedback ? '' : key === verb.requiredCase ? 'is-correct' : value === key ? 'is-wrong' : 'is-dim';
          return (
            <button
              key={key}
              type="button"
              className={`case-btn ${state}`}
              disabled={feedback !== null}
              aria-pressed={value === key}
              onClick={() => onSelect(key)}
            >
              <span className="case-btn-label">{label}</span>
              <span className="case-btn-hint">{key === 'nominativ' ? 'кто? что?' : key === 'akkusativ' ? 'кого? что?' : key === 'dativ' ? 'кому? чему?' : 'кого? чего?'}</span>
            </button>
          );
        })}
      </div>
      {feedback && <button type="button" className="btn-primary" onClick={onNext}>Дальше (Enter)</button>}
    </div>
    <FeedbackSlot feedback={feedback} />
  </div>
);
