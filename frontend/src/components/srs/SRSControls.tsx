import React, { useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { countDue } from '../../utils/srsDue';
import { useStudyPrefs } from '../../utils/studyPrefs';
import type { SRSRecord } from '../../types';

interface SRSToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  onLabel: string;
  offLabel: string;
}

/** "Use the SRS algorithm" switch shared by the SRS screens. */
export const SRSToggle: React.FC<SRSToggleProps> = ({ checked, onChange, onLabel, offLabel }) => (
  <div className="panel srs-toggle">
    <label className="setting-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div>
        <span className="setting-toggle-title">Использовать алгоритм повторения SRS</span>
        <span className="setting-toggle-desc">{checked ? onLabel : offLabel}</span>
      </div>
    </label>
  </div>
);

interface SRSDueControlsProps {
  /** Leitner keys of every card of this trainer. */
  keys: readonly string[];
  srsState: Record<string, SRSRecord>;
  useSRS: boolean;
}

/** How many cards are due today + the global "only cards to review" switch. */
export const SRSDueControls: React.FC<SRSDueControlsProps> = ({ keys, srsState, useSRS }) => {
  const [prefs, setPrefs] = useStudyPrefs();
  const due = useMemo(() => countDue(keys, srsState), [keys, srsState]);

  return (
    <div className="panel srs-toggle">
      <label className="setting-toggle">
        <input
          type="checkbox"
          checked={prefs.dueOnly}
          disabled={!useSRS}
          onChange={(e) => setPrefs({ dueOnly: e.target.checked })}
        />
        <div>
          <span className="setting-toggle-title">Только карточки к повторению</span>
          <span className="setting-toggle-desc">
            К повторению сегодня: <strong>{due}</strong> из {keys.length}. Новые карточки и ошибки считаются «к повторению»,
            остальные появляются, когда подойдёт срок (1 → 3 → 7 → 14 → 30 дней по ящикам).
            {!useSRS && ' Работает только при включённом SRS.'}
          </span>
        </div>
      </label>
    </div>
  );
};

interface SRSResetButtonProps {
  confirmText: string;
  onReset: () => void;
}

export const SRSResetButton: React.FC<SRSResetButtonProps> = ({ confirmText, onReset }) => (
  <div className="srs-actions">
    <button
      type="button"
      className="btn-secondary btn-danger-text"
      onClick={() => {
        if (confirm(confirmText)) onReset();
      }}
    >
      <RotateCcw size={14} /> Сбросить прогресс SRS
    </button>
  </div>
);
