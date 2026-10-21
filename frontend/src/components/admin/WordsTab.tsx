import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import { PART_OF_SPEECH_OPTIONS } from '../../utils/partOfSpeech';
import type { Word, Category, PartOfSpeech } from '../../types';

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
  /** Bulk actions resolve to `true` when they succeeded (the selection is then cleared). */
  onBulkCategory: (ids: string[], categoryId: string) => Promise<boolean>;
  onBulkPartOfSpeech: (ids: string[], partOfSpeech: PartOfSpeech | null) => Promise<boolean>;
  onBulkDelete: (ids: string[]) => Promise<boolean>;
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
  onBulkCategory,
  onBulkPartOfSpeech,
  onBulkDelete,
}) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetCategory, setTargetCategory] = useState('');
  const [targetPos, setTargetPos] = useState('');
  const [busy, setBusy] = useState(false);

  // Only words that are currently listed count (a filter change must not act on hidden rows).
  const selectedIds = words.filter((w) => selected.has(w.id)).map((w) => w.id);
  const allSelected = words.length > 0 && selectedIds.length === words.length;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(words.map((w) => w.id)));

  const run = async (action: () => Promise<boolean>) => {
    setBusy(true);
    try {
      if (await action()) setSelected(new Set());
    } finally {
      setBusy(false);
    }
  };

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

      {selectedIds.length > 0 && (
        <div className="bulk-bar" role="region" aria-label="Массовые действия">
          <strong className="bulk-count">Выбрано: {selectedIds.length}</strong>

          <div className="bulk-group">
            <select className="text-input select-compact" aria-label="Новая категория" value={targetCategory} onChange={(e) => setTargetCategory(e.target.value)}>
              <option value="">Перенести в категорию…</option>
              {categories.map((c) => (<option key={c.id} value={c.id}>{c.icon || '📌'} {c.name}</option>))}
            </select>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy || !targetCategory}
              onClick={() => run(() => onBulkCategory(selectedIds, targetCategory))}
            >
              Перенести
            </button>
          </div>

          <div className="bulk-group">
            <select className="text-input select-compact" aria-label="Новая часть речи" value={targetPos} onChange={(e) => setTargetPos(e.target.value)}>
              <option value="">Часть речи…</option>
              {PART_OF_SPEECH_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              <option value="__auto">Сбросить (не указана)</option>
            </select>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy || !targetPos}
              onClick={() => run(() => onBulkPartOfSpeech(selectedIds, targetPos === '__auto' ? null : (targetPos as PartOfSpeech)))}
            >
              Применить
            </button>
          </div>

          <button
            type="button"
            className="btn-secondary btn-danger-text"
            disabled={busy}
            onClick={() => {
              if (confirm(`Удалить выбранные слова (${selectedIds.length})? Это нельзя отменить.`)) {
                void run(() => onBulkDelete(selectedIds));
              }
            }}
          >
            <Trash2 size={14} /> Удалить
          </button>
          <button type="button" className="btn-secondary" onClick={() => setSelected(new Set())}>Снять выбор</button>
        </div>
      )}

      <div className="table-frame">
        <table className="data-table">
          <thead>
            <tr>
              <th className="th-check">
                <input type="checkbox" aria-label="Выбрать все" checked={allSelected} onChange={toggleAll} disabled={words.length === 0} />
              </th>
              <th>Немецкий</th>
              <th>Русский</th>
              <th>Категория</th>
              <th>Дополнительно</th>
              <th className="th-actions">Действия</th>
            </tr>
          </thead>
          <tbody>
            {words.length === 0 ? (
              <tr><td colSpan={6} className="empty-cell">Слова не найдены</td></tr>
            ) : (
              words.map((w) => (
                <tr key={w.id}>
                  <td className="th-check">
                    <input type="checkbox" aria-label={`Выбрать: ${w.de}`} checked={selected.has(w.id)} onChange={() => toggle(w.id)} />
                  </td>
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
