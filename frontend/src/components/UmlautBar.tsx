import React from 'react';
import { useUISettings } from '../hooks/useUISettings';

interface UmlautBarProps {
  onInsert: (char: string) => void;
}

export const UmlautBar: React.FC<UmlautBarProps> = ({ onInsert }) => {
  const [settings] = useUISettings();

  // Hidden by default (see GeneralSettingsModal) — most phone keyboards
  // already offer ä/ö/ü/ß via long-press, and this bar took up space and
  // stole taps for users who don't need it. Can be re-enabled in Настройки.
  if (!settings.showUmlautBar) return null;

  const umlauts = ['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü'];

  return (
    <div className="umlaut-bar" id="umlaut-bar" aria-label="Панель умлаутов">
      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 6, fontWeight: 600 }}>
        Вставка:
      </span>
      {umlauts.map((char) => (
        <button
          key={char}
          id={`umlaut-btn-${char}`}
          type="button"
          className="umlaut-btn"
          onClick={() => onInsert(char)}
          title={`Вставить символ ${char}`}
        >
          {char}
        </button>
      ))}
    </div>
  );
};
