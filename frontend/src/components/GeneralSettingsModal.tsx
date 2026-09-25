import React from 'react';
import { Keyboard, Languages, Type } from 'lucide-react';
import { Modal } from './Modal';
import { useUISettings } from '../hooks/useUISettings';

interface GeneralSettingsModalProps {
  onClose: () => void;
}

export const GeneralSettingsModal: React.FC<GeneralSettingsModalProps> = ({ onClose }) => {
  const [settings, updateSettings] = useUISettings();

  return (
    <Modal title="Общие настройки" size="sm" onClose={onClose}>
      <div className="modal-body modal-body--stack">
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
      </div>

      <div className="modal-footer">
        <button type="button" className="btn-primary" onClick={onClose}>Готово</button>
      </div>
    </Modal>
  );
};
