import React from 'react';
import { Volume2 } from 'lucide-react';
import { LeitnerBadge } from '../srs/LeitnerBadge';
import { FeedbackSlot } from '../FeedbackBox';
import { speakGerman } from '../../utils/audio';
import type { Feedback, SRSRecord, Word } from '../../types';

const options = [['nominativ', 'Nominativ'], ['akkusativ', 'Akkusativ'], ['dativ', 'Dativ'], ['genitiv', 'Genitiv']] as const;

export const RequiredCaseQuiz: React.FC<{ verb: Word; srsItem?: SRSRecord; useSRS: boolean; value: string; feedback: Feedback | null; onChange: (value: string) => void; onSubmit: (e: React.FormEvent) => void; onNext: () => void }> = ({ verb, srsItem, useSRS, value, feedback, onChange, onSubmit, onNext }) => (
  <div className="question-card">
    <div className="question-header"><div className="question-prompt-label">Управление глагола</div><LeitnerBadge box={srsItem?.box ?? 1} useSRS={useSRS} /></div>
    <div className="question-title-row"><h2 className="question-text">{verb.de}</h2><button type="button" className="icon-btn" onClick={() => speakGerman(verb.de)} title="Озвучить" aria-label="Озвучить"><Volume2 size={18} /></button></div>
    <div className="question-subtext">Какой падеж обычно используется с этим глаголом?</div>
    <form onSubmit={onSubmit} className="question-form"><select className="text-input" value={value} onChange={(e) => onChange(e.target.value)} disabled={feedback !== null}>{options.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>{feedback ? <button type="button" className="btn-primary" onClick={onNext}>Дальше (Enter)</button> : <button type="submit" className="btn-primary">Проверить</button>}</form>
    <FeedbackSlot feedback={feedback} />
  </div>
);
