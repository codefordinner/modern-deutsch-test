import React, { useEffect, useState } from 'react';
import { ArrowLeft, Bell, Focus, Keyboard, Languages, Layers, Palette, Plus, RefreshCw, Tag, Target, Type, Volume2, X } from 'lucide-react';
import { useUISettings } from '../hooks/useUISettings';
import { MAX_DAILY_GOAL, useStudyPrefs } from '../utils/studyPrefs';
import { useSyncStatus } from '../hooks/useSrsSync';
import { markSyncSettingsChanged } from '../utils/srsSync';
import { getErrorMessage } from '../api/request';
import { getReminderPreferences, saveReminderPreferences, type ReminderPreferences } from '../api/reminders';
import { getLearnerAuthConfig } from '../api/telegramAuth';

interface GeneralSettingsPageProps {
  onClose: () => void;
  isLearnerSignedIn: boolean;
}

const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export const GeneralSettingsPage: React.FC<GeneralSettingsPageProps> = ({ onClose, isLearnerSignedIn }) => {
  const [settings, updateSettings] = useUISettings();
  const [prefs, setPrefs] = useStudyPrefs();
  const syncStatus = useSyncStatus();
  const [reminders, setReminders] = useState<ReminderPreferences>({
    mode: 'off',
    times: ['09:00'],
    days: [0, 1, 2, 3, 4, 5, 6],
    timezone: 'UTC',
  });
  const [reminderStatus, setReminderStatus] = useState('');
  const [reminderError, setReminderError] = useState('');
  const [remindersLoading, setRemindersLoading] = useState(true);
  const [botUrl, setBotUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isLearnerSignedIn) return;
    Promise.all([getReminderPreferences(), getLearnerAuthConfig()])
      .then(([value, config]) => {
        setReminders(value);
        setBotUrl(config.botUrl ?? null);
      })
      .catch((error: unknown) => setReminderError(getErrorMessage(error, 'Не удалось загрузить настройки напоминаний.')))
      .finally(() => setRemindersLoading(false));
  }, [isLearnerSignedIn]);

  const updateReminder = (partial: Partial<ReminderPreferences>) => {
    setReminderStatus('');
    setReminderError('');
    setReminders((current) => ({ ...current, ...partial }));
  };

  const saveReminders = async () => {
    setReminderError('');
    setReminderStatus('');
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const saved = await saveReminderPreferences({ ...reminders, timezone });
      setReminders(saved);
      setReminderStatus('Настройки напоминаний сохранены.');
    } catch (error) {
      setReminderError(getErrorMessage(error, 'Не удалось сохранить настройки напоминаний.'));
    }
  };

  return (
    <section className="hub-page settings-page" aria-labelledby="general-settings-title">
      <button type="button" className="settings-back" onClick={onClose}>
        <ArrowLeft size={18} aria-hidden="true" /> Профиль
      </button>
      <div className="hub-heading">
        <span className="hub-eyebrow">BlitzDeutsch</span>
        <h2 id="general-settings-title">Настройки</h2>
        <p>Настройте напоминания и удобство занятий.</p>
      </div>

      <div className="settings-page-content">
        <section className="settings-card" aria-labelledby="goal-setting-title">
          <label className="setting-toggle-title" htmlFor="daily-goal-input" id="goal-setting-title">
            <Target size={16} /> Цель на день
          </label>
          <input
            id="daily-goal-input"
            type="number"
            inputMode="numeric"
            className="text-input w-full"
            min={0}
            max={MAX_DAILY_GOAL}
            value={prefs.dailyGoal}
            onChange={(event) => { setPrefs({ dailyGoal: Number(event.target.value) }); markSyncSettingsChanged(); }}
          />
          <span className="setting-toggle-desc">Ответы во всех тренажёрах. 0 — без цели.</span>
        </section>

        {isLearnerSignedIn && (
          <form
            className="settings-card reminder-settings"
            aria-labelledby="reminder-settings-title"
            method="post"
            onSubmit={(event) => { event.preventDefault(); void saveReminders(); }}
          >
            <div className="reminder-heading">
              <div>
                <h3 id="reminder-settings-title" className="setting-toggle-title"><Bell size={16} /> Напоминания в Telegram</h3>
                <span className="setting-toggle-desc">Сообщение от бота поможет не забыть о занятиях.</span>
              </div>
              <label className="reminder-switch">
                <input
                  type="checkbox"
                  checked={reminders.mode !== 'off'}
                  disabled={remindersLoading}
                  onChange={(event) => updateReminder({ mode: event.target.checked ? 'incomplete' : 'off' })}
                  aria-label="Включить напоминания в Telegram"
                />
                <span>{reminders.mode === 'off' ? 'Выключены' : 'Включены'}</span>
              </label>
            </div>

            {reminders.mode !== 'off' && (
              <>
                <fieldset className="reminder-mode">
                  <legend className="setting-field-label">Когда отправлять</legend>
                  <label className="reminder-mode-option">
                    <input
                      type="radio"
                      name="reminderMode"
                      value="incomplete"
                      checked={reminders.mode === 'incomplete'}
                      disabled={remindersLoading}
                      onChange={() => updateReminder({ mode: 'incomplete' })}
                    />
                    <span><strong>Если цель не выполнена</strong><small>Напомнить, только если дневная цель ещё не достигнута.</small></span>
                  </label>
                  <label className="reminder-mode-option">
                    <input
                      type="radio"
                      name="reminderMode"
                      value="always"
                      checked={reminders.mode === 'always'}
                      disabled={remindersLoading}
                      onChange={() => updateReminder({ mode: 'always' })}
                    />
                    <span><strong>Каждый выбранный день</strong><small>Напоминать независимо от числа ответов.</small></span>
                  </label>
                </fieldset>
                {botUrl && <p className="setting-toggle-desc">Сначала запустите бота в Telegram: <a href={botUrl} target="_blank" rel="noreferrer">открыть бота</a>.</p>}
                <details className="reminder-schedule">
                  <summary>Расписание: дни и время</summary>
                  <fieldset className="reminder-days">
                    <legend className="setting-field-label">Дни недели</legend>
                    <div className="reminder-day-list">
                      {WEEKDAYS.map((day, index) => (
                        <label key={day} className="reminder-day">
                          <input
                            type="checkbox"
                            name="reminderDays"
                            checked={reminders.days.includes(index)}
                            disabled={remindersLoading}
                            onChange={(event) => updateReminder({
                              days: event.target.checked
                                ? [...reminders.days, index].sort((a, b) => a - b)
                                : reminders.days.filter((value) => value !== index),
                            })}
                          />
                          {day}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset className="reminder-times">
                    <legend className="setting-field-label">Время</legend>
                    {reminders.times.map((time, index) => (
                      <div className="reminder-time-row" key={`${time}-${index}`}>
                        <label className="sr-only" htmlFor={`reminder-time-${index}`}>Время напоминания {index + 1}</label>
                        <input
                          id={`reminder-time-${index}`}
                          name="reminderTimes"
                          type="time"
                          className="text-input"
                          value={time}
                          disabled={remindersLoading}
                          onChange={(event) => updateReminder({
                            times: reminders.times.map((value, current) => current === index ? event.target.value : value),
                          })}
                        />
                        <button
                          type="button"
                          className="btn-icon"
                          aria-label={`Удалить время ${time}`}
                          disabled={reminders.times.length <= 1 || remindersLoading}
                          onClick={() => updateReminder({ times: reminders.times.filter((_, current) => current !== index) })}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn-secondary reminder-add-time"
                      disabled={reminders.times.length >= 8 || remindersLoading}
                      onClick={() => updateReminder({ times: [...reminders.times, '18:00'] })}
                    >
                      <Plus size={14} /> Добавить время
                    </button>
                    <span className="setting-toggle-desc">Время указано по часовому поясу устройства. До 8 напоминаний в день.</span>
                  </fieldset>
                </details>
              </>
            )}
            {reminderError && <p className="status-msg status-msg--error" role="alert">{reminderError}</p>}
            {reminderStatus && <p className="status-msg status-msg--success" role="status">{reminderStatus}</p>}
            <button type="submit" className="btn-secondary reminder-save" disabled={remindersLoading}>
              Сохранить напоминания
            </button>
          </form>
        )}

        <details className="settings-card settings-disclosure">
          <summary>Обучение</summary>
          <label className="setting-toggle">
            <input type="checkbox" checked={settings.useAdminSrsPromotionThreshold} onChange={(event) => updateSettings({ useAdminSrsPromotionThreshold: event.target.checked })} />
            <span><span className="setting-toggle-title"><Layers size={15} /> Учитывать порог повышения ящика</span><span className="setting-toggle-desc">Использовать число правильных ответов, заданное администратором.</span></span>
          </label>
        </details>

        <details className="settings-card settings-disclosure">
          <summary>Внешний вид и звук</summary>
          <label className="setting-toggle">
            <input type="checkbox" checked={settings.highlightArticles} onChange={(event) => updateSettings({ highlightArticles: event.target.checked })} />
            <span><span className="setting-toggle-title"><Palette size={15} /> Подсвечивать артикли</span><span className="setting-toggle-desc">der — синий, die — красный, das — зелёный.</span></span>
          </label>
          <div className="settings-control">
            <label className="setting-toggle-title" htmlFor="audio-volume-input"><Volume2 size={15} /> Громкость озвучки: {Math.round(settings.audioVolume * 100)}%</label>
            <input id="audio-volume-input" type="range" min={0} max={1} step={0.05} value={settings.audioVolume} onChange={(event) => updateSettings({ audioVolume: Number(event.target.value) })} />
          </div>
          <label className="setting-toggle">
            <input type="checkbox" checked={settings.showCategoryHint} onChange={(event) => updateSettings({ showCategoryHint: event.target.checked })} />
            <span><span className="setting-toggle-title"><Tag size={15} /> Показывать категорию слова</span><span className="setting-toggle-desc">В тренажёрах «Слова» и «Артикли».</span></span>
          </label>
        </details>

        <details className="settings-card settings-disclosure">
          <summary>Ввод и удобство</summary>
          <label className="setting-toggle">
            <input type="checkbox" checked={settings.showUmlautBar} onChange={(event) => updateSettings({ showUmlautBar: event.target.checked })} />
            <span><span className="setting-toggle-title"><Type size={15} /> Панель умлаутов (ä ö ü ß)</span><span className="setting-toggle-desc">Удобно, если на клавиатуре телефона нет немецких букв.</span></span>
          </label>
          <label className="setting-toggle">
            <input type="checkbox" checked={settings.acceptUmlautSubstitutes} onChange={(event) => updateSettings({ acceptUmlautSubstitutes: event.target.checked })} />
            <span><span className="setting-toggle-title"><Languages size={15} /> Принимать ae / oe / ue / ss</span><span className="setting-toggle-desc">Считать эти сочетания заменой ä / ö / ü / ß.</span></span>
          </label>
          <label className="setting-toggle">
            <input type="checkbox" checked={settings.autoFocus} onChange={(event) => updateSettings({ autoFocus: event.target.checked })} />
            <span><span className="setting-toggle-title"><Focus size={15} /> Фокусировать новую карточку</span><span className="setting-toggle-desc">Отключите, если фокус мешает работе со скринридером.</span></span>
          </label>
          <label className="setting-toggle">
            <input type="checkbox" checked={settings.collapseKeyboardAfterAnswer} onChange={(event) => updateSettings({ collapseKeyboardAfterAnswer: event.target.checked })} />
            <span><span className="setting-toggle-title"><Keyboard size={15} /> Сворачивать клавиатуру после ответа</span></span>
          </label>
        </details>

        {isLearnerSignedIn && (
          <section className="settings-card settings-sync">
            <h3 className="setting-toggle-title"><RefreshCw size={15} /> Синхронизация</h3>
            <span className="setting-toggle-desc">Прогресс синхронизируется с вашим Telegram-аккаунтом.</span>
            <div className={`status-msg${syncStatus.state === 'error' ? ' status-msg--error' : syncStatus.state === 'ok' ? ' status-msg--success' : ''}`} role="status">
              {syncStatus.state === 'syncing' && 'Синхронизация…'}
              {syncStatus.state === 'ok' && `Синхронизировано в ${new Date(syncStatus.lastSyncedAt).toLocaleTimeString('ru-RU')}`}
              {syncStatus.state === 'error' && syncStatus.message}
              {syncStatus.state === 'off' && 'Синхронизация ожидает запуска…'}
            </div>
          </section>
        )}
      </div>
    </section>
  );
};
