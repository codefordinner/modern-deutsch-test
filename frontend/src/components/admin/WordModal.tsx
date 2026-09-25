import React, { useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { PART_OF_SPEECH_OPTIONS } from '../../utils/partOfSpeech';
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
  const [categoryId, setCategoryId] = useState('');
  const LAST_CATEGORY_KEY = 'admin_last_word_category_id';

  useEffect(() => {
    if (word) {
      setDe(word.de);
      setRu(word.ru);
      setHint(word.hint || '');
      setPartOfSpeech(word.partOfSpeech ?? AUTO);
      setPlural(word.plural || '');
      setFeminine(word.feminine || '');
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
      setCategoryId(word.categoryId);
    } else if (categories.length > 0) {
      const savedCategoryId = localStorage.getItem(LAST_CATEGORY_KEY);
      const savedCategoryExists = savedCategoryId && categories.some((c) => c.id === savedCategoryId);
      setCategoryId(savedCategoryExists ? savedCategoryId : categories[0].id);
    }
  }, [word, categories]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!de || !ru || !categoryId) return;
    localStorage.setItem(LAST_CATEGORY_KEY, categoryId);
    onSave({
      de,
      ru,
      hint: hint || null,
      partOfSpeech: partOfSpeech || null,
      plural: plural || null,
      feminine: feminine || null,
      praeteritum: praeteritum || null,
      partizip2: partizip2 || null,
      hilfsverb: hilfsverb || null,
      praesensIch: praesensIch || null,
      praesensDu: praesensDu || null,
      praesensErSieEs: praesensErSieEs || null,
      praesensWir: praesensWir || null,
      praesensIhr: praesensIhr || null,
      praesensSie: praesensSie || null,
      categoryId,
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

          <div className="form-grid-2">
            <div>
              <label className="field-label" htmlFor="word-category">Категория *</label>
              <select id="word-category" className="text-input w-full" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon || '📌'} {c.name}</option>
                ))}
              </select>
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
          <button type="submit" className="btn-primary">Сохранить</button>
        </div>
      </form>
    </Modal>
  );
};
