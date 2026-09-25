import React from 'react';
import { RotateCcw } from 'lucide-react';

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
