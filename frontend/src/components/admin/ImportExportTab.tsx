import React, { useState } from 'react';
import { Upload, Download, CheckCircle, AlertCircle } from 'lucide-react';
import type { Category } from '../../types';

interface ImportExportTabProps {
  categories: Category[];
  token: string | null;
  onRefresh: () => void;
}

export const ImportExportTab: React.FC<ImportExportTabProps> = ({ categories, token, onRefresh }) => {
  const [importText, setImportText] = useState('');
  const [targetCategory, setTargetCategory] = useState(categories[0]?.id || '');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleImport = async () => {
    if (!importText.trim() || !targetCategory) return;
    setStatusMsg(null);

    try {
      const res = await fetch('/api/words/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ data: importText, defaultCategoryId: targetCategory }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMsg({ type: 'success', text: `Успешно импортировано: ${data.importedCount} слов` });
        setImportText('');
        onRefresh();
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Ошибка импорта' });
      }
    } catch {
      setStatusMsg({ type: 'error', text: 'Ошибка соединения с сервером' });
    }
  };

  const handleExport = async () => {
    try {
      const res = await fetch('/api/words/export', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deutsch-words-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
    } catch {
      alert('Ошибка экспорта');
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
