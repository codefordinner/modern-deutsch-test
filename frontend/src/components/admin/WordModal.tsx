import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Word, Category } from '../../types';

interface WordModalProps {
  word: Word | null;
  categories: Category[];
  onClose: () => void;
  onSave: (wordData: Partial<Word>) => Promise<void>;
}

export const WordModal: React.FC<WordModalProps> = ({ word, categories, onClose, onSave }) => {
  const [de, setDe] = useState('');
  const [ru, setRu] = useState('');
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
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: 620, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>{word ? 'Редактировать слово' : 'Новое слово'}</h3>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-grid-2">
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Немецкий (с артиклем) *</label>
                <input type="text" className="text-input" style={{ width: '100%' }} placeholder="der Tisch / sein" value={de} onChange={(e) => setDe(e.target.value)} required />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Русский перевод *</label>
                <input type="text" className="text-input" style={{ width: '100%' }} placeholder="стол / быть" value={ru} onChange={(e) => setRu(e.target.value)} required />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Категория *</label>
              <select className="text-input" style={{ width: '100%' }} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon || '📌'} {c.name}</option>
                ))}
              </select>
            </div>

            <div className="form-grid-2">
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Множественное число (Plural)</label>
                <input type="text" className="text-input" style={{ width: '100%' }} placeholder="die Tische" value={plural} onChange={(e) => setPlural(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Женский род (профессии)</label>
                <input type="text" className="text-input" style={{ width: '100%' }} placeholder="die Ärztin" value={feminine} onChange={(e) => setFeminine(e.target.value)} />
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Основные формы глагола (для глаголов)</div>
              <div className="form-grid-3" style={{ marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>Präteritum</label>
                  <input type="text" className="text-input" style={{ width: '100%' }} placeholder="war / ging" value={praeteritum} onChange={(e) => setPraeteritum(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>Partizip II</label>
                  <input type="text" className="text-input" style={{ width: '100%' }} placeholder="gewesen / gegangen" value={partizip2} onChange={(e) => setPartizip2(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>Вспомогательный</label>
                  <select className="text-input" style={{ width: '100%' }} value={hilfsverb} onChange={(e) => setHilfsverb(e.target.value)}>
                    <option value="haben">haben</option>
                    <option value="sein">sein</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: 13, padding: '6px 12px', marginTop: 4, width: '100%' }}
                onClick={() => setShowConjugation((prev) => !prev)}
              >
                {showConjugation ? '▲ Скрыть спряжение в Präsens' : '▼ Настроить спряжение в Präsens (ich, du, er, wir, ihr, sie)'}
              </button>

              {showConjugation && (
                <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    Формы настоящего времени (Präsens) — например, для <em>sein</em> (bin, bist, ist...):
                  </div>
                  <div className="form-grid-3">
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>ich</label>
                      <input type="text" className="text-input" style={{ width: '100%' }} placeholder="bin" value={praesensIch} onChange={(e) => setPraesensIch(e.target.value)} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>du</label>
                      <input type="text" className="text-input" style={{ width: '100%' }} placeholder="bist" value={praesensDu} onChange={(e) => setPraesensDu(e.target.value)} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>er / sie / es</label>
                      <input type="text" className="text-input" style={{ width: '100%' }} placeholder="ist" value={praesensErSieEs} onChange={(e) => setPraesensErSieEs(e.target.value)} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>wir</label>
                      <input type="text" className="text-input" style={{ width: '100%' }} placeholder="sind" value={praesensWir} onChange={(e) => setPraesensWir(e.target.value)} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>ihr</label>
                      <input type="text" className="text-input" style={{ width: '100%' }} placeholder="seid" value={praesensIhr} onChange={(e) => setPraesensIhr(e.target.value)} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>sie / Sie</label>
                      <input type="text" className="text-input" style={{ width: '100%' }} placeholder="sind" value={praesensSie} onChange={(e) => setPraesensSie(e.target.value)} />
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
      </div>
    </div>
  );
};
