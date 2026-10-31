import React, { useRef, useState } from 'react';
import { Download, Focus, Keyboard, Languages, RefreshCw, Tag, Target, Type, Upload } from 'lucide-react';
import { Modal } from './Modal';
import { useUISettings } from '../hooks/useUISettings';
import { MAX_DAILY_GOAL, useStudyPrefs } from '../utils/studyPrefs';
import { applyBackup, downloadBackup, parseBackup } from '../utils/progressBackup';
import { useSyncStatus } from '../hooks/useSrsSync';
import { syncNow } from '../utils/srsSync';
import { MAX_SYNC_KEY_LENGTH, MIN_SYNC_KEY_LENGTH, readSyncKey } from '../utils/srsSyncData';

interface GeneralSettingsModalProps {
  onClose: () => void;
}

export const GeneralSettingsModal: React.FC<GeneralSettingsModalProps> = ({ onClose }) => {
  const [settings, updateSettings] = useUISettings();
  const [prefs, setPrefs] = useStudyPrefs();
  const fileInput = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [keyDraft, setKeyDraft] = useState(settings.syncKey);
  const syncStatus = useSyncStatus();

  const draftTrimmed = keyDraft.trim();
  const draftValid = draftTrimmed === '' || readSyncKey(draftTrimmed) !== null;
  const draftChanged = draftTrimmed !== settings.syncKey;

  const saveSyncKey = () => {
    if (!draftValid) return;
    updateSettings({ syncKey: draftTrimmed });
    setKeyDraft(draftTrimmed);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setImportError(null);
    try {
      const backup = parseBackup(await file.text());
      const when = backup.exportedAt ? new Date(backup.exportedAt).toLocaleString('ru-RU') : 'неизвестно';
      if (!confirm(`Заменить весь текущий прогресс и настройки данными из файла (сохранён: ${when})?`)) return;
      applyBackup(backup);
      window.location.reload();
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Не удалось прочитать файл');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

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
            onChange={(e) => setPrefs({ dailyGoal: Number(e.target.value) })}
          />
          <span className="setting-toggle-desc">Считаются ответы во всех тренажёрах. 0 — без цели.</span>
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

        <div className="settings-divider">
          <label className="setting-toggle-title" htmlFor="sync-key-input">
            <RefreshCw size={14} /> Ключ синхронизации
          </label>
          <div className="backup-actions">
            <input
              id="sync-key-input"
              type="text"
              className="text-input w-full"
              value={keyDraft}
              maxLength={MAX_SYNC_KEY_LENGTH}
              placeholder="Пусто — без синхронизации"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setKeyDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveSyncKey();
              }}
            />
            <button type="button" className="btn-secondary" onClick={saveSyncKey} disabled={!draftChanged || !draftValid}>
              Сохранить
            </button>
          </div>
          <span className="setting-toggle-desc">
            Впишите одинаковый ключ на всех своих устройствах — прогресс SRS (слова, глаголы, артикли) будет общим.
            Пусто — синхронизации нет, ничего не отправляется. Ключ — это ваш «пароль»: выберите длинный и не
            показывайте его другим (от {MIN_SYNC_KEY_LENGTH} символов).
          </span>
          {!draftValid && (
            <div className="status-msg status-msg--error" role="alert">
              Ключ должен быть не короче {MIN_SYNC_KEY_LENGTH} символов.
            </div>
          )}
          {settings.syncKey !== '' && draftValid && (
            <div
              className={`status-msg${syncStatus.state === 'error' ? ' status-msg--error' : syncStatus.state === 'ok' ? ' status-msg--success' : ''}`}
              role="status"
            >
              {syncStatus.state === 'syncing' && 'Синхронизация…'}
              {syncStatus.state === 'ok' && `Синхронизировано в ${new Date(syncStatus.lastSyncedAt).toLocaleTimeString('ru-RU')}`}
              {syncStatus.state === 'error' && syncStatus.message}
              {syncStatus.state === 'off' && 'Ожидание синхронизации…'}
              {settings.syncKey !== '' && syncStatus.state !== 'syncing' && (
                <>
                  {' '}
                  <button type="button" className="btn-secondary" onClick={() => void syncNow()}>
                    Синхронизировать сейчас
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="settings-divider backup-section">
          <span className="settings-group-title">Перенос прогресса между устройствами</span>
          <span className="setting-toggle-desc">
            Файл содержит ящики SRS, счёт и настройки. Загрузка заменяет текущий прогресс на этом устройстве.
          </span>
          <div className="backup-actions">
            <button type="button" className="btn-secondary" onClick={downloadBackup}>
              <Download size={14} /> Скачать
            </button>
            <button type="button" className="btn-secondary" onClick={() => fileInput.current?.click()}>
              <Upload size={14} /> Загрузить
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-label="Файл прогресса"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
          </div>
          {importError && <div className="status-msg status-msg--error" role="alert">{importError}</div>}
        </div>
      </div>

      <div className="modal-footer">
        <button type="button" className="btn-primary" onClick={onClose}>Готово</button>
      </div>
    </Modal>
  );
};
