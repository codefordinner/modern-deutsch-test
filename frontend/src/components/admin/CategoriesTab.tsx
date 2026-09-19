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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>Категории словаря ({categories.length})</h3>
        <button className="btn-primary" onClick={onAddCategory}><Plus size={16} /> Добавить категорию</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
        {categories.map((cat) => (
          <div key={cat.id} className="card" style={{ margin: 0, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>{cat.icon || '📌'}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{cat.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{cat._count?.words ?? 0} слов</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => onEditCategory(cat)}><Edit2 size={14} /></button>
              {!cat.isBuiltin && (
                <button className="icon-btn" style={{ width: 30, height: 30, color: 'var(--error)' }} onClick={() => onDeleteCategory(cat.id)}><Trash2 size={14} /></button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
