import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, Eye, Trash2, Upload } from 'lucide-react';
import { getErrorMessage, importWords, previewImport } from '../../api/client';
import type { ImportPreview, ImportResult } from '../../api/client';
import { invalidateQueries } from '../../api/queryCache';
import { CATEGORIES_KEY, WORDS_KEY } from '../../hooks/useDictionary';
import { PART_OF_SPEECH_OPTIONS } from '../../utils/partOfSpeech';
import type { Category, PartOfSpeech } from '../../types';

interface ImportReviewCardProps {
  categories: Category[];
  onRefresh: () => void;
}

interface EditableRow {
  key: number;
  include: boolean;
  status: 'ok' | 'duplicate';
  de: string;
  ru: string;
  category: string;
  partOfSpeech: PartOfSpeech | '';
  fields: Record<string, string>;
}

/**
 * Import with a review step: parse → fix the rows in a table → import.
 * Nothing is written until "Импортировать"; the corrected rows are then sent as
 * JSON to the regular import endpoint (so all its rules and duplicate checks apply).
 */
export const ImportReviewCard: React.FC<ImportReviewCardProps> = ({ categories, onRefresh }) => {
  const [text, setText] = useState('');
  const [defaultCategory, setDefaultCategory] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const categoryNames = useMemo(() => new Set(categories.map((c) => c.name.trim().toLowerCase())), [categories]);

  const reset = () => {
    setPreview(null);
    setRows([]);
    setResult(null);
    setError(null);
  };

  const handleParse = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    reset();
    try {
      const data = await previewImport({ data: text, defaultCategoryId: defaultCategory || undefined });
      setPreview(data);
      setRows(
        data.rows.map((r) => ({
          key: r.index,
          include: r.status === 'ok',
          status: r.status,
          de: r.de,
          ru: r.ru,
          category: r.category,
          partOfSpeech: r.partOfSpeech ?? '',
          fields: r.fields,
        }))
      );
    } catch (e) {
      setError(getErrorMessage(e, 'Не удалось разобрать данные'));
    } finally {
      setBusy(false);
    }
  };

  const update = (key: number, patch: Partial<EditableRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const updateField = (key: number, field: string, value: string) =>
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const fields = { ...r.fields };
        if (value) fields[field] = value;
        else delete fields[field];
        return { ...r, fields };
      })
    );

  const problem = (r: EditableRow): string | null => {
    if (!r.de.trim() || !r.ru.trim()) return 'Заполните de и ru';
    if (!r.category.trim() && !defaultCategory) return 'Нужна категория';
    return null;
  };

  const ready = rows.filter((r) => r.include);
  const blocking = ready.filter((r) => problem(r) !== null).length;

  const handleImport = async () => {
    if (ready.length === 0 || blocking > 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        words: ready.map((r) => ({
          de: r.de.trim(),
          ru: r.ru.trim(),
          category: r.category.trim() || undefined,
          partOfSpeech: r.partOfSpeech || undefined,
          ...r.fields,
        })),
        categories: preview?.categories ?? [],
      };
      const outcome = await importWords({
        data: JSON.stringify(payload),
        defaultCategoryId: defaultCategory || undefined,
        skipDuplicates: true,
      });
      setResult(outcome);
      invalidateQueries(WORDS_KEY);
      invalidateQueries(CATEGORIES_KEY);
      onRefresh();
      setPreview(null);
      setRows([]);
      if (outcome.errors.length === 0) setText('');
    } catch (e) {
      setError(getErrorMessage(e, 'Ошибка импорта'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card card--flush review-card">
      <h3 className="card-title"><Eye size={20} /> Импорт с проверкой и правкой</h3>
      <p className="card-note">
        Вставьте JSON или текст (так же, как выше), нажмите «Разобрать» — слова появятся в таблице. Исправьте
        переводы, категории и части речи, снимите галочки с лишнего и только потом импортируйте.
      </p>

      <textarea
        className="text-input w-full textarea-mono"
        rows={6}
        value={text}
        onChange={(e) => { setText(e.target.value); reset(); }}
        placeholder={'der Hund; собака; die Hunde\ngehen; идти'}
        aria-label="Данные для проверки"
      />

      <div className="form-grid-2 select-spaced">
        <select className="text-input" value={defaultCategory} onChange={(e) => { setDefaultCategory(e.target.value); reset(); }} aria-label="Категория по умолчанию">
          <option value="">Категория по умолчанию: не задана</option>
          {categories.map((c) => (<option key={c.id} value={c.id}>{c.icon || '📌'} {c.name}</option>))}
        </select>
        <button type="button" className="btn-secondary" disabled={busy || !text.trim()} onClick={() => void handleParse()}>
          <Eye size={16} /> Разобрать
        </button>
      </div>

      {error && <div className="status-msg status-msg--error" role="alert"><AlertCircle size={16} /> {error}</div>}

      {result && (
        <div className="import-result import-result--ok" role="status">
          <div className="import-result-title"><CheckCircle size={16} /> Добавлено слов: {result.importedCount} из {result.total}</div>
          {result.duplicates.length > 0 && <div className="muted-note">Уже были в словаре: {result.duplicates.length}</div>}
          {result.errors.length > 0 && <div className="error-note">Ошибок: {result.errors.length}</div>}
        </div>
      )}

      {preview && (
        <>
          {preview.errors.length > 0 && (
            <div className="import-result import-result--warn">
              <div className="import-result-title"><AlertCircle size={16} /> Не удалось прочитать строк: {preview.errors.length}</div>
              <ul className="import-result-list">
                {preview.errors.slice(0, 20).map((e, i) => (<li key={i}>№{e.row}{e.de ? ` («${e.de}»)` : ''}: {e.message}</li>))}
              </ul>
            </div>
          )}

          <div className="table-frame">
            <table className="data-table review-table">
              <thead>
                <tr>
                  <th className="th-check">
                    <input
                      type="checkbox"
                      aria-label="Выбрать все"
                      checked={rows.length > 0 && rows.every((r) => r.include)}
                      onChange={(e) => setRows((prev) => prev.map((r) => ({ ...r, include: e.target.checked })))}
                    />
                  </th>
                  <th>Немецкий</th>
                  <th>Русский</th>
                  <th>Категория</th>
                  <th>Часть речи</th>
                  <th>Plural</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const issue = r.include ? problem(r) : null;
                  const newCategory = r.category.trim() && !categoryNames.has(r.category.trim().toLowerCase());
                  return (
                    <tr key={r.key} className={`${r.include ? '' : 'is-excluded'} ${issue ? 'has-issue' : ''}`}>
                      <td className="th-check">
                        <input type="checkbox" aria-label={`Импортировать: ${r.de}`} checked={r.include} onChange={(e) => update(r.key, { include: e.target.checked })} />
                      </td>
                      <td>
                        <input className="text-input" aria-label="Немецкий" value={r.de} onChange={(e) => update(r.key, { de: e.target.value })} />
                        {r.status === 'duplicate' && <div className="review-note">уже есть в словаре / повтор</div>}
                      </td>
                      <td><input className="text-input" aria-label="Русский" value={r.ru} onChange={(e) => update(r.key, { ru: e.target.value })} /></td>
                      <td>
                        <input
                          className="text-input"
                          aria-label="Категория"
                          list="review-categories"
                          value={r.category}
                          placeholder={defaultCategory ? 'по умолчанию' : 'категория'}
                          onChange={(e) => update(r.key, { category: e.target.value })}
                        />
                        {newCategory && <div className="review-note">будет создана</div>}
                      </td>
                      <td>
                        <select className="text-input" aria-label="Часть речи" value={r.partOfSpeech} onChange={(e) => update(r.key, { partOfSpeech: e.target.value as PartOfSpeech | '' })}>
                          <option value="">авто</option>
                          {PART_OF_SPEECH_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                        </select>
                      </td>
                      <td><input className="text-input" aria-label="Plural" value={r.fields.plural ?? ''} onChange={(e) => updateField(r.key, 'plural', e.target.value)} /></td>
                      <td>
                        <button type="button" className="icon-btn icon-btn--sm icon-btn--danger" aria-label={`Убрать: ${r.de}`} onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}>
                          <Trash2 size={14} />
                        </button>
                        {issue && <div className="review-note review-note--error">{issue}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <datalist id="review-categories">
            {categories.map((c) => (<option key={c.id} value={c.name} />))}
          </datalist>

          <div className="import-actions">
            <span className="muted-note review-summary">К импорту: {ready.length} из {rows.length}{blocking > 0 ? ` · с ошибками: ${blocking}` : ''}</span>
            <button type="button" className="btn-primary" disabled={busy || ready.length === 0 || blocking > 0} onClick={() => void handleImport()}>
              <Upload size={16} /> {busy ? 'Подождите…' : `Импортировать (${ready.length})`}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
