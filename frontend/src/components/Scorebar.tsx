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
          <div className="stat-item" style={{ marginRight: 6 }}>
            <span className="stat-label">Модуль</span>
            <span className="stat-value" style={{ fontSize: 16, color: 'var(--accent-primary)' }}>
              {trainerName}
            </span>
          </div>
        )}

        <div className="stat-item">
          <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle size={12} color="var(--success)" /> Верно / Всего
          </span>
          <span className="stat-value">
            {score.correct} <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>/ {score.total}</span>
          </span>
        </div>

        <div className="stat-item">
          <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Target size={12} color="var(--accent-primary)" /> Точность
          </span>
          <span className="stat-value">{accuracy}%</span>
        </div>

        <div className="stat-item">
          <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Flame size={12} color="#f97316" /> Серия
          </span>
          <span className="stat-value" style={{ color: score.streak > 2 ? '#f97316' : 'inherit' }}>
            {score.streak} 🔥
          </span>
        </div>

        <div className="stat-item">
          <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Trophy size={12} color="#eab308" /> Лучшая
          </span>
          <span className="stat-value">{score.bestStreak}</span>
        </div>
      </div>

      <button
        id="reset-score-btn"
        className="btn-secondary"
        onClick={onReset}
        title="Сбросить счётчик сессии"
        type="button"
        style={{ padding: '6px 12px', fontSize: 12 }}
      >
        <RotateCcw size={14} />
        <span>Сброс</span>
      </button>
    </div>
  );
};
