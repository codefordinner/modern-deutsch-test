import React, { useState, useEffect } from 'react';
import { BookOpen, Tag, ArrowLeftRight, BarChart3, LogOut } from 'lucide-react';
import { AdminLogin } from './admin/AdminLogin';
import { WordsTab } from './admin/WordsTab';
import { CategoriesTab } from './admin/CategoriesTab';
import { ImportExportTab } from './admin/ImportExportTab';
import { AnalyticsTab } from './admin/AnalyticsTab';
import { WordModal } from './admin/WordModal';
import { CategoryModal } from './admin/CategoryModal';
import type { Word, Category } from '../types';

export const AdminPanel: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('admin_token'));
  const [tab, setTab] = useState<'words' | 'categories' | 'import' | 'analytics'>('words');
  const [words, setWords] = useState<Word[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [editingWord, setEditingWord] = useState<Word | null>(null);
  const [isWordOpen, setIsWordOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [isCatOpen, setIsCatOpen] = useState(false);

  const fetchCats = () => fetch('/api/categories').then((r) => r.json()).then(setCategories).catch(() => {});
  const fetchWords = () => {
    const q = new URLSearchParams({ categoryId: category, search, limit: '500' });
    fetch(`/api/words?${q}`).then((r) => r.json()).then((d) => setWords(d.words || [])).catch(() => {});
  };

  useEffect(() => { if (token) { fetchCats(); fetchWords(); } }, [token, category, search]);

  const handleLogout = () => { localStorage.removeItem('admin_token'); setToken(null); };

  if (!token) return <AdminLogin onLogin={(t) => { localStorage.setItem('admin_token', t); setToken(t); }} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 10, flexWrap: 'wrap' }}>
        <div className="trainer-modes" style={{ margin: 0 }}>
          <button className={`mode-pill ${tab === 'words' ? 'active' : ''}`} onClick={() => setTab('words')}><BookOpen size={14} /> Слова</button>
          <button className={`mode-pill ${tab === 'categories' ? 'active' : ''}`} onClick={() => setTab('categories')}><Tag size={14} /> Категории</button>
          <button className={`mode-pill ${tab === 'import' ? 'active' : ''}`} onClick={() => setTab('import')}><ArrowLeftRight size={14} /> Импорт / Экспорт</button>
          <button className={`mode-pill ${tab === 'analytics' ? 'active' : ''}`} onClick={() => setTab('analytics')}><BarChart3 size={14} /> Аналитика</button>
        </div>
        <button className="btn-secondary" onClick={handleLogout}><LogOut size={14} /> Выйти</button>
      </div>

      {tab === 'words' && (
        <WordsTab
          words={words} categories={categories} search={search} selectedCategory={category}
          onSearchChange={setSearch} onCategoryChange={setCategory}
          onAddWord={() => { setEditingWord(null); setIsWordOpen(true); }}
          onEditWord={(w) => { setEditingWord(w); setIsWordOpen(true); }}
          onDeleteWord={async (id) => { if (confirm('Удалить слово?')) { await fetch(`/api/words/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); fetchWords(); } }}
        />
      )}
      {tab === 'categories' && (
        <CategoriesTab
          categories={categories}
          onAddCategory={() => { setEditingCat(null); setIsCatOpen(true); }}
          onEditCategory={(c) => { setEditingCat(c); setIsCatOpen(true); }}
          onDeleteCategory={async (id) => { if (confirm('Удалить категорию?')) { await fetch(`/api/categories/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); fetchCats(); } }}
        />
      )}
      {tab === 'import' && <ImportExportTab categories={categories} token={token} onRefresh={() => { fetchCats(); fetchWords(); }} />}
      {tab === 'analytics' && <AnalyticsTab token={token} />}

      {isWordOpen && (
        <WordModal word={editingWord} categories={categories} onClose={() => setIsWordOpen(false)} onSave={async (w) => {
          const url = editingWord ? `/api/words/${editingWord.id}` : '/api/words';
          await fetch(url, { method: editingWord ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(w) });
          setIsWordOpen(false);
          fetchWords();
        }} />
      )}
      {isCatOpen && (
        <CategoryModal category={editingCat} onClose={() => setIsCatOpen(false)} onSave={async (c) => {
          const url = editingCat ? `/api/categories/${editingCat.id}` : '/api/categories';
          await fetch(url, { method: editingCat ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(c) });
          setIsCatOpen(false);
          fetchCats();
        }} />
      )}
    </div>
  );
};
