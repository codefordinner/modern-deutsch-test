import React from 'react';
import { Focus, Keyboard, Languages, Palette, RefreshCw, Tag, Target, Type, Volume2, Layers } from 'lucide-react';
import { Modal } from './Modal';
import { useUISettings } from '../hooks/useUISettings';
import { MAX_DAILY_GOAL, useStudyPrefs } from '../utils/studyPrefs';
import { useSyncStatus } from '../hooks/useSrsSync';
import { markSyncSettingsChanged } from '../utils/srsSync';

interface GeneralSettingsModalProps {
  onClose: () => void;
  isLearnerSignedIn: boolean;
}

export const GeneralSettingsModal: React.FC<GeneralSettingsModalProps> = ({ onClose, isLearnerSignedIn }) => {
  const [settings, updateSettings] = useUISettings();
  const [prefs, setPrefs] = useStudyPrefs();
  const syncStatus = useSyncStatus();

  return (
    <Modal title="Общие настройки" size="sm" onClose={onClose}>
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
