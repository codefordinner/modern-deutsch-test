import React from 'react';
import { X, CheckSquare, Square } from 'lucide-react';
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
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: 520, maxHeight: '88vh' }}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>Настройки тренировки слов</h3>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Categories */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 700 }}>Категории слов ({categories.length})</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }} onClick={selectAll}>
                  <CheckSquare size={12} /> Все
                </button>
                <button type="button" className="btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }} onClick={clearAll}>
                  <Square size={12} /> Очистить
                </button>
              </div>
            </div>

            {/* NOTE: was a fixed `1fr 1fr` grid, which cramps category
                labels on very narrow phones (~320px). `auto-fit` with a
                min column width lets it collapse to a single column when
                needed instead of truncating text. */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, maxHeight: 180, overflowY: 'auto', padding: 4, background: 'var(--bg-tertiary)', borderRadius: 10 }}>
              {categories.map((c) => {
                const checked = isAllSelected || selectedCategories.includes(c.id);
                return (
                  <label
                    key={c.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: checked ? 'var(--accent-light)' : 'transparent',
                      border: `1px solid ${checked ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCategory(c.id)}
                      style={{ accentColor: 'var(--accent-primary)' }}
                    />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.icon} {c.name} ({c._count?.words ?? 0})
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Form Types */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 8 }}>Формы слов для тренировки</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={enableBase}
                  onChange={(e) => onEnableBaseChange(e.target.checked)}
                  style={{ accentColor: 'var(--accent-primary)' }}
                />
                <span>Базовая форма слова (der Tisch, das Buch, gehen)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={enablePlural}
                  onChange={(e) => onEnablePluralChange(e.target.checked)}
                  style={{ accentColor: 'var(--accent-primary)' }}
                />
                <span>Множественное число / Plural (die Tische, die Bücher)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={enableFeminine}
                  onChange={(e) => onEnableFeminineChange(e.target.checked)}
                  style={{ accentColor: 'var(--accent-primary)' }}
                />
                <span>Женский род / Feminin (der Arzt → die Ärztin, der Lehrer → die Lehrerin)</span>
              </label>
            </div>
          </div>

          {/* Article Requirement */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={requireArticle}
                onChange={(e) => onRequireArticleChange(e.target.checked)}
                style={{ accentColor: 'var(--accent-primary)' }}
              />
              <span>Строго требовать артикль (der / die / das)</span>
            </label>
          </div>

          {/* SRS Mode Toggle */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 14 }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={useSRS}
                onChange={(e) => onUseSRSChange(e.target.checked)}
                style={{ accentColor: 'var(--accent-primary)', marginTop: 3 }}
              />
              <div>
                <span style={{ fontWeight: 600, display: 'block', color: 'var(--text-primary)' }}>
                  Интервальное повторение (SRS Лейтнера)
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {useSRS
                    ? 'Включено: сложные слова повторяются чаще (система 5 ящиков).'
                    : 'Отключено: чистый случайный выбор слов (чистый рандом без ящиков).'}
                </span>
              </div>
            </label>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>Сохранить</button>
        </div>
      </div>
    </div>
  );
};
