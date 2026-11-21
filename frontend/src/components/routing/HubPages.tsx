import { useState } from 'react';
import { ArrowRight, BookOpenCheck, LogOut, Settings, SunMoon, Target } from 'lucide-react';
import { APP_TABS, TAB_LABELS } from '../../config/tabs';
import type { AppTab, ScoredTab } from '../../config/tabs';
import type { Scores } from '../../hooks/useScores';
import { MAX_DAILY_GOAL, useDailyCount, useStudyPrefs } from '../../utils/studyPrefs';
import { tabHref } from '../../hooks/useHashRoute';
import { markSyncSettingsChanged } from '../../utils/srsSync';

const descriptions: Partial<Record<AppTab, string>> = {
  words: 'Пополняйте словарный запас и повторяйте слова по карточкам.',
  articles: 'Тренируйте der, die и das на существительных.',
  verbs: 'Закрепляйте формы немецких глаголов.',
  numbers: 'Учитесь читать и записывать числа по-немецки.',
  time: 'Практикуйтесь на часах и времени.',
  pictures: 'Описывайте изображения на немецком языке.',
};

const groups: { title: string; tabs: AppTab[] }[] = [
  { title: 'Слова и грамматика', tabs: ['words', 'articles', 'verbs'] },
  { title: 'Основы', tabs: ['numbers', 'time'] },
  { title: 'Практика', tabs: ['pictures'] },
];

export function TrainerCatalog() {
  return (
    <section className="hub-page" aria-labelledby="trainer-catalog-title">
      <div className="hub-heading">
        <span className="hub-eyebrow">BlitzDeutsch</span>
        <h2 id="trainer-catalog-title">Что будем тренировать?</h2>
        <p>Выберите режим и продолжайте заниматься в своём темпе.</p>
      </div>
      {groups.map((group) => (
        <section className="trainer-group" key={group.title} aria-labelledby={`trainer-group-${group.title}`}>
          <h3 id={`trainer-group-${group.title}`}>{group.title}</h3>
          <div className="trainer-card-grid">
            {group.tabs.map((id) => {
              const tab = APP_TABS.find((item) => item.id === id);
              if (!tab) return null;
              const Icon = tab.icon;
              return (
                <a className="trainer-hub-card" href={tabHref(tab.id)} key={tab.id}>
                  <span className="trainer-hub-icon"><Icon size={22} aria-hidden="true" /></span>
                  <span className="trainer-hub-copy">
                    <strong>{tab.label}</strong>
                    <span>{descriptions[tab.id]}</span>
                  </span>
                  <ArrowRight className="trainer-hub-arrow" size={18} aria-hidden="true" />
                </a>
              );
            })}
          </div>
        </section>
      ))}
    </section>
  );
}

interface ProgressPageProps {
  scores: Scores;
}

export function ProgressPage({ scores }: ProgressPageProps) {
  const [{ dailyGoal }, setPrefs] = useStudyPrefs();
  const answeredToday = useDailyCount();
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(String(dailyGoal));
  const total = Object.values(scores).reduce((sum, score) => sum + score.total, 0);
  const correct = Object.values(scores).reduce((sum, score) => sum + score.correct, 0);
  const accuracy = total ? Math.round((correct / total) * 100) : 0;
  const goalProgress = dailyGoal > 0 ? Math.min(100, Math.round((answeredToday / dailyGoal) * 100)) : 0;

  return (
    <section className="hub-page" aria-labelledby="progress-title">
      <div className="hub-heading">
        <span className="hub-eyebrow">Ваше обучение</span>
        <h2 id="progress-title">Прогресс</h2>
        <p>Небольшие занятия каждый день помогают двигаться вперёд.</p>
      </div>
      <section className="progress-goal-card" aria-labelledby="daily-goal-title">
        <div className="progress-goal-icon"><Target size={22} aria-hidden="true" /></div>
        <div className="progress-goal-content">
          <div className="progress-goal-heading">
            <div><h3 id="daily-goal-title">Цель на сегодня</h3><p>{dailyGoal > 0 ? 'Ответы во всех тренажёрах' : 'Цель пока не настроена'}</p></div>
            <strong>{dailyGoal > 0 ? `${answeredToday} / ${dailyGoal}` : `${answeredToday} ответов`}</strong>
          </div>
          {dailyGoal > 0 && (
            <div className="daily-goal-track" role="progressbar" aria-label="Выполнение цели на сегодня" aria-valuemin={0} aria-valuemax={dailyGoal} aria-valuenow={Math.min(answeredToday, dailyGoal)}>
              <div className={`daily-goal-fill ${goalProgress >= 100 ? 'is-done' : ''}`} style={{ width: `${goalProgress}%` }} />
            </div>
          )}
          {dailyGoal > 0 && goalProgress >= 100 && <p className="daily-goal-done">Цель выполнена — отлично! 🎉</p>}
          {!isEditingGoal ? (
            <button
              className="btn-secondary progress-goal-edit"
              type="button"
              onClick={() => { setGoalDraft(String(dailyGoal)); setIsEditingGoal(true); }}
            >
              Изменить цель
            </button>
          ) : (
            <form
              className="progress-goal-form"
              onSubmit={(event) => {
                event.preventDefault();
                setPrefs({ dailyGoal: Number(goalDraft) });
                markSyncSettingsChanged();
                setIsEditingGoal(false);
              }}
            >
              <label htmlFor="progress-daily-goal">Цель в ответах за день</label>
              <span className="setting-toggle-desc">Укажите число от 0 до {MAX_DAILY_GOAL}. 0 — без цели.</span>
              <input
                className="text-input"
                id="progress-daily-goal"
                name="dailyGoal"
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_DAILY_GOAL}
                step={1}
                required
                value={goalDraft}
                onChange={(event) => setGoalDraft(event.target.value)}
              />
              <div className="progress-goal-form-actions">
                <button className="btn-primary" type="submit">Сохранить цель</button>
                <button className="btn-secondary" type="button" onClick={() => setIsEditingGoal(false)}>Отмена</button>
              </div>
            </form>
          )}
        </div>
      </section>
      <div className="progress-overview">
        <article className="progress-stat"><span>Всего ответов</span><strong>{total}</strong></article>
        <article className="progress-stat"><span>Правильных</span><strong>{total ? `${accuracy}%` : '—'}</strong></article>
      </div>
      <section className="trainer-group" aria-labelledby="progress-by-trainer">
        <h3 id="progress-by-trainer">По тренажёрам</h3>
        <div className="progress-list">
          {Object.entries(scores).map(([id, score]) => {
            const tabId = id as ScoredTab;
            const percent = score.total ? Math.round((score.correct / score.total) * 100) : 0;
            return (
              <a className="progress-row" href={tabHref(tabId)} key={id}>
                <span>{TAB_LABELS[id]?.replace(/^[^ ]+ /, '') ?? id}</span>
                <strong>{score.total ? `${percent}% · ${score.correct}/${score.total}` : 'Пока нет ответов'}</strong>
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            );
          })}
        </div>
      </section>
    </section>
  );
}

interface ProfilePageProps {
  isAdmin: boolean;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
  isDark: boolean;
  onLogout: () => void;
}

export function ProfilePage({ isAdmin, onOpenSettings, onToggleTheme, isDark, onLogout }: ProfilePageProps) {
  return (
    <section className="hub-page" aria-labelledby="profile-title">
      <div className="hub-heading">
        <span className="hub-eyebrow">BlitzDeutsch</span>
        <h2 id="profile-title">Профиль</h2>
        <p>Аккаунт и настройки приложения.</p>
      </div>
      <section className="profile-account-card">
        <span className="profile-avatar"><BookOpenCheck size={24} aria-hidden="true" /></span>
        <div><strong>Аккаунт подключён</strong><span>Вход выполнен через Telegram</span></div>
        {isAdmin && <span className="profile-admin-badge">Администратор</span>}
      </section>
      <div className="profile-actions">
        <button className="profile-action" type="button" onClick={onOpenSettings}>
          <span className="profile-action-icon"><Settings size={19} aria-hidden="true" /></span>
          <span><strong>Настройки приложения</strong><small>Цель, звук, клавиатура и вид тренажёров</small></span>
          <ArrowRight size={17} aria-hidden="true" />
        </button>
        <button className="profile-action" type="button" onClick={onToggleTheme}>
          <span className="profile-action-icon"><SunMoon size={19} aria-hidden="true" /></span>
          <span><strong>Оформление</strong><small>Сейчас включена {isDark ? 'тёмная' : 'светлая'} тема</small></span>
          <ArrowRight size={17} aria-hidden="true" />
        </button>
        <button className="profile-action profile-action--danger" type="button" onClick={onLogout}>
          <span className="profile-action-icon"><LogOut size={19} aria-hidden="true" /></span>
          <span><strong>Выйти из аккаунта</strong><small>Завершить сеанс на этом устройстве</small></span>
          <ArrowRight size={17} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
