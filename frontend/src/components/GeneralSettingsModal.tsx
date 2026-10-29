import React, { useRef, useState } from 'react';
import { Download, Focus, Keyboard, Languages, Tag, Target, Type, Upload } from 'lucide-react';
import { Modal } from './Modal';
import { useUISettings } from '../hooks/useUISettings';
import { MAX_DAILY_GOAL, useStudyPrefs } from '../utils/studyPrefs';
import { applyBackup, downloadBackup, parseBackup } from '../utils/progressBackup';

interface GeneralSettingsModalProps {
  onClose: () => void;
}

export const GeneralSettingsModal: React.FC<GeneralSettingsModalProps> = ({ onClose }) => {
  const [settings, updateSettings] = useUISettings();
  const [prefs, setPrefs] = useStudyPrefs();
  const fileInput = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

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
