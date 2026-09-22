import React from 'react';
import { X } from 'lucide-react';
import { Scorebar } from './Scorebar';
import type { ScoreState } from '../types';

interface StatsPanelProps {
  score: ScoreState;
  onReset: () => void;
  trainerName?: string;
  isOpen: boolean;
  onClose: () => void;
}

// Previously this rendered its own always-visible "Статистика" button in a
// full-width row (which ate up vertical space on mobile) and tracked its own
// open/close state. Now it's a purely controlled modal: the trigger lives as
// a compact icon button in the Navbar header, and open/close state is owned
// by App so a single stats icon can work across tabs without extra layout.
export const StatsPanel: React.FC<StatsPanelProps> = ({ score, onReset, trainerName, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 560 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>Статистика сессии</h3>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <Scorebar score={score} onReset={onReset} trainerName={trainerName} />
        </div>
      </div>
    </div>
  );
};
