import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Layers, RotateCcw, Save } from 'lucide-react';
import { fetchSrsWeights, resetSrsWeights, saveSrsWeights } from '../../api/client';
import type { SrsWeightsResponse } from '../../api/client';
import { invalidateQueries, useQuery } from '../../api/queryCache';
import { SRS_WEIGHTS_KEY } from '../../hooks/useSrsWeightsSync';
import { DEFAULT_SRS_BOX_WEIGHTS, MAX_BOX_WEIGHT, sanitizeWeights, setSrsWeights } from '../../utils/srsWeights';
import { reportError, showToast } from '../../utils/toast';

const BOX_NAMES = ['Ящик 1 (новые и ошибки)', 'Ящик 2', 'Ящик 3', 'Ящик 4', 'Ящик 5 (изучено)'];

/**
 * Admin: how often a card from each Leitner box is asked. The numbers are relative
 * weights (they don't have to add up to 100); the share is shown next to each field.
 * Saved on the server, so it applies to every learner.
 */
export const SrsSettingsTab: React.FC = () => {
  const { data, isLoading } = useQuery(SRS_WEIGHTS_KEY, fetchSrsWeights);
  const [values, setValues] = useState<string[]>(() => DEFAULT_SRS_BOX_WEIGHTS.map(String));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setValues(data.weights.map(String));
  }, [data]);

  const parsed = useMemo(() => values.map((v) => (v.trim() === '' ? NaN : Number(v))), [values]);
  const valid = sanitizeWeights(parsed);
  const total = valid ? valid.reduce((sum, w) => sum + w, 0) : 0;
  const dirty = data ? values.join(',') !== data.weights.join(',') : false;
  const isDefaultShown = values.join(',') === DEFAULT_SRS_BOX_WEIGHTS.join(',');

  const apply = async (action: () => Promise<SrsWeightsResponse>, message: string) => {
    setBusy(true);
    try {
      const result = await action();
      setSrsWeights(result.weights);
      setValues(result.weights.map(String));
      invalidateQueries(SRS_WEIGHTS_KEY);
      showToast(message, 'success');
    } catch (e) {
      reportError(e, 'Не удалось сохранить настройки SRS');
    } finally {
      setBusy(false);
    }
  };

  const handleSave = () => {
    if (!valid || busy) return;
    void apply(() => saveSrsWeights(valid), 'Вероятности ящиков сохранены');
  };

  const handleReset = () => {
    if (busy || !confirm('Вернуть вероятности ящиков по умолчанию (60 / 15 / 10 / 5 / 10)?')) return;
    void apply(resetSrsWeights, 'Возвращены значения по умолчанию');
  };

  if (isLoading) return <div className="centered-message">Загрузка настроек...</div>;

  return (
    <div className="card card--flush">
      <h3 className="card-title"><Layers size={20} /> Вероятности ящиков SRS</h3>
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
                value={values[i]}
                onChange={(e) => setValues((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
              />
              <span className="srs-weights-percent">{share === null ? '—' : `${share}%`}</span>
            </div>
          );
        })}
      </div>

      {!valid && (
        <div className="form-error" role="alert">
          <AlertCircle size={16} /> Введите пять чисел от 0 до {MAX_BOX_WEIGHT}, хотя бы одно больше нуля.
        </div>
      )}

      <div className="import-actions">
        <button type="button" className="btn-secondary" disabled={busy || (isDefaultShown && data?.isDefault === true)} onClick={handleReset}>
          <RotateCcw size={16} /> По умолчанию
        </button>
        <button type="button" className="btn-primary" disabled={busy || !valid || !dirty} onClick={handleSave}>
          <Save size={16} /> {busy ? 'Подождите…' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
};
