import React from 'react';
import { Modal } from './Modal';
import { Scorebar } from './Scorebar';
import { useDailyCount, useStudyPrefs } from '../utils/studyPrefs';
import type { ScoreState } from '../types';
import type { Scores } from '../hooks/useScores';

interface StatsPanelProps {
  score: ScoreState;
  onReset: () => void;
  trainerName?: string;
  scores: Scores;
  onClose: () => void;
}

// The trigger is the compact icon button in the Navbar; App owns the open/close
// state and only mounts this modal while it is open.
export const StatsPanel: React.FC<StatsPanelProps> = ({ score, onReset, trainerName, scores, onClose }) => {
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
          <section className="learning-summary" aria-labelledby="learning-summary-title">
            <h3 id="learning-summary-title">Прогресс по тренажёрам</h3>
            {Object.entries(scores).map(([tab, item]) => {
              const accuracy = item.total > 0 ? Math.round((item.correct / item.total) * 100) : 0;
              return (
                <div className="learning-summary-row" key={tab}>
                  <span>{tab === 'numbers' ? 'Числительные' : tab === 'words' ? 'Слова' : tab === 'articles' ? 'Артикли' : tab === 'verbs' ? 'Глаголы' : 'Время'}</span>
                  <strong>{item.total ? `${accuracy}% · ${item.correct}/${item.total}` : 'Пока нет ответов'}</strong>
                </div>
              );
            })}
          </section>
      </div>
    </Modal>
  );
};
