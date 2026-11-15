import React, { useMemo, useState } from 'react';
import { AlertCircle, Layers, RotateCcw, Save, Target } from 'lucide-react';
import { fetchSrsWeights, resetSrsWeights, saveSrsWeights } from '../../api/settings';
import type { SrsWeightsResponse } from '../../api/settings';
import { invalidateQueries, useQuery } from '../../api/queryCache';
import { SRS_WEIGHTS_KEY } from '../../hooks/useSrsWeightsSync';
import { DEFAULT_SRS_BOX_WEIGHTS, MAX_BOX_WEIGHT, sanitizeWeights, setSrsWeights } from '../../utils/srsWeights';
import { reportError, showToast } from '../../utils/toast';
import { useConfirm } from '../../hooks/useConfirm';

const BOX_NAMES = ['Ящик 1 (новые и ошибки)', 'Ящик 2', 'Ящик 3', 'Ящик 4', 'Ящик 5 (изучено)'];

/**
 * Admin: how often a card from each Leitner box is asked. The numbers are relative
 * weights (they don't have to add up to 100); the share is shown next to each field.
 * Saved on the server, so it applies to every learner.
 */
export const SrsSettingsTab: React.FC = () => {
  const confirm = useConfirm();
  const { data, isLoading } = useQuery(SRS_WEIGHTS_KEY, fetchSrsWeights);
  const [values, setValues] = useState<string[] | null>(null);
  const [thresholdValue, setThresholdValue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const currentValues = values ?? data?.weights.map(String) ?? DEFAULT_SRS_BOX_WEIGHTS.map(String);
  const currentThreshold = thresholdValue ?? String(data?.promotionThreshold ?? 1);
  const parsed = useMemo(() => currentValues.map((v) => (v.trim() === '' ? NaN : Number(v))), [currentValues]);
  const valid = sanitizeWeights(parsed);
  const total = valid ? valid.reduce((sum, w) => sum + w, 0) : 0;
  const threshold = currentThreshold.trim() === '' ? NaN : Number(currentThreshold);
  const thresholdValid = Number.isInteger(threshold) && threshold >= 1 && threshold <= 10;
  const dirty = data ? currentValues.join(',') !== data.weights.join(',') || threshold !== data.promotionThreshold : false;
  const isDefaultShown = currentValues.join(',') === DEFAULT_SRS_BOX_WEIGHTS.join(',');
  const defaultsSelected = isDefaultShown && threshold === 1;

  const apply = async (action: () => Promise<SrsWeightsResponse>, message: string) => {
    setBusy(true);
    try {
      const result = await action();
      setSrsWeights(result.weights);
      setValues(result.weights.map(String));
      setThresholdValue(String(result.promotionThreshold));
      invalidateQueries(SRS_WEIGHTS_KEY);
      showToast(message, 'success');
    } catch (e) {
      reportError(e, 'Не удалось сохранить настройки SRS');
    } finally {
      setBusy(false);
    }
  };

  const handleSave = () => {
    if (!valid || !thresholdValid || busy) return;
    void apply(() => saveSrsWeights(valid, threshold), 'Настройки SRS сохранены');
  };

  const handleReset = async () => {
    if (busy || !await confirm('Вернуть вероятности ящиков по умолчанию (60 / 15 / 10 / 5 / 10)?', { title: 'Сбросить вероятности', confirmLabel: 'Сбросить' })) return;
    void apply(resetSrsWeights, 'Возвращены значения по умолчанию');
  };

  if (isLoading) return <div className="centered-message">Загрузка настроек...</div>;

  return (
    <div className="card card--flush">
      <h3 className="card-title"><Layers size={20} /> Настройки SRS</h3>
      <p className="card-note">
        Чем больше число, тем чаще выпадает карточка из этого ящика. Числа — относительные веса, в сумме они не обязаны
        давать 100: справа показана итоговая доля. Если в выбранном наборе карточек ящик пуст, он пропускается, а доли
        остальных пересчитываются. Ноль означает «карточки этого ящика не выбираются, пока есть карточки из других».
        Настройка общая для всех учеников.
      </p>

      <div className="srs-weights-list">
        {BOX_NAMES.map((name, i) => {
          const share = valid && total > 0 ? Math.round((valid[i] / total) * 100) : null;
          return (
            <div key={name} className="srs-weights-row">
              <label className="srs-weights-label" htmlFor={`srs-weight-${i + 1}`}>
                <span className={`leitner-badge box-${i + 1}`}>{i + 1}</span> {name}
              </label>
              <input
                id={`srs-weight-${i + 1}`}
                type="number"
                inputMode="decimal"
                className="text-input srs-weights-input"
                min={0}
                max={MAX_BOX_WEIGHT}
                step="any"
                value={currentValues[i]}
                onChange={(e) => setValues(currentValues.map((v, j) => (j === i ? e.target.value : v)))}
              />
              <span className="srs-weights-percent">{share === null ? '—' : `${share}%`}</span>
            </div>
          );
        })}
      </div>

      <div className="srs-promotion-threshold">
        <label className="setting-toggle-title" htmlFor="srs-promotion-threshold"><Target size={14} /> Верных ответов для повышения ящика: {currentThreshold}</label>
        <input
          id="srs-promotion-threshold"
          type="range"
          min={1}
          max={10}
          step={1}
          value={thresholdValid ? threshold : 1}
          onChange={(e) => setThresholdValue(e.target.value)}
        />
        <span className="setting-toggle-desc">Сколько раз подряд нужно правильно ответить на карточку. Повышение по-прежнему возможно не чаще раза в день. Настройка применяется только у учеников, включивших её в общих настройках.</span>
      </div>

      {!valid && (
        <div className="form-error" role="alert">
          <AlertCircle size={16} /> Введите пять чисел от 0 до {MAX_BOX_WEIGHT}, хотя бы одно больше нуля.
        </div>
      )}

      <div className="import-actions">
        <button type="button" className="btn-secondary" disabled={busy || (defaultsSelected && data?.isDefault === true)} onClick={handleReset}>
          <RotateCcw size={16} /> По умолчанию
        </button>
        <button type="button" className="btn-primary" disabled={busy || !valid || !thresholdValid || !dirty} onClick={handleSave}>
          <Save size={16} /> {busy ? 'Подождите…' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
};
