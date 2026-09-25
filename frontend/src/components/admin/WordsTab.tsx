import React from 'react';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import type { Word, Category } from '../../types';

interface WordsTabProps {
  words: Word[];
  categories: Category[];
  search: string;
  selectedCategory: string;
  onSearchChange: (v: string) => void;
  onCategoryChange: (v: string) => void;
  onAddWord: () => void;
  onEditWord: (word: Word) => void;
  onDeleteWord: (id: string) => void;
}

export const WordsTab: React.FC<WordsTabProps> = ({
  words,
  categories,
  search,
  selectedCategory,
  onSearchChange,
  onCategoryChange,
  onAddWord,
  onEditWord,
  onDeleteWord,
}) => {
  return (
    <div>
      <div className="section-toolbar">
        <div className="toolbar-filters">
          <div className="search-field search-field--lg">
            <Search size={16} className="search-field-icon" aria-hidden="true" />
            <input
              type="text"
              className="text-input"
              placeholder="Поиск по DE или RU..."
              aria-label="Поиск по словам"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <select
            className="text-input select-compact select-compact--lg"
            aria-label="Категория"
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
          >
            <option value="all">Все категории</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.icon || '📌'} {c.name}</option>
            ))}
          </select>
        </div>
        <button className="btn-primary" onClick={onAddWord}>
          <Plus size={16} /> Добавить слово
        </button>
      </div>

      <div className="table-frame">
        <table className="data-table">
          <thead>
            <tr>
              <th>Немецкий</th>
              <th>Русский</th>
              <th>Категория</th>
              <th>Дополнительно</th>
              <th className="th-actions">Действия</th>
            </tr>
          </thead>
          <tbody>
            {words.length === 0 ? (
              <tr><td colSpan={5} className="empty-cell">Слова не найдены</td></tr>
            ) : (
              words.map((w) => (
                <tr key={w.id}>
                  <td className="cell-strong">{w.de}</td>
                  <td>
                    {w.ru}
                    {w.hint && <div className="cell-hint">{w.hint}</div>}
                  </td>
                  <td><span className="category-chip">{w.category?.icon} {w.category?.name}</span></td>
                  <td className="cell-secondary">
                    {w.plural && <div>Pl: {w.plural}</div>}
                    {w.praeteritum && <div>{w.praeteritum} / {w.partizip2} ({w.hilfsverb})</div>}
                  </td>
                  <td className="td-actions">
                    <div className="row-actions">
                      <button className="icon-btn icon-btn--sm" onClick={() => onEditWord(w)} aria-label={`Редактировать: ${w.de}`}><Edit2 size={14} /></button>
                      <button className="icon-btn icon-btn--sm icon-btn--danger" onClick={() => onDeleteWord(w.id)} aria-label={`Удалить: ${w.de}`}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
