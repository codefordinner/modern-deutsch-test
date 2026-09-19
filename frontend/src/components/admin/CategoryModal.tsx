import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Category } from '../../types';

interface CategoryModalProps {
  category: Category | null;
  onClose: () => void;
  onSave: (catData: Partial<Category>) => Promise<void>;
}

export const CategoryModal: React.FC<CategoryModalProps> = ({ category, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📌');
  const [color, setColor] = useState('#6366f1');

  useEffect(() => {
    if (category) {
      setName(category.name);
      setIcon(category.icon || '📌');
      setColor(category.color || '#6366f1');
    }
  }, [category]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    onSave({ name, icon, color });
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>{category ? 'Редактировать категорию' : 'Новая категория'}</h3>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Название категории *</label>
              <input type="text" className="text-input" style={{ width: '100%' }} value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Иконка (Emoji)</label>
                <input type="text" className="text-input" style={{ width: '100%' }} value={icon} onChange={(e) => setIcon(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Цвет</label>
                <input type="color" className="text-input" style={{ width: '100%', height: 46, padding: 4 }} value={color} onChange={(e) => setColor(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn-primary">Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  );
};
