import React from 'react';
import { Modal } from './Modal';
import { Scorebar } from './Scorebar';
import type { ScoreState } from '../types';

interface StatsPanelProps {
  score: ScoreState;
  onReset: () => void;
  trainerName?: string;
  onClose: () => void;
}

// The trigger is the compact icon button in the Navbar; App owns the open/close
// state and only mounts this modal while it is open.
export const StatsPanel: React.FC<StatsPanelProps> = ({ score, onReset, trainerName, onClose }) => (
  <Modal title="Статистика" size="md" onClose={onClose}>
    <div className="modal-body">
      <Scorebar score={score} onReset={onReset} trainerName={trainerName} />
    </div>
  </Modal>
);
