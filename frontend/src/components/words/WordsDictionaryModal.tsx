import React, { useState } from 'react';
import { X, Search, Volume2 } from 'lucide-react';
import type { Word, Category } from '../../types';
import { speakGerman } from '../../utils/audio';

interface WordsDictionaryModalProps {
  words: Word[];
  categories: Category[];
  onClose: () => void;
}

export const WordsDictionaryModal: React.FC<WordsDictionaryModalProps> = ({ words, categories, onClose }) => {
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');

  const filtered = words.filter((w) => {
    const matchCat = filterCat === 'all' || w.categoryId === filterCat;
    const matchSearch =
      !search ||
      w.de.toLowerCase().includes(search.toLowerCase()) ||
      w.ru.toLowerCase().includes(search.toLowerCase()) ||
      (w.hint || '').toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: 680, maxHeight: '80vh' }}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>Словарь ({words.length} слов)</h3>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 180px' }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: 12, color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="text-input"
              style={{ width: '100%', paddingLeft: 34, fontSize: 13 }}
              placeholder="Поиск по словарю..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="text-input"
            style={{ flex: '1 1 140px', minWidth: 0, fontSize: 13 }}
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
          >
            <option value="all">Все категории</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
        </div>

        <div className="modal-body" style={{ padding: 0 }}>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>Немецкий</th><th>Перевод</th><th>Формы</th><th>Аудио</th></tr>
              </thead>
              <tbody>
                {filtered.map((w) => (
                  <tr key={w.id}>
                    <td style={{ fontWeight: 600 }}>{w.de}</td>
                    <td>
                      {w.ru}
                      {w.hint && <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{w.hint}</div>}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {w.plural && <div>Pl: {w.plural}</div>}
                      {w.praeteritum && <div>{w.praeteritum} / {w.partizip2}</div>}
                    </td>
                    <td>
                      <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => speakGerman(w.de)}>
                        <Volume2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
