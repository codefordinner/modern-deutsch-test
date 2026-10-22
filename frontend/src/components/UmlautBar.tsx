import React from 'react';
import { useUISettings } from '../hooks/useUISettings';

interface UmlautBarProps {
  onInsert: (char: string) => void;
}

const UMLAUTS = ['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü'];

export const UmlautBar: React.FC<UmlautBarProps> = ({ onInsert }) => {
  const [settings] = useUISettings();

  // Hidden by default (see GeneralSettingsModal) — most phone keyboards
  // already offer ä/ö/ü/ß via long-press, and this bar took up space and
  // stole taps for users who don't need it. Can be re-enabled in Настройки.
  if (!settings.showUmlautBar) return null;

  return (
    <div className="umlaut-bar" id="umlaut-bar" role="group" aria-label="Вставка умлаутов">
      <span className="umlaut-bar-label" aria-hidden="true">Вставка:</span>
      {UMLAUTS.map((char) => (
        <button
          key={char}
          id={`umlaut-btn-${char}`}
          type="button"
          className="umlaut-btn"
          // Keep focus (and the on-screen keyboard) in the answer field when a button is tapped with a pointer.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onInsert(char)}
          title={`Вставить символ ${char}`}
          aria-label={`Вставить ${char}`}
        >
          {char}
        </button>
      ))}
    </div>
  );
};
