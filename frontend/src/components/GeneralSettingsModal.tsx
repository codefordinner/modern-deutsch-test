import React from 'react';
import { X, Keyboard, Type } from 'lucide-react';
import { useUISettings } from '../hooks/useUISettings';

interface GeneralSettingsModalProps {
  onClose: () => void;
}

export const GeneralSettingsModal: React.FC<GeneralSettingsModalProps> = ({ onClose }) => {
  const [settings, updateSettings] = useUISettings();

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>Общие настройки</h3>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 13 }}>
            <input
              type="checkbox"
              checked={settings.showUmlautBar}
              onChange={(e) => updateSettings({ showUmlautBar: e.target.checked })}
              style={{ accentColor: 'var(--accent-primary)', marginTop: 2 }}
            />
            <div>
              <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Type size={14} /> Показывать панель умлаутов (ä ö ü ß)
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                По умолчанию скрыта. Включите, если неудобно вставлять умлауты через клавиатуру телефона.
              </span>
            </div>
          </label>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 13 }}>
            <input
              type="checkbox"
              checked={settings.collapseKeyboardAfterAnswer}
              onChange={(e) => updateSettings({ collapseKeyboardAfterAnswer: e.target.checked })}
              style={{ accentColor: 'var(--accent-primary)', marginTop: 2 }}
            />
            <div>
              <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Keyboard size={14} /> Сворачивать клавиатуру после ответа
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                По умолчанию клавиатура на телефоне остаётся открытой между вопросами. Включите, если хотите,
                чтобы фокус переходил на кнопку «Дальше» и клавиатура сворачивалась.
              </span>
            </div>
          </label>
        </div>

        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>Готово</button>
        </div>
      </div>
    </div>
  );
};
