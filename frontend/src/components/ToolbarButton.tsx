import React from 'react';

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  /** Short text kept on phones instead of the icon-only look (e.g. a number range). */
  compactLabel?: string;
  onClick: () => void;
  danger?: boolean;
}

/** Secondary toolbar button: icon + text on desktop, icon only (or a short text) on phones. */
export const ToolbarButton: React.FC<ToolbarButtonProps> = ({ icon, label, compactLabel, onClick, danger }) => (
  <button
    type="button"
    className={`btn-secondary toolbar-btn ${compactLabel ? 'toolbar-btn--text' : ''} ${danger ? 'btn-danger-text' : ''}`}
    onClick={onClick}
    title={label}
    aria-label={label}
  >
    {icon}
    <span className="btn-label">{label}</span>
    {compactLabel && <span className="btn-label-compact">{compactLabel}</span>}
  </button>
);
