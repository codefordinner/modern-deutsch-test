import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BookOpen, Tag, ArrowLeftRight, BarChart3, LogOut } from 'lucide-react';
import { AdminLogin } from './admin/AdminLogin';
import { WordsTab } from './admin/WordsTab';
import { CategoriesTab } from './admin/CategoriesTab';
import { ImportExportTab } from './admin/ImportExportTab';
import { AnalyticsTab } from './admin/AnalyticsTab';
import { WordModal } from './admin/WordModal';
import { CategoryModal } from './admin/CategoryModal';
import {
  UNAUTHORIZED_EVENT, authToken, createCategory, createWord, deleteCategory, deleteWord,
  getCategories, getWords, logout, updateCategory, updateWord,
} from '../api/client';
import { reportError, showToast } from '../utils/toast';
import type { Word, Category } from '../types';

export const AdminPanel: React.FC = () => {
  const [isAuthed, setIsAuthed] = useState<boolean>(() => authToken.get() !== null);
  const [tab, setTab] = useState<'words' | 'categories' | 'import' | 'analytics'>('words');
  const [words, setWords] = useState<Word[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [editingWord, setEditingWord] = useState<Word | null>(null);
  const [isWordOpen, setIsWordOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [isCatOpen, setIsCatOpen] = useState(false);

  // The API client drops the token and fires this when the server rejects it (e.g. the session expired).
  useEffect(() => {
    const onUnauthorized = () => {
      setIsAuthed(false);
      showToast('Сессия истекла. Войдите снова.');
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      setCategories(await getCategories());
    } catch (e) {
      reportError(e, 'Не удалось загрузить категории');
    }
  }, []);

  // Search fires on every keystroke; only the latest request may update the list.
  const wordsRequestId = useRef(0);
  const loadWords = useCallback(async () => {
    const requestId = ++wordsRequestId.current;
    try {
      const page = await getWords({ categoryId: category, search, limit: 500 });
      if (requestId === wordsRequestId.current) setWords(page.words || []);
    } catch (e) {
      if (requestId === wordsRequestId.current) reportError(e, 'Не удалось загрузить слова');
    }
  }, [category, search]);

  useEffect(() => { if (isAuthed) loadCategories(); }, [isAuthed, loadCategories]);
  useEffect(() => { if (isAuthed) loadWords(); }, [isAuthed, loadWords]);

  const handleLogin = (token: string) => { authToken.set(token); setIsAuthed(true); };

  const handleLogout = () => {
    logout().catch(() => {}); // best effort: also clears the HttpOnly auth cookie
    authToken.clear();
    setIsAuthed(false);
  };

  const handleDeleteWord = async (id: string) => {
    if (!confirm('Удалить слово?')) return;
    try {
      await deleteWord(id);
      loadWords();
    } catch (e) {
      reportError(e, 'Не удалось удалить слово');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Удалить категорию?')) return;
    try {
      await deleteCategory(id);
      loadCategories();
      loadWords();
    } catch (e) {
      reportError(e, 'Не удалось удалить категорию');
    }
  };

  // On failure the modal stays open so the admin doesn't lose what they typed.
  const handleSaveWord = async (word: Partial<Word>) => {
    try {
      if (editingWord) await updateWord(editingWord.id, word);
      else await createWord(word);
      setIsWordOpen(false);
      loadWords();
    } catch (e) {
      reportError(e, 'Не удалось сохранить слово');
    }
  };

  const handleSaveCategory = async (cat: Partial<Category>) => {
    try {
      if (editingCat) await updateCategory(editingCat.id, cat);
      else await createCategory(cat);
      setIsCatOpen(false);
      loadCategories();
    } catch (e) {
      reportError(e, 'Не удалось сохранить категорию');
    }
  };

  if (!isAuthed) return <AdminLogin onLogin={handleLogin} />;

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
          onDeleteWord={handleDeleteWord}
        />
      )}
      {tab === 'categories' && (
        <CategoriesTab
          categories={categories}
          onAddCategory={() => { setEditingCat(null); setIsCatOpen(true); }}
          onEditCategory={(c) => { setEditingCat(c); setIsCatOpen(true); }}
          onDeleteCategory={handleDeleteCategory}
        />
      )}
      {tab === 'import' && <ImportExportTab categories={categories} onRefresh={() => { loadCategories(); loadWords(); }} />}
      {tab === 'analytics' && <AnalyticsTab />}

      {isWordOpen && <WordModal word={editingWord} categories={categories} onClose={() => setIsWordOpen(false)} onSave={handleSaveWord} />}
      {isCatOpen && <CategoryModal category={editingCat} onClose={() => setIsCatOpen(false)} onSave={handleSaveCategory} />}
    </div>
  );
};
