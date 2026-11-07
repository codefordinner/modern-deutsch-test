import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Modal } from '../Modal';
import { PART_OF_SPEECH_OPTIONS } from '../../utils/partOfSpeech';
import { wordCategoryIds } from '../../utils/wordCategories';
import type { PartOfSpeech, Word, Category } from '../../types';

interface WordModalProps {
  word: Word | null;
  categories: Category[];
  onClose: () => void;
  onSave: (wordData: Partial<Word>) => Promise<void>;
}

/** '' in the <select> means "let the server infer it from the rest of the entry". */
const AUTO = '';

export const WordModal: React.FC<WordModalProps> = ({ word, categories, onClose, onSave }) => {
  const [de, setDe] = useState('');
  const [ru, setRu] = useState('');
  const [hint, setHint] = useState('');
  const [partOfSpeech, setPartOfSpeech] = useState<PartOfSpeech | typeof AUTO>(AUTO);
  const [plural, setPlural] = useState('');
  const [feminine, setFeminine] = useState('');
  const [femininePlural, setFemininePlural] = useState('');
  const [praeteritum, setPraeteritum] = useState('');
  const [partizip2, setPartizip2] = useState('');
  const [hilfsverb, setHilfsverb] = useState('haben');
  const [praesensIch, setPraesensIch] = useState('');
  const [praesensDu, setPraesensDu] = useState('');
  const [praesensErSieEs, setPraesensErSieEs] = useState('');
  const [praesensWir, setPraesensWir] = useState('');
  const [praesensIhr, setPraesensIhr] = useState('');
  const [praesensSie, setPraesensSie] = useState('');
  const [showConjugation, setShowConjugation] = useState(false);
  /** The word's categories in the order they were ticked; the first one is the primary one. */
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const LAST_CATEGORY_KEY = 'admin_last_word_category_id';

  useEffect(() => {
    if (word) {
      setDe(word.de);
      setRu(word.ru);
      setHint(word.hint || '');
      setPartOfSpeech(word.partOfSpeech ?? AUTO);
      setPlural(word.plural || '');
      setFeminine(word.feminine || '');
      setFemininePlural(word.femininePlural || '');
      setPraeteritum(word.praeteritum || '');
      setPartizip2(word.partizip2 || '');
      setHilfsverb(word.hilfsverb || 'haben');
      setPraesensIch(word.praesensIch || '');
      setPraesensDu(word.praesensDu || '');
      setPraesensErSieEs(word.praesensErSieEs || '');
      setPraesensWir(word.praesensWir || '');
      setPraesensIhr(word.praesensIhr || '');
      setPraesensSie(word.praesensSie || '');
      if (word.praesensIch || word.praesensDu || word.praesensErSieEs) {
        setShowConjugation(true);
      }
      setCategoryIds(wordCategoryIds(word));
    } else if (categories.length > 0) {
      let savedCategoryId: string | null = null;
      try {
        savedCategoryId = localStorage.getItem(LAST_CATEGORY_KEY);
      } catch {
        // storage unavailable: just take the first category
      }
      const savedCategoryExists = savedCategoryId && categories.some((c) => c.id === savedCategoryId);
      setCategoryIds([savedCategoryExists ? (savedCategoryId as string) : categories[0].id]);
    }
  }, [word, categories]);

  const toggleCategory = (id: string) =>
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  const primaryCategory = categories.find((c) => c.id === categoryIds[0]);
  const noCategory = categoryIds.length === 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!de || !ru || noCategory) return;
    try {
      localStorage.setItem(LAST_CATEGORY_KEY, categoryIds[0]);
    } catch {
      // Non-blocking
    }
    onSave({
      de,
      ru,
      hint: hint || null,
      partOfSpeech: partOfSpeech || null,
      plural: plural || null,
      feminine: feminine || null,
      femininePlural: femininePlural || null,
      praeteritum: praeteritum || null,
      partizip2: partizip2 || null,
      hilfsverb: hilfsverb || null,
      praesensIch: praesensIch || null,
      praesensDu: praesensDu || null,
      praesensErSieEs: praesensErSieEs || null,
      praesensWir: praesensWir || null,
      praesensIhr: praesensIhr || null,
      praesensSie: praesensSie || null,
      categoryId: categoryIds[0],
      categoryIds,
    });
  };

  return (
    <Modal title={word ? 'Редактировать слово' : 'Новое слово'} size="lg" onClose={onClose} closeOnBackdrop={false}>
      <form onSubmit={handleSubmit} className="modal-form">
        <div className="modal-body modal-body--form">
          <div className="form-grid-2">
            <div>
              <label className="field-label" htmlFor="word-de">Немецкий (с артиклем) *</label>
              <input id="word-de" type="text" className="text-input w-full" placeholder="der Tisch / sein" value={de} onChange={(e) => setDe(e.target.value)} required />
            </div>
            <div>
              <label className="field-label" htmlFor="word-ru">Русский перевод *</label>
              <input id="word-ru" type="text" className="text-input w-full" placeholder="стол / быть" value={ru} onChange={(e) => setRu(e.target.value)} required />
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="word-hint">Подсказка (чтобы отличать похожие переводы)</label>
            <input id="word-hint" type="text" className="text-input w-full" placeholder="напр. «коса (причёска)» или «замок (здание)»" value={hint} onChange={(e) => setHint(e.target.value)} />
          </div>

          <div role="group" aria-labelledby="word-categories-label">
            <span id="word-categories-label" className="field-label">Категории * (можно несколько)</span>
            <div className="category-picker">
              {categories.map((c) => {
                const checked = categoryIds.includes(c.id);
                return (
                  <label key={c.id} className={`category-option ${checked ? 'is-checked' : ''}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleCategory(c.id)} />
                    <span className="category-option-label">{c.icon || '📌'} {c.name}</span>
                  </label>
                );
              })}
            </div>
            <div className="category-primary-note">
              {primaryCategory
                ? `Основная категория — первая отмеченная: ${primaryCategory.icon || '📌'} ${primaryCategory.name}. `
                : ''}
              Слово остаётся одной карточкой, сколько бы категорий ни было.
            </div>
            {noCategory && (
              <div className="form-error" role="alert">
                <AlertCircle size={16} /> Выберите хотя бы одну категорию.
              </div>
            )}
          </div>

          <div>
            <label className="field-label" htmlFor="word-pos">
              Часть речи{' '}
              <span className="field-label--xs">(определяет, попадёт ли слово в тренажёр глаголов)</span>
            </label>
            <select id="word-pos" className="text-input w-full" value={partOfSpeech} onChange={(e) => setPartOfSpeech(e.target.value as PartOfSpeech | typeof AUTO)}>
              <option value={AUTO}>Определить автоматически</option>
              {PART_OF_SPEECH_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="form-grid-2">
            <div>
              <label className="field-label" htmlFor="word-plural">Множественное число (Plural)</label>
              <input id="word-plural" type="text" className="text-input w-full" placeholder="die Tische" value={plural} onChange={(e) => setPlural(e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="word-feminine">Женский род (профессии)</label>
              <input id="word-feminine" type="text" className="text-input w-full" placeholder="die Ärztin" value={feminine} onChange={(e) => setFeminine(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="word-feminine-plural">Женский род, мн. число (die Ärztinnen)</label>
            <input id="word-feminine-plural" type="text" className="text-input w-full" placeholder="die Ärztinnen" value={femininePlural} onChange={(e) => setFemininePlural(e.target.value)} />
          </div>

          <div className="form-section">
            <div className="form-section-title">Основные формы глагола (для глаголов)</div>
            <div className="form-grid-3 form-row">
              <div>
                <label className="field-label field-label--sm" htmlFor="word-praeteritum">Präteritum</label>
                <input id="word-praeteritum" type="text" className="text-input w-full" placeholder="war / ging" value={praeteritum} onChange={(e) => setPraeteritum(e.target.value)} />
              </div>
              <div>
                <label className="field-label field-label--sm" htmlFor="word-partizip2">Partizip II</label>
                <input id="word-partizip2" type="text" className="text-input w-full" placeholder="gewesen / gegangen" value={partizip2} onChange={(e) => setPartizip2(e.target.value)} />
              </div>
              <div>
                <label className="field-label field-label--sm" htmlFor="word-hilfsverb">Вспомогательный</label>
                <select id="word-hilfsverb" className="text-input w-full" value={hilfsverb} onChange={(e) => setHilfsverb(e.target.value)}>
                  <option value="haben">haben</option>
                  <option value="sein">sein</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              className="btn-secondary conjugation-toggle"
              onClick={() => setShowConjugation((prev) => !prev)}
            >
              {showConjugation ? '▲ Скрыть спряжение в Präsens' : '▼ Настроить спряжение в Präsens (ich, du, er, wir, ihr, sie)'}
            </button>

            {showConjugation && (
              <div className="conjugation-panel">
                <div className="conjugation-hint">
                  Формы настоящего времени (Präsens) — например, для <em>sein</em> (bin, bist, ist...):
                </div>
                <div className="form-grid-3">
                  <div>
                    <label className="field-label--xs" htmlFor="word-praesens-ich">ich</label>
                    <input id="word-praesens-ich" type="text" className="text-input w-full" placeholder="bin" value={praesensIch} onChange={(e) => setPraesensIch(e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label--xs" htmlFor="word-praesens-du">du</label>
                    <input id="word-praesens-du" type="text" className="text-input w-full" placeholder="bist" value={praesensDu} onChange={(e) => setPraesensDu(e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label--xs" htmlFor="word-praesens-er">er / sie / es</label>
                    <input id="word-praesens-er" type="text" className="text-input w-full" placeholder="ist" value={praesensErSieEs} onChange={(e) => setPraesensErSieEs(e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label--xs" htmlFor="word-praesens-wir">wir</label>
                    <input id="word-praesens-wir" type="text" className="text-input w-full" placeholder="sind" value={praesensWir} onChange={(e) => setPraesensWir(e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label--xs" htmlFor="word-praesens-ihr">ihr</label>
                    <input id="word-praesens-ihr" type="text" className="text-input w-full" placeholder="seid" value={praesensIhr} onChange={(e) => setPraesensIhr(e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label--xs" htmlFor="word-praesens-sie">sie / Sie</label>
                    <input id="word-praesens-sie" type="text" className="text-input w-full" placeholder="sind" value={praesensSie} onChange={(e) => setPraesensSie(e.target.value)} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Отмена</button>
          <button type="submit" className="btn-primary" disabled={noCategory}>Сохранить</button>
        </div>
      </form>
    </Modal>
  );
};
