import React from 'react';
import { setStudyPrefs, useStudyPrefs } from '../../utils/studyPrefs';

/**
 * Shown by a trainer when it has no card to ask: either it is still loading, or
 * "only cards to review" is on and everything is already reviewed for today.
 */
export const SRSIdleCard: React.FC = () => {
  const [prefs] = useStudyPrefs();

  if (!prefs.dueOnly) return <div className="card state-card state-card--compact">Загрузка...</div>;

  return (
    <div className="card state-card">
      <div className="state-icon">🎉</div>
      <h3 className="state-title">На сегодня всё повторено</h3>
      <p className="state-text">
        Карточек к повторению сейчас нет. Загляните позже или отключите режим «Только карточки к повторению» —
        тогда тренировка продолжится в обычном порядке.
      </p>
      <button type="button" className="btn-primary" onClick={() => setStudyPrefs({ dueOnly: false })}>
        Продолжить без ограничения
      </button>
    </div>
  );
};
