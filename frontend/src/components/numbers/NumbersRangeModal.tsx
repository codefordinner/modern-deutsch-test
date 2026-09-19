import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { NumberRangeSettings } from '../../types';

interface NumbersRangeModalProps {
  settings: NumberRangeSettings;
  onClose: () => void;
  onSave: (s: NumberRangeSettings) => void;
}

export const NumbersRangeModal: React.FC<NumbersRangeModalProps> = ({ settings, onClose, onSave }) => {
  const [min, setMin] = useState(settings.min);
  const [max, setMax] = useState(settings.max);
  const [allowLarge, setAllowLarge] = useState(settings.allowLarge);

  const presets = [
    { label: '0 – 20', min: 0, max: 20, allowLarge: false },
    { label: '0 – 100', min: 0, max: 100, allowLarge: false },
    { label: '0 – 1,000', min: 0, max: 1000, allowLarge: false },
    { label: 'До 1,000,000', min: 0, max: 1000000, allowLarge: true },
  ];

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>Настройки диапазона чисел</h3>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                className="mode-pill"
                style={{ fontSize: 12 }}
                onClick={() => { setMin(p.min); setMax(p.max); setAllowLarge(p.allowLarge); }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Минимум</label>
              <input type="number" className="text-input" style={{ width: '100%' }} value={min} onChange={(e) => setMin(Number(e.target.value))} min={0} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Максимум</label>
              <input type="number" className="text-input" style={{ width: '100%' }} value={max} onChange={(e) => setMax(Number(e.target.value))} min={1} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Отмена</button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => { onSave({ min: Math.max(0, min), max: Math.max(min + 1, max), allowLarge }); onClose(); }}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
};
