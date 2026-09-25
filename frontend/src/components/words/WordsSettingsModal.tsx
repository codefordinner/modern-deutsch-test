import React from 'react';
import { CheckSquare, Square } from 'lucide-react';
import { Modal } from '../Modal';
import type { Category } from '../../types';

interface WordsSettingsModalProps {
  categories: Category[];
  selectedCategories: string[];
  requireArticle: boolean;
  enableBase: boolean;
  enablePlural: boolean;
  enableFeminine: boolean;
  useSRS: boolean;
  onClose: () => void;
  onCategoriesChange: (cats: string[]) => void;
  onRequireArticleChange: (req: boolean) => void;
  onEnableBaseChange: (val: boolean) => void;
  onEnablePluralChange: (val: boolean) => void;
  onEnableFeminineChange: (val: boolean) => void;
  onUseSRSChange: (val: boolean) => void;
}

export const WordsSettingsModal: React.FC<WordsSettingsModalProps> = ({
  categories,
  selectedCategories,
  requireArticle,
  enableBase,
  enablePlural,
  enableFeminine,
  useSRS,
  onClose,
  onCategoriesChange,
  onRequireArticleChange,
  onEnableBaseChange,
  onEnablePluralChange,
  onEnableFeminineChange,
  onUseSRSChange,
}) => {
  const isAllSelected = selectedCategories.includes('all');

  const toggleCategory = (id: string) => {
    if (isAllSelected) {
      const allIds = categories.map((c) => c.id);
      onCategoriesChange(allIds.filter((cId) => cId !== id));
      return;
    }
    if (selectedCategories.includes(id)) {
      onCategoriesChange(selectedCategories.filter((c) => c !== id));
    } else {
      const next = [...selectedCategories, id];
      onCategoriesChange(next.length === categories.length ? ['all'] : next);
    }
  };

  const selectAll = () => onCategoriesChange(['all']);
  const clearAll = () => onCategoriesChange([]);

  return (
    <Modal title="Настройки тренировки слов" size="md" onClose={onClose}>
      <div className="modal-body modal-body--stack">
        {/* Categories */}
        <div role="group" aria-labelledby="words-settings-categories">
          <div className="section-head">
            <span id="words-settings-categories" className="settings-group-title">
              Категории слов ({categories.length})
            </span>
            <div className="section-head-actions">
              <button type="button" className="btn-secondary btn-xs" onClick={selectAll}>
                <CheckSquare size={12} /> Все
              </button>
              <button type="button" className="btn-secondary btn-xs" onClick={clearAll}>
                <Square size={12} /> Очистить
              </button>
            </div>
          </div>

          {/* auto-fit with a minimum column width lets the grid collapse to a
              single column on very narrow phones instead of truncating labels. */}
          <div className="category-picker">
            {categories.map((c) => {
              const checked = isAllSelected || selectedCategories.includes(c.id);
              return (
                <label key={c.id} className={`category-option ${checked ? 'is-checked' : ''}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggleCategory(c.id)} />
                  <span className="category-option-label">
                    {c.icon} {c.name} ({c._count?.words ?? 0})
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Form Types */}
        <div role="group" aria-labelledby="words-settings-forms">
          <span id="words-settings-forms" className="settings-group-title">Формы слов для тренировки</span>
          <div className="settings-stack">
            <label className="setting-toggle setting-toggle--center">
              <input type="checkbox" checked={enableBase} onChange={(e) => onEnableBaseChange(e.target.checked)} />
              <span>Базовая форма слова (der Tisch, das Buch, gehen)</span>
            </label>

            <label className="setting-toggle setting-toggle--center">
              <input type="checkbox" checked={enablePlural} onChange={(e) => onEnablePluralChange(e.target.checked)} />
              <span>Множественное число / Plural (die Tische, die Bücher)</span>
            </label>

            <label className="setting-toggle setting-toggle--center">
              <input type="checkbox" checked={enableFeminine} onChange={(e) => onEnableFeminineChange(e.target.checked)} />
              <span>Женский род / Feminin (der Arzt → die Ärztin, der Lehrer → die Lehrerin)</span>
            </label>
          </div>
        </div>

        {/* Article Requirement */}
        <label className="setting-toggle setting-toggle--center">
          <input type="checkbox" checked={requireArticle} onChange={(e) => onRequireArticleChange(e.target.checked)} />
          <span>Строго требовать артикль (der / die / das)</span>
        </label>

        {/* SRS Mode Toggle */}
        <div className="settings-divider">
          <label className="setting-toggle">
            <input type="checkbox" checked={useSRS} onChange={(e) => onUseSRSChange(e.target.checked)} />
            <div>
              <span className="setting-toggle-title">Интервальное повторение (SRS Лейтнера)</span>
              <span className="setting-toggle-desc">
                {useSRS
                  ? 'Включено: сложные слова повторяются чаще (система 5 ящиков).'
                  : 'Отключено: чистый случайный выбор слов (чистый рандом без ящиков).'}
              </span>
            </div>
          </label>
        </div>
      </div>

      <div className="modal-footer">
        <button type="button" className="btn-primary" onClick={onClose}>Сохранить</button>
      </div>
    </Modal>
  );
};
