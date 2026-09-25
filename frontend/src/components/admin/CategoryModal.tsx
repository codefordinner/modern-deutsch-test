import React, { useState, useEffect } from 'react';
import { Modal } from '../Modal';
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
    <Modal title={category ? 'Редактировать категорию' : 'Новая категория'} size="sm" onClose={onClose} closeOnBackdrop={false}>
      <form onSubmit={handleSubmit} className="modal-form">
        <div className="modal-body modal-body--form">
          <div>
            <label className="field-label" htmlFor="category-name">Название категории *</label>
            <input id="category-name" type="text" className="text-input w-full" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="form-grid-2">
            <div>
              <label className="field-label" htmlFor="category-icon">Иконка (Emoji)</label>
              <input id="category-icon" type="text" className="text-input w-full" value={icon} onChange={(e) => setIcon(e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="category-color">Цвет</label>
              <input id="category-color" type="color" className="text-input w-full color-input" value={color} onChange={(e) => setColor(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Отмена</button>
          <button type="submit" className="btn-primary">Сохранить</button>
        </div>
      </form>
    </Modal>
  );
};
