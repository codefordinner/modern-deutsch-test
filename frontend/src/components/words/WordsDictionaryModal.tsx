import React, { useState } from 'react';
import { Search, Volume2 } from 'lucide-react';
import { Modal } from '../Modal';
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
    <Modal title={`Словарь (${words.length} слов)`} size="lg" onClose={onClose}>
      <div className="modal-toolbar">
        <div className="search-field">
          <Search size={16} className="search-field-icon" aria-hidden="true" />
          <input
            type="text"
            className="text-input"
            placeholder="Поиск по словарю..."
            aria-label="Поиск по словарю"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="text-input select-compact"
          aria-label="Категория"
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
        >
          <option value="all">Все категории</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
          ))}
        </select>
      </div>

      <div className="modal-body modal-body--flush">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Немецкий</th><th>Перевод</th><th>Формы</th><th>Аудио</th></tr>
            </thead>
            <tbody>
              {filtered.map((w) => (
                <tr key={w.id}>
                  <td className="cell-strong">{w.de}</td>
                  <td>
                    {w.ru}
                    {w.hint && <div className="cell-hint">{w.hint}</div>}
                  </td>
                  <td className="cell-secondary">
                    {w.plural && <div>Pl: {w.plural}</div>}
                    {w.praeteritum && <div>{w.praeteritum} / {w.partizip2}</div>}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="icon-btn icon-btn--xs"
                      onClick={() => speakGerman(w.de)}
                      aria-label={`Озвучить: ${w.de}`}
                    >
                      <Volume2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
};
