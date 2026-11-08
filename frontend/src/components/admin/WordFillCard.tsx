import React, { useState } from 'react';
import { AlertCircle, CheckCircle, Sparkles, Upload } from 'lucide-react';
import { fillWordsViaAI } from '../../api/settings';
import { importWords } from '../../api/adminWords';
import { getErrorMessage } from '../../api/request';
import type { ImportResult } from '../../api/adminWords';
import { invalidateQueries } from '../../api/queryCache';
import { CATEGORIES_KEY, WORDS_KEY } from '../../hooks/useDictionary';
import { showToast } from '../../utils/toast';
import type { Category } from '../../types';

interface WordFillCardProps {
  categories: Category[];
  onRefresh: () => void;
}

/**
 * One-click "fill the word list with AI": the admin pastes raw words (any form),
 * Gemini turns them into the structured JSON the import understands, and the
 * result is imported right here — with the same duplicate/validation rules as
 * the regular import.
 */
export const WordFillCard: React.FC<WordFillCardProps> = ({ categories, onRefresh }) => {
  const [text, setText] = useState('');
  const [defaultCategory, setDefaultCategory] = useState('');
  const [generated, setGenerated] = useState<string>('');
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'fill' | 'import'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const resetResult = () => {
    setError(null);
    setResult(null);
  };

  const handleFill = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setPhase('fill');
    resetResult();
    try {
      const outcome = await fillWordsViaAI(text, categories.map((c) => c.name), defaultCategory || undefined);
      setGenerated(outcome.json);
      setCount(outcome.count);
      showToast(`ИИ заполнил ${outcome.count} слов. Проверьте результат и импортируйте.`, 'success');
    } catch (e) {
      setError(getErrorMessage(e, 'Не удалось заполнить слова через ИИ'));
    } finally {
      setBusy(false);
      setPhase('idle');
    }
  };

  const handleImport = async () => {
    if (!generated.trim() || busy) return;
    setBusy(true);
    setPhase('import');
    resetResult();
    try {
      const outcome = await importWords({
        data: generated,
        defaultCategoryId: defaultCategory || undefined,
        skipDuplicates: true,
      });
      setResult(outcome);
      invalidateQueries(WORDS_KEY);
      invalidateQueries(CATEGORIES_KEY);
      onRefresh();
      if (outcome.errors.length === 0) {
        setText('');
        setGenerated('');
        setCount(null);
      }
    } catch (e) {
      setError(getErrorMessage(e, 'Ошибка импорта'));
    } finally {
      setBusy(false);
      setPhase('idle');
    }
  };

  const errorLines = result?.errors.map((e) => `Слово №${e.row}${e.de ? ` («${e.de}»)` : ''}: ${e.message}`) ?? [];

  return (
    <div className="card card--flush">
      <h3 className="card-title"><Sparkles size={20} /> Заполнение слов через ИИ</h3>
      <p className="card-note">
        Введите список слов в любом виде (по одному в строке, через запятую, только по-русски или только по-немецки).
        Gemini заполнит артикли, переводы, множественное число, формы глаголов и категории — по инструкции из вкладки «ИИ».
      </p>

      <div className="import-step">
        <div className="import-step-title"><span className="import-step-num">1</span> Введите слова</div>
        <textarea
          className="text-input w-full textarea-mono"
          rows={7}
          placeholder={'Hund\nKatze\nстол\ngehen\nArzt'}
          value={text}
          onChange={(e) => { setText(e.target.value); resetResult(); }}
          aria-label="Список слов для заполнения"
        />
        <div className="form-grid-2 select-spaced">
          <select
            className="text-input"
            value={defaultCategory}
            onChange={(e) => setDefaultCategory(e.target.value)}
            aria-label="Категория по умолчанию"
            title="Для слов, у которых ИИ не определит категорию"
          >
            <option value="">Категория по умолчанию: пусть ИИ решит</option>
            {categories.map((c) => (<option key={c.id} value={c.id}>{c.icon || '📌'} {c.name}</option>))}
          </select>
          <button type="button" className="btn-primary" disabled={busy || !text.trim()} onClick={() => void handleFill()}>
            <Sparkles size={16} /> {phase === 'fill' ? 'ИИ думает…' : 'Заполнить через ИИ'}
          </button>
        </div>
      </div>

      {error && <div className="status-msg status-msg--error" role="alert"><AlertCircle size={16} /> {error}</div>}

      {generated && (
        <div className="import-step">
          <div className="import-step-title"><span className="import-step-num">2</span> Проверьте и импортируйте {count !== null && <span className="muted-note">· слов: {count}</span>}</div>
          <p className="card-note">Результат можно отредактировать перед импортом.</p>
          <textarea
            className="text-input w-full textarea-mono import-prompt"
            rows={10}
            value={generated}
            onChange={(e) => { setGenerated(e.target.value); resetResult(); }}
            aria-label="Заполненный JSON"
          />
          {result && (
            <div className={`import-result ${result.errors.length > 0 ? 'import-result--warn' : 'import-result--ok'}`} role="status">
              <div className="import-result-title">
                {result.errors.length > 0 ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
                Добавлено слов: {result.importedCount} из {result.total}
              </div>
              {result.newCategories.length > 0 && <div className="muted-note">Созданы категории: {result.newCategories.join(', ')}</div>}
              {result.duplicates.length > 0 && <div className="muted-note">Уже были в словаре: {result.duplicates.length}</div>}
              {errorLines.length > 0 && (
                <ul className="import-result-list">
                  {errorLines.slice(0, 20).map((line, i) => (<li key={i}>{line}</li>))}
                </ul>
              )}
            </div>
          )}
          <div className="import-actions">
            <button type="button" className="btn-primary" disabled={busy || !generated.trim()} onClick={() => void handleImport()}>
              <Upload size={16} /> {phase === 'import' ? 'Импортируем…' : 'Добавить в словарь'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
