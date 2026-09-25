import React from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import type { Category } from '../../types';

interface CategoriesTabProps {
  categories: Category[];
  onAddCategory: () => void;
  onEditCategory: (cat: Category) => void;
  onDeleteCategory: (id: string) => void;
}

export const CategoriesTab: React.FC<CategoriesTabProps> = ({
  categories,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
}) => {
  return (
    <div>
      <div className="section-toolbar">
        <h3 className="section-heading">Категории словаря ({categories.length})</h3>
        <button className="btn-primary" onClick={onAddCategory}><Plus size={16} /> Добавить категорию</button>
      </div>

      <div className="category-cards">
        {categories.map((cat) => (
          <div key={cat.id} className="card category-card">
            <div className="category-card-main">
              <span className="category-card-icon">{cat.icon || '📌'}</span>
              <div>
                <div className="category-card-name">{cat.name}</div>
                <div className="category-card-count">{cat._count?.words ?? 0} слов</div>
              </div>
            </div>
            <div className="row-actions">
              <button className="icon-btn icon-btn--sm" onClick={() => onEditCategory(cat)} aria-label={`Редактировать: ${cat.name}`}><Edit2 size={14} /></button>
              {!cat.isBuiltin && (
                <button className="icon-btn icon-btn--sm icon-btn--danger" onClick={() => onDeleteCategory(cat.id)} aria-label={`Удалить: ${cat.name}`}><Trash2 size={14} /></button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
