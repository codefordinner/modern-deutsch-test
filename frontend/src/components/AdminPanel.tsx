import React, { useEffect, useState } from 'react';
import { BookOpen, Tag, ArrowLeftRight, BarChart3, Copy, Layers, LogOut, AudioLines, Images, Bot, FileText } from 'lucide-react';
import { PicturesTab } from './admin/PicturesTab';
import { AISettingsTab } from './admin/AISettingsTab';
import { AdminLogin } from './admin/AdminLogin';
import { WordsTab } from './admin/WordsTab';
import { CategoriesTab } from './admin/CategoriesTab';
import { ImportExportTab } from './admin/ImportExportTab';
import { ImportReviewCard } from './admin/ImportReviewCard';
import { WordFillCard } from './admin/WordFillCard';
import { DuplicatesTab } from './admin/DuplicatesTab';
import { AnalyticsTab } from './admin/AnalyticsTab';
import { SrsSettingsTab } from './admin/SrsSettingsTab';
import { AudioCacheTab } from './admin/AudioCacheTab';
import { WordModal } from './admin/WordModal';
import { CategoryModal } from './admin/CategoryModal';
import { ModeSwitch } from './ModeSwitch';
import { ToolbarButton } from './ToolbarButton';
import {
  UNAUTHORIZED_EVENT,
} from '../api/request';
import { checkSession, logout } from '../api/auth';
import { bulkDeleteWords, bulkSetCategory, bulkSetPartOfSpeech, createCategory, createWord, deleteCategory, deleteWord, updateCategory, updateWord, detectRequiredCasesViaAI, redistributeCategoriesViaAI, getAIBulkJob } from '../api/adminWords';
import { invalidateQueries } from '../api/queryCache';
import { CATEGORIES_KEY, WORDS_KEY, useCategories, useWords } from '../hooks/useDictionary';
import { reportError, showToast } from '../utils/toast';
import { wordInCategory } from '../utils/wordCategories';
import type { Word, Category, PartOfSpeech } from '../types';

type AdminTab = 'words' | 'categories' | 'import' | 'duplicates' | 'srs' | 'audio' | 'pictures' | 'ai-settings' | 'ai-logs' | 'analytics';

const ADMIN_TABS: readonly AdminTab[] = ['words', 'categories', 'import', 'duplicates', 'srs', 'audio', 'pictures', 'ai-settings', 'ai-logs', 'analytics'];
const readAdminRoute = (): { tab: AdminTab; category: string } => {
  if (typeof window === 'undefined') return { tab: 'words', category: 'all' };
  const match = /^#\/?admin(?:\?([^#]*))?$/.exec(window.location.hash);
  const params = new URLSearchParams(match?.[1] ?? '');
  const rawTab = params.get('tab');
  return {
    tab: ADMIN_TABS.includes(rawTab as AdminTab) ? rawTab as AdminTab : 'words',
    category: params.get('category') || 'all',
  };
};

export const AdminPanel: React.FC = () => {
  // The session cookie is HttpOnly (invisible to JS), so the client asks the
  // server whether it is currently signed in rather than checking local state.
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const initialRoute = readAdminRoute();
  const [tab, setTab] = useState<AdminTab>(initialRoute.tab);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(initialRoute.category);
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
    const params = new URLSearchParams();
    if (tab !== 'words') params.set('tab', tab);
    if (tab === 'words' && category !== 'all') params.set('category', category);
    const query = params.toString();
    const nextHash = `#/admin${query ? `?${query}` : ''}`;
    if (window.location.hash !== nextHash) window.history.replaceState(null, '', nextHash);
  }, [tab, category]);

  useEffect(() => {
    if (isAuthed && categoriesError) reportError(categoriesError, 'Не удалось загрузить категории');
  }, [isAuthed, categoriesError]);
  useEffect(() => {
    if (isAuthed && wordsError) reportError(wordsError, 'Не удалось загрузить слова');
  }, [isAuthed, wordsError]);

  const words = allWords.filter((w) => {
    // A word with several categories shows up under each of them.
    const matchesCategory = category === 'all' || wordInCategory(w, category);
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || w.de.toLowerCase().includes(q) || w.ru.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const refreshDictionary = () => invalidateQueries(WORDS_KEY);
  const refreshCategories = () => invalidateQueries(CATEGORIES_KEY);
  const refreshAll = () => {
    refreshCategories();
    refreshDictionary();
  };

  const handleLogin = () => setIsAuthed(true);

  const handleLogout = () => {
    logout().catch(() => {});
    setIsAuthed(false);
  };

  const handleDeleteWord = async (id: string) => {
    if (!confirm('Удалить слово?')) return;
    try {
      await deleteWord(id);
      // Category counters change too.
      refreshAll();
    } catch (e) {
      reportError(e, 'Не удалось удалить слово');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Удалить категорию? Слова, которые есть только в ней, будут удалены; слова из нескольких категорий останутся.')) return;
    try {
      await deleteCategory(id);
      refreshAll();
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
      // Category counters change too.
      refreshAll();
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

  // Bulk actions report success so the table can clear its selection.
  const handleBulkCategory = async (ids: string[], categoryId: string): Promise<boolean> => {
    try {
      const { count } = await bulkSetCategory(ids, categoryId);
      showToast(`Перенесено слов: ${count}`, 'success');
      refreshAll();
      return true;
    } catch (e) {
      reportError(e, 'Не удалось сменить категорию');
      return false;
    }
  };

  const handleBulkPartOfSpeech = async (ids: string[], partOfSpeech: PartOfSpeech | null): Promise<boolean> => {
    try {
      const { count } = await bulkSetPartOfSpeech(ids, partOfSpeech);
      showToast(`Обновлено слов: ${count}`, 'success');
      refreshDictionary();
      return true;
    } catch (e) {
      reportError(e, 'Не удалось изменить часть речи');
      return false;
    }
  };

  const handleBulkDelete = async (ids: string[]): Promise<boolean> => {
    try {
      const { count } = await bulkDeleteWords(ids);
      showToast(`Удалено слов: ${count}`, 'success');
      refreshAll();
      return true;
    } catch (e) {
      reportError(e, 'Не удалось удалить слова');
      return false;
    }
  };

  const handleAIAction = async (action: 'categories' | 'cases', ids: string[]): Promise<boolean> => {
    try {
      const started = action === 'categories' ? await redistributeCategoriesViaAI(ids) : await detectRequiredCasesViaAI(ids);
      let result = started;
      for (let attempt = 0; attempt < 360 && (result.status === 'queued' || result.status === 'running'); attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        result = await getAIBulkJob(started.id);
      }
      if (result.status === 'failed') {
        const messages: Record<string, string> = { MISSING_API_KEY: 'Сначала сохраните API-ключ Gemini в настройках ИИ', MISSING_MODEL: 'Для этого AI-профиля не выбрана модель Gemini', INVALID_AI_RESPONSE: 'Gemini вернул неполный или некорректный ответ для одного из пакетов', GEMINI_UNAVAILABLE: 'Gemini временно недоступен', AI_TIMEOUT: 'Один из AI-пакетов превысил время ожидания' };
        throw new Error(messages[result.error ?? ''] ?? result.error ?? 'ИИ не смог завершить обработку');
      }
      if (result.status !== 'completed') throw new Error('ИИ не завершил обработку за отведённое время');
      showToast(`ИИ обработал слов: ${result.count ?? 0}`, 'success');
      refreshAll();
      return true;
    } catch (e) { reportError(e, action === 'categories' ? 'Не удалось перераспределить категории' : 'Не удалось определить падежи'); return false; }
  };

  if (isAuthed === null) return <div className="centered-message">Проверка сессии...</div>;
  if (!isAuthed) return <AdminLogin onLogin={handleLogin} />;

  return (
    <div>
      <div className="admin-toolbar">
        <ModeSwitch<AdminTab>
          ariaLabel="Раздел админки"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'words', label: 'Слова', icon: <BookOpen size={14} /> },
            { value: 'categories', label: 'Категории', icon: <Tag size={14} /> },
            { value: 'import', label: 'Импорт / Экспорт', icon: <ArrowLeftRight size={14} /> },
            { value: 'duplicates', label: 'Дубликаты', icon: <Copy size={14} /> },
            { value: 'srs', label: 'Ящики SRS', icon: <Layers size={14} /> },
            { value: 'audio', label: 'Озвучка', icon: <AudioLines size={14} /> },
            { value: 'pictures', label: 'Картинки', icon: <Images size={14} /> },
            { value: 'ai-settings', label: 'Настройки ИИ', icon: <Bot size={14} /> },
            { value: 'ai-logs', label: 'Логи ИИ', icon: <FileText size={14} /> },
            { value: 'analytics', label: 'Аналитика', icon: <BarChart3 size={14} /> },
          ]}
        />
        <ToolbarButton icon={<LogOut size={14} />} label="Выйти" onClick={handleLogout} />
      </div>

      {tab === 'words' && (
        <WordsTab
          words={words} categories={categories} search={search} selectedCategory={category}
          onSearchChange={setSearch} onCategoryChange={setCategory}
          onAddWord={() => { setEditingWord(null); setIsWordOpen(true); }}
          onEditWord={(w) => { setEditingWord(w); setIsWordOpen(true); }}
          onDeleteWord={handleDeleteWord}
          onBulkCategory={handleBulkCategory}
          onBulkPartOfSpeech={handleBulkPartOfSpeech}
          onBulkDelete={handleBulkDelete}
          onAIAction={handleAIAction}
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
      {tab === 'import' && (
        <div className="import-stack">
          <WordFillCard categories={categories} onRefresh={refreshAll} />
          <details className="import-manual">
            <summary>Ручной импорт / экспорт (JSON и текст)</summary>
            <div className="import-stack">
              <ImportExportTab categories={categories} onRefresh={refreshAll} />
              <ImportReviewCard categories={categories} onRefresh={refreshAll} />
            </div>
          </details>
        </div>
      )}
      {tab === 'duplicates' && <DuplicatesTab onChanged={refreshAll} />}
      {tab === 'srs' && <SrsSettingsTab />}
      {tab === 'audio' && <AudioCacheTab />}
      {tab === 'pictures' && <PicturesTab />}
      {tab === 'ai-settings' && <AISettingsTab view="settings" />}
      {tab === 'ai-logs' && <AISettingsTab view="logs" />}
      {tab === 'analytics' && <AnalyticsTab />}

      {isWordOpen && <WordModal word={editingWord} categories={categories} onClose={() => setIsWordOpen(false)} onSave={handleSaveWord} />}
      {isCatOpen && <CategoryModal category={editingCat} onClose={() => setIsCatOpen(false)} onSave={handleSaveCategory} />}
    </div>
  );
};
