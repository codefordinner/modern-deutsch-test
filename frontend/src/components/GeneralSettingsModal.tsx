import React, { useEffect, useState } from 'react';
import { Bell, Focus, Keyboard, Languages, Palette, Plus, RefreshCw, Tag, Target, Type, Volume2, Layers, X } from 'lucide-react';
import { Modal } from './Modal';
import { useUISettings } from '../hooks/useUISettings';
import { MAX_DAILY_GOAL, useStudyPrefs } from '../utils/studyPrefs';
import { useSyncStatus } from '../hooks/useSrsSync';
import { markSyncSettingsChanged } from '../utils/srsSync';
import { getErrorMessage } from '../api/request';
import { getReminderPreferences, saveReminderPreferences, type ReminderPreferences } from '../api/reminders';
import { getLearnerAuthConfig } from '../api/telegramAuth';

interface GeneralSettingsModalProps {
  onClose: () => void;
  isLearnerSignedIn: boolean;
}

export const GeneralSettingsModal: React.FC<GeneralSettingsModalProps> = ({ onClose, isLearnerSignedIn }) => {
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
    <Modal title="Общие настройки" size="sm" onClose={onClose} initialFocus="dialog">
      <div className="modal-body modal-body--stack">
        <div>
          <label className="setting-toggle-title" htmlFor="daily-goal-input">
            <Target size={14} /> Цель на день (ответов)
          </label>
          <input
            id="daily-goal-input"
            type="number"
            className="text-input w-full"
            min={0}
            max={MAX_DAILY_GOAL}
            value={prefs.dailyGoal}
            onChange={(e) => { setPrefs({ dailyGoal: Number(e.target.value) }); markSyncSettingsChanged(); }}
          />
          <span className="setting-toggle-desc">Считаются ответы во всех тренажёрах. 0 — без цели.</span>
        </div>

        {isLearnerSignedIn && (
          <form
            className="reminder-settings"
            aria-labelledby="reminder-settings-title"
            method="post"
            onSubmit={(event) => { event.preventDefault(); void saveReminders(); }}
          >
            <h3 id="reminder-settings-title" className="setting-toggle-title"><Bell size={14} /> Напоминания в Telegram</h3>
            <label className="setting-field-label" htmlFor="reminder-mode">Режим</label>
            <select
              id="reminder-mode"
              name="reminderMode"
              className="text-input w-full"
              value={reminders.mode}
              disabled={remindersLoading}
              onChange={(event) => updateReminder({ mode: event.target.value as ReminderPreferences['mode'] })}
            >
              <option value="off">Выключено</option>
              <option value="incomplete">Если цель не выполнена</option>
              <option value="always">Всегда</option>
            </select>
            <span className="setting-toggle-desc">
              Если дневная цель выключена, режим «цель не выполнена» работает как «всегда».
            </span>
            {botUrl && (
              <span className="setting-toggle-desc">
                Чтобы бот мог присылать сообщения, откройте его и нажмите «Запустить»: <a href={botUrl} target="_blank" rel="noreferrer">перейти в Telegram-бот</a>.
              </span>
            )}

            <fieldset className="reminder-days">
              <legend className="setting-field-label">Дни недели</legend>
              <div className="reminder-day-list">
                {['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'].map((day, index) => (
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
              <legend className="setting-field-label">Время напоминаний</legend>
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
              <span className="setting-toggle-desc">До 8 напоминаний в день. Время указано по часовому поясу устройства.</span>
            </fieldset>
            {reminderError && <p className="status-msg status-msg--error" role="alert">{reminderError}</p>}
            {reminderStatus && <p className="status-msg status-msg--success" role="status">{reminderStatus}</p>}
            <button type="submit" className="btn-secondary" disabled={remindersLoading}>
              Сохранить напоминания
            </button>
          </form>
        )}

        <label className="setting-toggle">
          <input
            type="checkbox"
            checked={settings.useAdminSrsPromotionThreshold}
            onChange={(e) => updateSettings({ useAdminSrsPromotionThreshold: e.target.checked })}
          />
          <div>
            <span className="setting-toggle-title">
              <Layers size={14} /> Учитывать порог повышения ящика из админки
            </span>
            <span className="setting-toggle-desc">
              Для повышения карточки потребуется несколько правильных ответов подряд, если такой порог задан администратором.
            </span>
          </div>
        </label>

        <label className="setting-toggle">
          <input
            type="checkbox"
            checked={settings.highlightArticles}
            onChange={(e) => updateSettings({ highlightArticles: e.target.checked })}
          />
          <div>
            <span className="setting-toggle-title">
              <Palette size={14} /> Подсвечивать артикль цветом рода
            </span>
            <span className="setting-toggle-desc">
              В тренажёре «Слова» и в словаре: der — синий, die — красный, das — зелёный (как в «Артиклях»).
            </span>
          </div>
        </label>

        <div>
          <label className="setting-toggle-title" htmlFor="audio-volume-input"><Volume2 size={14} /> Громкость озвучки: {Math.round(settings.audioVolume * 100)}%</label>
          <input id="audio-volume-input" type="range" min={0} max={1} step={0.05} value={settings.audioVolume} onChange={(e) => updateSettings({ audioVolume: Number(e.target.value) })} />
          <span className="setting-toggle-desc">Громкость воспроизведения немецких слов и фраз на этом устройстве.</span>
        </div>

        <label className="setting-toggle">
          <input
            type="checkbox"
            checked={settings.showCategoryHint}
            onChange={(e) => updateSettings({ showCategoryHint: e.target.checked })}
          />
          <div>
            <span className="setting-toggle-title">
              <Tag size={14} /> Показывать категорию слова под вопросом
            </span>
            <span className="setting-toggle-desc">
              В тренажёрах «Слова» и «Артикли». Отключите, если категория подсказывает ответ.
            </span>
          </div>
        </label>

        <label className="setting-toggle">
          <input
            type="checkbox"
            checked={settings.showUmlautBar}
            onChange={(e) => updateSettings({ showUmlautBar: e.target.checked })}
          />
          <div>
            <span className="setting-toggle-title">
              <Type size={14} /> Показывать панель умлаутов (ä ö ü ß)
            </span>
            <span className="setting-toggle-desc">
              По умолчанию скрыта. Включите, если неудобно вставлять умлауты через клавиатуру телефона.
            </span>
          </div>
        </label>

        <label className="setting-toggle">
          <input
            type="checkbox"
            checked={settings.acceptUmlautSubstitutes}
            onChange={(e) => updateSettings({ acceptUmlautSubstitutes: e.target.checked })}
          />
          <div>
            <span className="setting-toggle-title">
              <Languages size={14} /> Принимать ae / oe / ue / ss вместо ä / ö / ü / ß
            </span>
            <span className="setting-toggle-desc">
              По умолчанию выключено: нужно писать по-настоящему, «Tür», а не «Tuer». Включите, если на клавиатуре нет умлаутов.
            </span>
          </div>
        </label>

        <label className="setting-toggle">
          <input
            type="checkbox"
            checked={settings.autoFocus}
            onChange={(e) => updateSettings({ autoFocus: e.target.checked })}
          />
          <div>
            <span className="setting-toggle-title">
              <Focus size={14} /> Автоматически переводить фокус на новую карточку
            </span>
            <span className="setting-toggle-desc">
              Поле ответа и кнопка «Дальше» получают фокус сами. Отключите, если пользуетесь скринридером:
              фокус перестанет «прыгать» и прерывать озвучку.
            </span>
          </div>
        </label>

        <label className="setting-toggle">
          <input
            type="checkbox"
            checked={settings.collapseKeyboardAfterAnswer}
            onChange={(e) => updateSettings({ collapseKeyboardAfterAnswer: e.target.checked })}
          />
          <div>
            <span className="setting-toggle-title">
              <Keyboard size={14} /> Сворачивать клавиатуру после ответа
            </span>
            <span className="setting-toggle-desc">
              По умолчанию клавиатура на телефоне остаётся открытой между вопросами. Включите, если хотите,
              чтобы фокус переходил на кнопку «Дальше» и клавиатура сворачивалась.
            </span>
          </div>
        </label>

        {isLearnerSignedIn && (
          <div className="settings-divider">
            <span className="setting-toggle-title">
              <RefreshCw size={14} /> Синхронизация через Telegram
            </span>
            <span className="setting-toggle-desc">
              Прогресс синхронизируется с вашим Telegram-аккаунтом.
            </span>
            <div
              className={`status-msg${syncStatus.state === 'error' ? ' status-msg--error' : syncStatus.state === 'ok' ? ' status-msg--success' : ''}`}
              role="status"
            >
              {syncStatus.state === 'syncing' && 'Синхронизация…'}
              {syncStatus.state === 'ok' && `Синхронизировано в ${new Date(syncStatus.lastSyncedAt).toLocaleTimeString('ru-RU')}`}
              {syncStatus.state === 'error' && syncStatus.message}
              {syncStatus.state === 'off' && 'Синхронизация ожидает запуска…'}
            </div>
          </div>
        )}
      </div>

      <div className="modal-footer">
        <button type="button" className="btn-primary" onClick={onClose}>Готово</button>
      </div>
    </Modal>
  );
};
