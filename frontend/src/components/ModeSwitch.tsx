import React from 'react';

export interface ModeOption<T extends string> {
  value: T;
  label: string;
  /** Shorter text for the compact (phone) dropdown. */
  short?: string;
  icon?: React.ReactNode;
}

interface ModeSwitchProps<T extends string> {
  options: readonly ModeOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

/**
 * One control for "pick a mode": a row of pills on wide screens and a single
 * dropdown on phones (see styles/layout.css), so several rows of horizontal
 * buttons never pile up on a small screen.
 */
export function ModeSwitch<T extends string>({ options, value, onChange, ariaLabel }: ModeSwitchProps<T>) {
  return (
    <div className="mode-switch">
      <div className="trainer-modes trainer-modes--flush mode-switch-pills" role="group" aria-label={ariaLabel}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={`mode-pill ${value === o.value ? 'active' : ''}`}
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
          >
            {o.icon} {o.label}
          </button>
        ))}
      </div>
      <select
        className="text-input mode-switch-select"
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.short ?? o.label}</option>
        ))}
      </select>
    </div>
  );
}
