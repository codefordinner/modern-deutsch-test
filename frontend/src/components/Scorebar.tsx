import React from 'react';
import type { ScoreState } from '../types';
import { RotateCcw, Flame, Trophy, CheckCircle, Target } from 'lucide-react';

interface ScorebarProps {
  score: ScoreState;
  onReset: () => void;
  trainerName?: string;
}

export const Scorebar: React.FC<ScorebarProps> = ({ score, onReset, trainerName }) => {
  const accuracy = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 100;

  return (
    <div className="score-bar" id="scorebar">
      <div className="score-stats">
        {trainerName && (
          <div className="stat-item stat-item--module">
            <span className="stat-label">Модуль</span>
            <span className="stat-value stat-value--module">{trainerName}</span>
          </div>
        )}

        <div className="stat-item">
          <span className="stat-label">
            <CheckCircle size={12} color="var(--success)" /> Верно / Всего
          </span>
          <span className="stat-value">
            {score.correct} <span className="stat-value-total">/ {score.total}</span>
          </span>
        </div>

        <div className="stat-item">
          <span className="stat-label">
            <Target size={12} color="var(--accent-primary)" /> Точность
          </span>
          <span className="stat-value">{accuracy}%</span>
        </div>

        <div className="stat-item">
          <span className="stat-label">
            <Flame size={12} color="#f97316" /> Серия
          </span>
          <span className={`stat-value ${score.streak > 2 ? 'stat-value--hot' : ''}`}>{score.streak} 🔥</span>
        </div>

        <div className="stat-item">
          <span className="stat-label">
            <Trophy size={12} color="#eab308" /> Лучшая
          </span>
          <span className="stat-value">{score.bestStreak}</span>
        </div>
      </div>

      <button
        id="reset-score-btn"
        className="btn-secondary score-reset-btn"
        onClick={onReset}
        title="Сбросить счётчик"
        type="button"
      >
        <RotateCcw size={14} />
        <span>Сброс</span>
      </button>
    </div>
  );
};
