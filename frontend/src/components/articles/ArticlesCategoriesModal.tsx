import React from 'react';
import { CheckSquare, Square } from 'lucide-react';
import { Modal } from '../Modal';
import type { Category } from '../../types';

interface ArticlesCategoriesModalProps {
  categories: Category[];
  /** Selected category ids, or `['all']`. */
  selected: string[];
  /** How many nouns (cards) each category has — a noun is counted in every category it belongs to. */
  counts: Record<string, number>;
  onChange: (cats: string[]) => void;
  onClose: () => void;
}

/** Multi-select of the categories the articles trainer asks from. */
export const ArticlesCategoriesModal: React.FC<ArticlesCategoriesModalProps> = ({
  categories,
  selected,
  counts,
  onChange,
  onClose,
}) => {
  const isAllSelected = selected.includes('all');

  const toggle = (id: string) => {
    if (isAllSelected) {
      onChange(categories.map((c) => c.id).filter((cId) => cId !== id));
      return;
    }
    if (selected.includes(id)) {
      onChange(selected.filter((c) => c !== id));
    } else {
      const next = [...selected, id];
      onChange(next.length === categories.length ? ['all'] : next);
    }
  };

  return (
    <Modal title="Категории для артиклей" size="md" onClose={onClose}>
      <div className="modal-body modal-body--stack">
        <div role="group" aria-labelledby="articles-categories-title">
          <div className="section-head">
            <span id="articles-categories-title" className="settings-group-title">
              Категории ({categories.length})
            </span>
            <div className="section-head-actions">
              <button type="button" className="btn-secondary btn-xs" onClick={() => onChange(['all'])}>
                <CheckSquare size={12} /> Все
              </button>
              <button type="button" className="btn-secondary btn-xs" onClick={() => onChange([])}>
                <Square size={12} /> Очистить
              </button>
            </div>
          </div>

          <div className="category-picker">
            {categories.map((c) => {
              const checked = isAllSelected || selected.includes(c.id);
              return (
                <label key={c.id} className={`category-option ${checked ? 'is-checked' : ''}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggle(c.id)} />
                  <span className="category-option-label">
                    {c.icon} {c.name} ({counts[c.id] ?? 0})
                  </span>
                </label>
              );
            })}
          </div>
          <div className="muted-note category-primary-note">
            В скобках — существительные с артиклем. Слово из нескольких выбранных категорий задаётся один раз.
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn-primary" onClick={onClose}>Готово</button>
      </div>
    </Modal>
  );
};
