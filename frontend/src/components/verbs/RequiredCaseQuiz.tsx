import React, { useEffect } from 'react';
import { Volume2 } from 'lucide-react';
import { LeitnerBadge } from '../srs/LeitnerBadge';
import { FeedbackSlot } from '../FeedbackBox';
import { speakGerman } from '../../utils/audio';
import { useUISettings } from '../../hooks/useUISettings';
import type { Feedback, SRSRecord, Word } from '../../types';

const options = [['nominativ', 'Nominativ'], ['akkusativ', 'Akkusativ'], ['dativ', 'Dativ'], ['genitiv', 'Genitiv']] as const;

interface RequiredCaseQuizProps {
  verb: Word;
  srsItem?: SRSRecord;
  useSRS: boolean;
  value: string;
  feedback: Feedback | null;
  onSelect: (value: string) => void;
  onNext: () => void;
}

export const RequiredCaseQuiz: React.FC<RequiredCaseQuizProps> = ({ verb, srsItem, useSRS, value, feedback, onSelect, onNext }) => {
  const [settings] = useUISettings();

  // The selected option becomes disabled after the answer. Keep Enter working
  // even when focus stays on that disabled button or on the card itself.
  useEffect(() => {
    if (!feedback) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') return;
      const target = event.target;
      if (target instanceof HTMLButtonElement && !target.disabled) return;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
      event.preventDefault();
      onNext();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [feedback, onNext]);

  return (
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
              </button>
            );
          })}
        </div>
        {feedback && <button type="button" className="btn-primary" onClick={onNext} autoFocus={settings.autoFocus}>Дальше (Enter)</button>}
      </div>
      <FeedbackSlot feedback={feedback} />
    </div>
  );
};
