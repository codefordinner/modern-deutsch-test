import React from 'react';
import { Volume2, Eye, ArrowRight } from 'lucide-react';
import { AnalogClock } from './AnalogClock';
import { DigitalDisplay } from './DigitalDisplay';
import { speakGerman } from '../../utils/audio';
import type { GermanTimeOutput } from '../../utils/time-generator';

interface TimeFlashCardProps {
  timeData: GermanTimeOutput;
  displayMode: 'analog' | 'digital' | 'both';
  formatMode: 'informal' | 'formal' | 'both';
  isRevealed: boolean;
  onReveal: () => void;
  onNext: () => void;
}

export const TimeFlashCard: React.FC<TimeFlashCardProps> = ({
  timeData,
  displayMode,
  formatMode,
  isRevealed,
  onReveal,
  onNext,
}) => {
  const mainPhrase = formatMode === 'formal' ? timeData.official : timeData.colloquial;

  return (
    <div className="question-card" style={{ minHeight: 380, justifyContent: 'center' }}>
      {displayMode === 'both' ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
          <AnalogClock hours={timeData.hours} minutes={timeData.minutes} />
          <DigitalDisplay hours={timeData.hours} minutes={timeData.minutes} />
        </div>
      ) : displayMode === 'analog' ? (
        <AnalogClock hours={timeData.hours} minutes={timeData.minutes} />
      ) : (
        <DigitalDisplay hours={timeData.hours} minutes={timeData.minutes} />
      )}

      {!isRevealed ? (
        <div style={{ marginTop: 24, width: '100%', maxWidth: 360 }}>
          <button
            type="button"
            className="btn-primary"
            style={{ width: '100%', padding: '14px 20px', fontSize: 16 }}
            onClick={onReveal}
            autoFocus
          >
            <Eye size={18} /> Показать ответ (Пробел / Enter)
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 20, width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            style={{
              padding: '16px 20px',
              borderRadius: 14,
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
              {timeData.colloquial}
            </div>

            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span>Время: <strong style={{ color: 'var(--text-primary)' }}>{timeData.timeString24}</strong></span>
              <span>•</span>
              <span>Официально: <strong style={{ color: 'var(--text-primary)' }}>{timeData.official}</strong></span>
            </div>

            {timeData.kurzVariant && (
              <div style={{ fontSize: 12, color: 'var(--warning)', fontWeight: 600, marginBottom: 8 }}>
                💡 Разговорное использование: «{timeData.kurzVariant}»
              </div>
            )}

            <button
              type="button"
              className="icon-btn"
              onClick={() => speakGerman(mainPhrase)}
              title="Озвучить"
              style={{ margin: '0 auto', display: 'flex' }}
            >
              <Volume2 size={18} />
            </button>
          </div>

          <button
            type="button"
            className="btn-primary"
            style={{ width: '100%', padding: '14px 20px', fontSize: 16 }}
            onClick={onNext}
            autoFocus
          >
            Следующее время <ArrowRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
};
