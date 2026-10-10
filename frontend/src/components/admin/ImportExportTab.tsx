import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, ClipboardCheck, Copy, Download, Sparkles, Upload } from 'lucide-react';
import { exportWords, getErrorMessage, importWords } from '../../api/client';
import type { ImportResult } from '../../api/client';
import { invalidateQueries } from '../../api/queryCache';
import { CATEGORIES_KEY, WORDS_KEY } from '../../hooks/useDictionary';
import { reportError, showToast } from '../../utils/toast';
import type { Category } from '../../types';

interface ImportExportTabProps {
  categories: Category[];
  onRefresh: () => void;
}

const MAX_SHOWN = 30;

/** The instruction an admin pastes into an AI chat together with a raw word list. */
function buildAiPrompt(categories: Category[]): string {
  const categoryList = categories.length > 0 ? categories.map((c) => `«${c.name}»`).join(', ') : '(пока нет — придумай подходящие)';

  return `Ты помогаешь наполнять словарь тренажёра немецкого языка. Ниже я пришлю список слов (немецкие, русские или вперемешку). Преврати его в JSON и верни ТОЛЬКО JSON — одним блоком кода, без пояснений до и после.

ФОРМАТ: массив объектов, один объект на слово.

Поля:
- "de" (обязательно) — немецкое слово. Существительные ВСЕГДА с артиклем: "der Tisch", "die Stadt". Глаголы — инфинитив: "gehen". Если слово дано только по-русски — подбери немецкое.
- "ru" (обязательно) — перевод на русский. Несколько значений через запятую: "идти, ходить".
- "category" — название категории. Существующие: ${categoryList}. Выбирай из них; если ничего не подходит — придумай короткое новое название.
- "partOfSpeech" — ровно одно из: "noun", "verb", "adjective", "adverb", "other".
- "hint" — короткая подсказка, чтобы различать омонимы: "замок (здание)". Только если нужно.
- "plural" — множественное число с артиклем: "die Tische" (для существительных).
- "feminine" — женская форма профессий/людей: "die Ärztin". "femininePlural" — её мн. число: "die Ärztinnen". Только если такая форма существует.
- Только для глаголов:
  "praeteritum" — Präteritum, 3 л. ед. ч.: "ging";
  "partizip2" — Partizip II: "gegangen";
  "hilfsverb" — строго "haben" или "sein";
  "praesensIch", "praesensDu", "praesensErSieEs", "praesensIhr" — формы Präsens (обязательно для сильных глаголов и глаголов с изменением корня: "fährst", "liest"); "praesensWir" и "praesensSie" можно не указывать — они равны инфинитиву.

ПРАВИЛА:
1. Не добавляй никаких других полей. Пустые или неизвестные поля просто не пиши.
2. Не выдумывай формы. Если не уверен в форме глагола — лучше пропусти поле, чем ошибись.
3. Не меняй написание слов из моего списка, кроме добавления артикля и исправления явных опечаток.
4. Не пиши одно и то же слово дважды.
5. Ответ должен быть валидным JSON: двойные кавычки, без комментариев и без запятой после последнего элемента.

ПРИМЕР:
\`\`\`json
[
  {"de": "der Tisch", "ru": "стол", "category": "Повседневные слова", "partOfSpeech": "noun", "plural": "die Tische"},
  {"de": "der Arzt", "ru": "врач", "category": "Профессии", "partOfSpeech": "noun", "plural": "die Ärzte", "feminine": "die Ärztin", "femininePlural": "die Ärztinnen"},
  {"de": "gehen", "ru": "идти, ходить", "category": "Глаголы", "partOfSpeech": "verb", "praeteritum": "ging", "partizip2": "gegangen", "hilfsverb": "sein", "praesensIch": "gehe", "praesensDu": "gehst", "praesensErSieEs": "geht", "praesensIhr": "geht"}
]
\`\`\`

МОЙ СПИСОК СЛОВ:
`;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for non-secure contexts (plain http) where the Clipboard API is unavailable.
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      document.body.removeChild(area);
    }
  }
}

const ResultList: React.FC<{ title: string; items: string[] }> = ({ title, items }) => {
  if (items.length === 0) return null;
  return (
    <div className="import-result-block">
      <div className="import-result-heading">{title}</div>
      <ul className="import-result-list">
        {items.slice(0, MAX_SHOWN).map((item, i) => (
          <li key={i}>{item}</li>
        ))}
        {items.length > MAX_SHOWN && <li>…и ещё {items.length - MAX_SHOWN}</li>}
      </ul>
    </div>
  );
};

const ImportReport: React.FC<{ result: ImportResult }> = ({ result }) => {
  const errorLines = result.errors.map((e) => `Слово №${e.row}${e.de ? ` («${e.de}»)` : ''}: ${e.message}`);
  const hasProblems = result.errors.length > 0;

  return (
    <div className={`import-result ${hasProblems ? 'import-result--warn' : 'import-result--ok'}`} role="status">
      <div className="import-result-title">
        {hasProblems ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
        {result.dryRun
          ? `Проверка: будет добавлено ${result.importedCount} из ${result.total}`
          : `Добавлено слов: ${result.importedCount} из ${result.total}`}
      </div>
      <ResultList
        title={result.dryRun ? 'Будут созданы категории:' : 'Созданы категории:'}
        items={result.newCategories}
      />
      <ResultList title={`Уже есть в словаре, пропущено (${result.duplicates.length}):`} items={result.duplicates} />
      <ResultList title={`Ошибки, эти слова пропущены (${result.errors.length}):`} items={errorLines} />
    </div>
  );
};

export const ImportExportTab: React.FC<ImportExportTabProps> = ({ categories, onRefresh }) => {
  const [importText, setImportText] = useState('');
  const [defaultCategory, setDefaultCategory] = useState('');
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const prompt = useMemo(() => buildAiPrompt(categories), [categories]);

  const handleCopyPrompt = async () => {
    const ok = await copyToClipboard(prompt);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } else {
      showToast('Не удалось скопировать — выделите текст вручную');
    }
  };

  const handleTextChange = (value: string) => {
    setImportText(value);
    // A previous report belongs to the previous text.
    setResult(null);
    setImportError(null);
  };

  const run = async (dryRun: boolean) => {
    if (!importText.trim() || busy) return;
    setBusy(true);
    setImportError(null);
    try {
      const outcome = await importWords({
        data: importText,
        defaultCategoryId: defaultCategory || undefined,
        skipDuplicates,
        dryRun,
      });
      setResult(outcome);
      if (!dryRun) {
        invalidateQueries(WORDS_KEY);
        invalidateQueries(CATEGORIES_KEY);
        onRefresh();
        if (outcome.importedCount > 0 && outcome.errors.length === 0) setImportText('');
      }
    } catch (e) {
      setResult(null);
      setImportError(getErrorMessage(e, 'Ошибка импорта'));
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async () => {
    try {
      const data = await exportWords();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deutsch-words-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      reportError(e, 'Ошибка экспорта');
    }
  };

  return (
    <div className="import-layout">
      <div className="card card--flush">
        <h3 className="card-title"><Sparkles size={20} /> Импорт слов через нейросеть</h3>

        <div className="import-step">
          <div className="import-step-title"><span className="import-step-num">1</span> Скопируйте инструкцию</div>
          <p className="card-note">
            Вставьте её в чат с нейросетью (ChatGPT, Claude, Gemini…) и допишите в конце свой список слов — в любом виде.
            Инструкция уже содержит формат и список ваших текущих категорий.
          </p>
          <textarea className="text-input w-full textarea-mono import-prompt" rows={8} readOnly value={prompt} aria-label="Инструкция для нейросети" />
          <button type="button" className="btn-secondary import-copy-btn" onClick={handleCopyPrompt}>
            {copied ? <ClipboardCheck size={16} /> : <Copy size={16} />} {copied ? 'Скопировано' : 'Скопировать инструкцию'}
          </button>
        </div>

        <div className="import-step">
          <div className="import-step-title"><span className="import-step-num">2</span> Вставьте ответ нейросети</div>
          <p className="card-note">
            Подойдёт JSON вместе с обёрткой <code>```json</code>. Также принимается простой текст: слово на строку,
            колонки через Tab или «;» — <code>der Hund; собака; die Hunde; подсказка</code>.
          </p>
          <textarea
            className="text-input w-full textarea-mono"
            rows={9}
            placeholder={'[\n  {"de": "der Hund", "ru": "собака", "category": "Животные", "partOfSpeech": "noun", "plural": "die Hunde"}\n]'}
            value={importText}
            onChange={(e) => handleTextChange(e.target.value)}
            aria-label="Данные для импорта"
          />

          <div className="form-grid-2 select-spaced">
            <select
              className="text-input"
              value={defaultCategory}
              onChange={(e) => setDefaultCategory(e.target.value)}
              aria-label="Категория по умолчанию"
              title="Для слов, у которых category не указана"
            >
              <option value="">Категория по умолчанию: не задана</option>
              {categories.map((c) => (<option key={c.id} value={c.id}>{c.icon || '📌'} {c.name}</option>))}
            </select>
            <label className="setting-toggle setting-toggle--center">
              <input type="checkbox" checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)} />
              <span>Пропускать слова, которые уже есть</span>
            </label>
          </div>

          {importError && (
            <div className="status-msg status-msg--error" role="alert"><AlertCircle size={16} /> {importError}</div>
          )}
          {result && <ImportReport result={result} />}

          <div className="import-actions">
            <button type="button" className="btn-secondary" disabled={busy || !importText.trim()} onClick={() => run(true)}>
              <CheckCircle size={16} /> Проверить
            </button>
            <button type="button" className="btn-primary" disabled={busy || !importText.trim()} onClick={() => run(false)}>
              <Upload size={16} /> {busy ? 'Подождите…' : 'Импортировать'}
            </button>
          </div>
        </div>
      </div>

      <div className="card card--flush card--split">
        <div>
          <h3 className="card-title"><Download size={20} /> Экспорт базы слов</h3>
          <p className="card-note">
            Выгрузка всех слов и категорий в JSON — в том же формате, что читает импорт. Годится для резервной копии,
            переноса на другой сервер или чтобы отдать словарь нейросети на анализ. Файл можно вставить обратно в
            импорт: уже существующие слова будут пропущены.
          </p>
        </div>
        <button className="btn-secondary btn-block btn-export" onClick={handleExport}><Download size={18} /> Скачать JSON базу</button>
      </div>
    </div>
  );
};
