import React from 'react';
import { Modal } from './Modal';
import { Scorebar } from './Scorebar';
import { useDailyCount, useStudyPrefs } from '../utils/studyPrefs';
import type { ScoreState } from '../types';

interface StatsPanelProps {
  score: ScoreState;
  onReset: () => void;
  trainerName?: string;
  onClose: () => void;
}

// The trigger is the compact icon button in the Navbar; App owns the open/close
// state and only mounts this modal while it is open.
export const StatsPanel: React.FC<StatsPanelProps> = ({ score, onReset, trainerName, onClose }) => {
  const [{ dailyGoal }] = useStudyPrefs();
  const answeredToday = useDailyCount();
  const percent = dailyGoal > 0 ? Math.min(100, Math.round((answeredToday / dailyGoal) * 100)) : 0;

  return (
    <Modal title="Статистика" size="md" onClose={onClose}>
      <div className="modal-body">
        <div className="daily-goal">
          <div className="daily-goal-head">
            <span>Ответов сегодня (все тренажёры)</span>
            <strong>{dailyGoal > 0 ? `${answeredToday} / ${dailyGoal}` : answeredToday}</strong>
          </div>
          {dailyGoal > 0 ? (
            <div
              className="daily-goal-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={dailyGoal}
              aria-valuenow={Math.min(answeredToday, dailyGoal)}
            >
              <div className={`daily-goal-fill ${percent >= 100 ? 'is-done' : ''}`} style={{ width: `${percent}%` }} />
            </div>
          ) : (
            <div className="muted-note">Цель отключена — задайте её в «Настройках».</div>
          )}
          {dailyGoal > 0 && percent >= 100 && <div className="daily-goal-done">Цель на сегодня выполнена 🎉</div>}
        </div>
        <Scorebar score={score} onReset={onReset} trainerName={trainerName} />
      </div>
    </Modal>
  );
};
