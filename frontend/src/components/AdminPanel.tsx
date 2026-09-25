import React, { useEffect, useState } from 'react';
import { BookOpen, Tag, ArrowLeftRight, BarChart3, LogOut } from 'lucide-react';
import { AdminLogin } from './admin/AdminLogin';
import { WordsTab } from './admin/WordsTab';
import { CategoriesTab } from './admin/CategoriesTab';
import { ImportExportTab } from './admin/ImportExportTab';
import { AnalyticsTab } from './admin/AnalyticsTab';
import { WordModal } from './admin/WordModal';
import { CategoryModal } from './admin/CategoryModal';
import {
  UNAUTHORIZED_EVENT, checkSession, createCategory, createWord, deleteCategory, deleteWord,
  logout, updateCategory, updateWord,
} from '../api/client';
import { invalidateQueries } from '../api/queryCache';
import { CATEGORIES_KEY, WORDS_KEY, useCategories, useWords } from '../hooks/useDictionary';
import { reportError, showToast } from '../utils/toast';
import type { Word, Category } from '../types';

export const AdminPanel: React.FC = () => {
  // The session cookie is HttpOnly (invisible to JS), so the client asks the
  // server whether it is currently signed in rather than checking local state.
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<'words' | 'categories' | 'import' | 'analytics'>('words');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [editingWord, setEditingWord] = useState<Word | null>(null);
  const [isWordOpen, setIsWordOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [isCatOpen, setIsCatOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    checkSession()
      .then((ok) => { if (!cancelled) setIsAuthed(ok); })
      .catch(() => { if (!cancelled) setIsAuthed(false); });
    return () => {
      cancelled = true;
    };
  }, []);

  // The API client fires this when the server rejects the session (e.g. it expired).
  useEffect(() => {
    const onUnauthorized = () => {
      setIsAuthed(false);
      showToast('Сессия истекла. Войдите снова.');
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  // Shared with the trainers (see hooks/useDictionary.ts): editing here refreshes what they show too.
  const { categories, error: categoriesError } = useCategories();
  const { words: allWords, error: wordsError } = useWords();

  useEffect(() => {
    if (isAuthed && categoriesError) reportError(categoriesError, 'Не удалось загрузить категории');
  }, [isAuthed, categoriesError]);
  useEffect(() => {
    if (isAuthed && wordsError) reportError(wordsError, 'Не удалось загрузить слова');
  }, [isAuthed, wordsError]);

  const words = allWords.filter((w) => {
    const matchesCategory = category === 'all' || w.categoryId === category;
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || w.de.toLowerCase().includes(q) || w.ru.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const refreshDictionary = () => invalidateQueries(WORDS_KEY);
  const refreshCategories = () => invalidateQueries(CATEGORIES_KEY);

  const handleLogin = () => setIsAuthed(true);

  const handleLogout = () => {
    logout().catch(() => {});
    setIsAuthed(false);
  };

  const handleDeleteWord = async (id: string) => {
    if (!confirm('Удалить слово?')) return;
    try {
      await deleteWord(id);
      refreshDictionary();
    } catch (e) {
      reportError(e, 'Не удалось удалить слово');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Удалить категорию?')) return;
    try {
      await deleteCategory(id);
      refreshCategories();
      refreshDictionary();
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
      refreshDictionary();
    } catch (e) {
      reportError(e, 'Не удалось сохранить слово');
    }
  };

  const handleSaveCategory = async (cat: Partial<Category>) => {
    try {
      if (editingCat) await updateCategory(editingCat.id, cat);
      else await createCategory(cat);
      setIsCatOpen(false);
      refreshCategories();
    } catch (e) {
      reportError(e, 'Не удалось сохранить категорию');
    }
  };

  if (isAuthed === null) return <div className="centered-message">Проверка сессии...</div>;
  if (!isAuthed) return <AdminLogin onLogin={handleLogin} />;

  return (
    <div>
      <div className="admin-toolbar">
        <div className="trainer-modes trainer-modes--flush">
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
      {tab === 'import' && <ImportExportTab categories={categories} onRefresh={() => { refreshCategories(); refreshDictionary(); }} />}
      {tab === 'analytics' && <AnalyticsTab />}

      {isWordOpen && <WordModal word={editingWord} categories={categories} onClose={() => setIsWordOpen(false)} onSave={handleSaveWord} />}
      {isCatOpen && <CategoryModal category={editingCat} onClose={() => setIsCatOpen(false)} onSave={handleSaveCategory} />}
    </div>
  );
};
