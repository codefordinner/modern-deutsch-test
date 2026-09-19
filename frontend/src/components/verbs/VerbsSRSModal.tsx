import React from 'react';
import { X, RotateCcw } from 'lucide-react';
import type { Word, SRSState } from '../../types';

interface VerbsSRSModalProps {
  verbs: Word[];
  srsState: Record<string, SRSState>;
  useSRS: boolean;
  onClose: () => void;
  onResetSRS: () => void;
  onToggleUseSRS: (val: boolean) => void;
}

export const VerbsSRSModal: React.FC<VerbsSRSModalProps> = ({
  verbs,
  srsState,
  useSRS,
  onClose,
  onResetSRS,
  onToggleUseSRS,
}) => {
  const boxCounts = [0, 0, 0, 0, 0, 0];
  verbs.forEach((v) => {
    const item = srsState[v.id];
    const box = item ? item.box : 1;
    boxCounts[box] = (boxCounts[box] || 0) + 1;
  });

  const boxLabels = [
    '',
    'Ящик 1 (Каждый день)',
    'Ящик 2 (Каждые 3 дня)',
    'Ящик 3 (Раз в неделю)',
    'Ящик 4 (Раз в 2 недели)',
    'Ящик 5 (Изучено навсегда)',
  ];

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>SRS Лейтнера для глаголов</h3>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 0 }}>
            Глаголы распределяются по 5 ящикам. При правильном ответе карточка переходит на следующий уровень, при ошибке возвращается в Ящик 1.
          </p>

          <div style={{ marginBottom: 16, padding: '12px 14px', background: 'var(--bg-tertiary)', borderRadius: 8 }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={useSRS}
                onChange={(e) => onToggleUseSRS(e.target.checked)}
                style={{ accentColor: 'var(--accent-primary)', marginTop: 2 }}
              />
              <div>
                <span style={{ fontWeight: 600, display: 'block' }}>Использовать алгоритм повторения SRS</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {useSRS ? 'Включено: глаголы повторяются по ящикам' : 'Отключено: чистый случайный выбор (рандом)'}
                </span>
              </div>
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '14px 0' }}>
            {[1, 2, 3, 4, 5].map((box) => (
              <div key={box} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{boxLabels[box]}</span>
                <span className={`leitner-badge box-${box}`}>{boxCounts[box]} глаголов</span>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'right', marginTop: 10 }}>
            <button
              className="btn-secondary"
              style={{ color: 'var(--error)' }}
              onClick={() => { if (confirm('Сбросить весь прогресс SRS для глаголов?')) onResetSRS(); }}
            >
              <RotateCcw size={14} /> Сбросить прогресс SRS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
