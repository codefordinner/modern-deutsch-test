import React, { useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { countDue, isDue } from '../../utils/srsDue';
import { SRS_BOX_COUNT } from '../../utils/srs';
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

interface SRSPoolProgressProps {
  /** Leitner keys of the cards currently selected for practice (chosen categories etc.). */
  keys: readonly string[];
  srsState: Record<string, SRSRecord>;
  /** What the selection is, e.g. "Все категории" or "Выбрано категорий: 3". */
  scope: string;
}

/**
 * Progress over the SELECTED cards: how many are done for now (no review needed
 * today — answered correctly and their next review date hasn't come) and how many
 * are fully learned (box 5).
 */
export const SRSPoolProgress: React.FC<SRSPoolProgressProps> = ({ keys, srsState, scope }) => {
  const { done, learned, total } = useMemo(() => {
    const now = Date.now();
    let doneCount = 0;
    let learnedCount = 0;
    for (const key of keys) {
      const record = srsState[key];
      if (!isDue(record, now)) doneCount += 1;
      if ((record?.box ?? 1) >= SRS_BOX_COUNT) learnedCount += 1;
    }
    return { done: doneCount, learned: learnedCount, total: keys.length };
  }, [keys, srsState]);
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="daily-goal">
      <div className="daily-goal-head">
        <span>Выполнено сегодня · {scope}</span>
        <strong>{done} / {total}</strong>
      </div>
      <div
        className="daily-goal-track"
        role="progressbar"
        aria-label="Выполнено карточек из выбранных"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <div className={`daily-goal-fill ${percent >= 100 ? 'is-done' : ''}`} style={{ width: `${percent}%` }} />
      </div>
      <div className="muted-note">
        «Выполнено» — карточки, которые сегодня больше не нужно повторять. Полностью изучено (ящик 5): <strong>{learned}</strong> из {total}.
      </div>
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
