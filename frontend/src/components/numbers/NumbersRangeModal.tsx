import React, { useState } from 'react';
import { Modal } from '../Modal';
import type { NumberRangeSettings } from '../../types';

interface NumbersRangeModalProps {
  settings: NumberRangeSettings;
  onClose: () => void;
  onSave: (s: NumberRangeSettings) => void;
}

const presets = [
  { label: '0 – 20', min: 0, max: 20, allowLarge: false },
  { label: '0 – 100', min: 0, max: 100, allowLarge: false },
  { label: '0 – 1,000', min: 0, max: 1000, allowLarge: false },
  { label: 'До 1,000,000', min: 0, max: 1000000, allowLarge: true },
];

export const NumbersRangeModal: React.FC<NumbersRangeModalProps> = ({ settings, onClose, onSave }) => {
  const [min, setMin] = useState(settings.min);
  const [max, setMax] = useState(settings.max);
  const [allowLarge, setAllowLarge] = useState(settings.allowLarge);

  return (
    <Modal title="Настройки диапазона чисел" size="sm" onClose={onClose}>
      <div className="modal-body modal-body--stack">
        <div className="preset-list">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              className="mode-pill mode-pill--sm"
              onClick={() => { setMin(p.min); setMax(p.max); setAllowLarge(p.allowLarge); }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="form-grid-2">
          <div>
            <label className="field-label" htmlFor="numbers-range-min">Минимум</label>
            <input id="numbers-range-min" type="number" className="text-input w-full" value={min} onChange={(e) => setMin(Number(e.target.value))} min={0} />
          </div>
          <div>
            <label className="field-label" htmlFor="numbers-range-max">Максимум</label>
            <input id="numbers-range-max" type="number" className="text-input w-full" value={max} onChange={(e) => setMax(Number(e.target.value))} min={1} />
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
    </Modal>
  );
};
