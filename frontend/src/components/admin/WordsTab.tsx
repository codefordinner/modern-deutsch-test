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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 10, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 180px' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="text-input"
              style={{ width: '100%', paddingLeft: 36, fontSize: 14 }}
              placeholder="Поиск по DE или RU..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <select
            className="text-input"
            style={{ flex: '1 1 140px', minWidth: 0, fontSize: 14 }}
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

      <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 10 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Немецкий</th>
              <th>Русский</th>
              <th>Категория</th>
              <th>Дополнительно</th>
              <th style={{ width: 90, textAlign: 'right' }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {words.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 30 }}>Слова не найдены</td></tr>
            ) : (
              words.map((w) => (
                <tr key={w.id}>
                  <td style={{ fontWeight: 600 }}>{w.de}</td>
                  <td>
                    {w.ru}
                    {w.hint && <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{w.hint}</div>}
                  </td>
                  <td><span style={{ fontSize: 12, background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 6 }}>{w.category?.icon} {w.category?.name}</span></td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {w.plural && <div>Pl: {w.plural}</div>}
                    {w.praeteritum && <div>{w.praeteritum} / {w.partizip2} ({w.hilfsverb})</div>}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 4 }}>
                      <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => onEditWord(w)}><Edit2 size={14} /></button>
                      <button className="icon-btn" style={{ width: 30, height: 30, color: 'var(--error)' }} onClick={() => onDeleteWord(w.id)}><Trash2 size={14} /></button>
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
