import React, { useState } from 'react';
import { Upload, Download, CheckCircle, AlertCircle } from 'lucide-react';
import { exportWords, getErrorMessage, importWords } from '../../api/client';
import { reportError } from '../../utils/toast';
import type { Category } from '../../types';

interface ImportExportTabProps {
  categories: Category[];
  onRefresh: () => void;
}

export const ImportExportTab: React.FC<ImportExportTabProps> = ({ categories, onRefresh }) => {
  const [importText, setImportText] = useState('');
  const [targetCategory, setTargetCategory] = useState(categories[0]?.id || '');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleImport = async () => {
    if (!importText.trim() || !targetCategory) return;
    setStatusMsg(null);

    try {
      const { importedCount } = await importWords(importText, targetCategory);
      setStatusMsg({ type: 'success', text: `Успешно импортировано: ${importedCount} слов` });
      setImportText('');
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
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
      <div className="card" style={{ margin: 0 }}>
        <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Upload size={20} /> Импорт слов</h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Формат: <code>Немецкое слово [таб или запятая] Перевод [таб] Множественное число</code>
        </p>

        <select className="text-input" style={{ width: '100%', marginBottom: 12 }} value={targetCategory} onChange={(e) => setTargetCategory(e.target.value)}>
          {categories.map((c) => (<option key={c.id} value={c.id}>{c.icon || '📌'} {c.name}</option>))}
        </select>

        <textarea className="text-input" rows={6} style={{ width: '100%', marginBottom: 12, fontFamily: 'var(--mono)', fontSize: 13 }} placeholder="der Hund&#9;собака&#9;die Hunde&#10;die Katze&#9;кошка&#9;die Katzen" value={importText} onChange={(e) => setImportText(e.target.value)} />

        {statusMsg && (
          <div style={{ fontSize: 13, color: statusMsg.type === 'success' ? 'var(--success)' : 'var(--error)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            {statusMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />} {statusMsg.text}
          </div>
        )}

        <button className="btn-primary" style={{ width: '100%' }} onClick={handleImport}><Upload size={16} /> Запустить импорт</button>
      </div>

      <div className="card" style={{ margin: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Download size={20} /> Экспорт базы слов</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Выгрузить все слова и категории в структурированный JSON формат для резервного копирования или переноса на другой сервер.
          </p>
        </div>
        <button className="btn-secondary" style={{ width: '100%', padding: '14px' }} onClick={handleExport}><Download size={18} /> Скачать JSON базу</button>
      </div>
    </div>
  );
};
