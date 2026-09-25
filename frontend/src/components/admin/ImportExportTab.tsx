import React, { useState } from 'react';
import { Upload, Download, CheckCircle, AlertCircle } from 'lucide-react';
import { exportWords, getErrorMessage, importWords } from '../../api/client';
import { invalidateQueries } from '../../api/queryCache';
import { WORDS_KEY } from '../../hooks/useDictionary';
import { reportError } from '../../utils/toast';
import { PART_OF_SPEECH_OPTIONS } from '../../utils/partOfSpeech';
import type { Category, PartOfSpeech } from '../../types';

interface ImportExportTabProps {
  categories: Category[];
  onRefresh: () => void;
}

const AUTO = '';

export const ImportExportTab: React.FC<ImportExportTabProps> = ({ categories, onRefresh }) => {
  const [importText, setImportText] = useState('');
  const [targetCategory, setTargetCategory] = useState(categories[0]?.id || '');
  const [importPartOfSpeech, setImportPartOfSpeech] = useState<PartOfSpeech | typeof AUTO>(AUTO);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleImport = async () => {
    if (!importText.trim() || !targetCategory) return;
    setStatusMsg(null);

    try {
      const { importedCount } = await importWords(importText, targetCategory, importPartOfSpeech || undefined);
      setStatusMsg({ type: 'success', text: `Успешно импортировано: ${importedCount} слов` });
      setImportText('');
      invalidateQueries(WORDS_KEY);
      onRefresh();
    } catch (e) {
      setStatusMsg({ type: 'error', text: getErrorMessage(e, 'Ошибка импорта') });
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
    <div className="import-grid">
      <div className="card card--flush">
        <h3 className="card-title"><Upload size={20} /> Импорт слов</h3>
        <p className="card-note">
          Формат: <code>Немецкое слово [таб или запятая] Перевод [таб] Множественное число</code>
        </p>

        <div className="form-grid-2 select-spaced">
          <select className="text-input" value={targetCategory} onChange={(e) => setTargetCategory(e.target.value)}>
            {categories.map((c) => (<option key={c.id} value={c.id}>{c.icon || '📌'} {c.name}</option>))}
          </select>
          <select
            className="text-input"
            value={importPartOfSpeech}
            onChange={(e) => setImportPartOfSpeech(e.target.value as PartOfSpeech | typeof AUTO)}
            title="Часть речи для всех импортируемых строк"
          >
            <option value={AUTO}>Часть речи: автоматически</option>
            {PART_OF_SPEECH_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <textarea
          className="text-input w-full textarea-mono"
          rows={6}
          placeholder="der Hund&#9;собака&#9;die Hunde&#10;die Katze&#9;кошка&#9;die Katzen"
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
        />

        {statusMsg && (
          <div className={`status-msg status-msg--${statusMsg.type}`}>
            {statusMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />} {statusMsg.text}
          </div>
        )}

        <button className="btn-primary btn-block" onClick={handleImport}><Upload size={16} /> Запустить импорт</button>
      </div>

      <div className="card card--flush card--split">
        <div>
          <h3 className="card-title"><Download size={20} /> Экспорт базы слов</h3>
          <p className="card-note">
            Выгрузить все слова и категории в структурированный JSON формат для резервного копирования или переноса на другой сервер.
          </p>
        </div>
        <button className="btn-secondary btn-block btn-export" onClick={handleExport}><Download size={18} /> Скачать JSON базу</button>
      </div>
    </div>
  );
};
