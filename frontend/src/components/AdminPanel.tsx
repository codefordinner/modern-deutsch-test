import React, { useEffect, useState } from "react";
import {
  BookOpen,
  Tag,
  ArrowLeftRight,
  BarChart3,
  Copy,
  Layers,
  AudioLines,
  Images,
  Bot,
  FileText,
  Users,
} from "lucide-react";
import { PicturesTab } from "./admin/PicturesTab";
import { AISettingsTab } from "./admin/AISettingsTab";
import { WordsTab } from "./admin/WordsTab";
import { CategoriesTab } from "./admin/CategoriesTab";
import { ImportExportTab } from "./admin/ImportExportTab";
import { ImportReviewCard } from "./admin/ImportReviewCard";
import { WordFillCard } from "./admin/WordFillCard";
import { DuplicatesTab } from "./admin/DuplicatesTab";
import { AnalyticsTab } from "./admin/AnalyticsTab";
import { SrsSettingsTab } from "./admin/SrsSettingsTab";
import { AudioCacheTab } from "./admin/AudioCacheTab";
import { UsersTab } from "./admin/UsersTab";
import { WordModal } from "./admin/WordModal";
import { CategoryModal } from "./admin/CategoryModal";
import { ModeSwitch } from "./ModeSwitch";
import { ApiError } from "../api/request";
import {
  bulkDeleteWords,
  bulkSetCategory,
  bulkSetPartOfSpeech,
  createCategory,
  createWord,
  deleteCategory,
  deleteWord,
  updateCategory,
  updateWord,
  checkWordsViaAI,
  detectRequiredCasesViaAI,
  redistributeCategoriesViaAI,
  getAIBulkJob,
} from "../api/adminWords";
import { invalidateQueries } from "../api/queryCache";
import {
  CATEGORIES_KEY,
  WORDS_KEY,
  useCategories,
  useWords,
} from "../hooks/useDictionary";
import { reportError, showToast } from "../utils/toast";
import { wordInCategory } from "../utils/wordCategories";
import type { Word, Category, PartOfSpeech } from "../types";
import { ADMIN_TABS, type SharedAdminTab } from "@sprachfunke/shared";
import { useConfirm } from "../hooks/useConfirm";

type AdminTab = SharedAdminTab;
const readAdminRoute = (): { tab: AdminTab; category: string } => {
  if (typeof window === "undefined") return { tab: "words", category: "all" };
  const match = /^#\/?admin(?:\?([^#]*))?$/.exec(window.location.hash);
  const params = new URLSearchParams(match?.[1] ?? "");
  const rawTab = params.get("tab");
  return {
    tab: ADMIN_TABS.includes(rawTab as AdminTab)
      ? (rawTab as AdminTab)
      : "words",
    category: params.get("category") || "all",
  };
};

export const AdminPanel: React.FC = () => {
  const confirm = useConfirm();
  const initialRoute = readAdminRoute();
  const [tab, setTab] = useState<AdminTab>(initialRoute.tab);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(initialRoute.category);
  const [editingWord, setEditingWord] = useState<Word | null>(null);
  const [isWordOpen, setIsWordOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [isCatOpen, setIsCatOpen] = useState(false);

  // Shared with the trainers (see hooks/useDictionary.ts): editing here refreshes what they show too.
  const { categories, error: categoriesError } = useCategories();
  const { words: allWords, error: wordsError } = useWords();

  useEffect(() => {
    const params = new URLSearchParams();
    if (tab !== "words") params.set("tab", tab);
    if (tab === "words" && category !== "all") params.set("category", category);
    const query = params.toString();
    const nextHash = `#/admin${query ? `?${query}` : ""}`;
    if (window.location.hash !== nextHash)
      window.history.replaceState(null, "", nextHash);
  }, [tab, category]);

  useEffect(() => {
    if (categoriesError)
      reportError(categoriesError, "Не удалось загрузить категории");
  }, [categoriesError]);
  useEffect(() => {
    if (wordsError) reportError(wordsError, "Не удалось загрузить слова");
  }, [wordsError]);

  const words = allWords.filter((w) => {
    // A word with several categories shows up under each of them.
    const matchesCategory = category === "all" || wordInCategory(w, category);
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q || w.de.toLowerCase().includes(q) || w.ru.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const refreshDictionary = () => invalidateQueries(WORDS_KEY);
  const refreshCategories = () => invalidateQueries(CATEGORIES_KEY);
  const refreshAll = () => {
    refreshCategories();
    refreshDictionary();
  };

  const handleDeleteWord = async (id: string) => {
    if (
      !(await confirm("Удалить слово?", {
        title: "Удалить слово",
        confirmLabel: "Удалить",
        danger: true,
      }))
    )
      return;
    try {
      await deleteWord(id);
      // Category counters change too.
      refreshAll();
    } catch (e) {
      reportError(e, "Не удалось удалить слово");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (
      !(await confirm(
        "Удалить категорию? Слова, которые есть только в ней, будут удалены; слова из нескольких категорий останутся.",
        { title: "Удалить категорию", confirmLabel: "Удалить", danger: true },
      ))
    )
      return;
    try {
      await deleteCategory(id);
      refreshAll();
    } catch (e) {
      reportError(e, "Не удалось удалить категорию");
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
      reportError(e, "Не удалось сохранить слово");
    }
  };

  const handleSaveCategory = async (cat: Partial<Category>) => {
    try {
      if (editingCat) await updateCategory(editingCat.id, cat);
      else await createCategory(cat);
      setIsCatOpen(false);
      refreshCategories();
    } catch (e) {
      reportError(e, "Не удалось сохранить категорию");
    }
  };

  // Bulk actions report success so the table can clear its selection.
  const handleBulkCategory = async (
    ids: string[],
    categoryId: string,
  ): Promise<boolean> => {
    try {
      const { count } = await bulkSetCategory(ids, categoryId);
      showToast(`Перенесено слов: ${count}`, "success");
      refreshAll();
      return true;
    } catch (e) {
      reportError(e, "Не удалось сменить категорию");
      return false;
    }
  };

  const handleBulkPartOfSpeech = async (
    ids: string[],
    partOfSpeech: PartOfSpeech | null,
  ): Promise<boolean> => {
    try {
      const { count } = await bulkSetPartOfSpeech(ids, partOfSpeech);
      showToast(`Обновлено слов: ${count}`, "success");
      refreshDictionary();
      return true;
    } catch (e) {
      reportError(e, "Не удалось изменить часть речи");
      return false;
    }
  };

  const handleBulkDelete = async (ids: string[]): Promise<boolean> => {
    try {
      const { count } = await bulkDeleteWords(ids);
      showToast(`Удалено слов: ${count}`, "success");
      refreshAll();
      return true;
    } catch (e) {
      reportError(e, "Не удалось удалить слова");
      return false;
    }
  };

  const handleAIAction = async (
    action: "categories" | "cases",
    ids: string[],
  ): Promise<boolean> => {
    try {
      const started =
        action === "categories"
          ? await redistributeCategoriesViaAI(ids)
          : await detectRequiredCasesViaAI(ids);
      showToast(
        "Задача ИИ запущена. Результат появится после завершения.",
        "info",
      );
      void pollAIJob(started.id, (result) => {
        if (result.status === "failed") {
          const messages: Record<string, string> = {
            MISSING_API_KEY:
              "Сначала сохраните API-ключ Gemini в настройках ИИ",
            MISSING_MODEL: "Для этого AI-профиля не выбрана модель Gemini",
            INVALID_AI_RESPONSE:
              "Gemini вернул неполный или некорректный ответ для одного из пакетов",
            GEMINI_UNAVAILABLE: "Gemini временно недоступен",
            AI_TIMEOUT: "Один из AI-пакетов превысил время ожидания",
          };
          showToast(
            messages[result.error ?? ""] ??
              "ИИ не смог завершить обработку. Подробности доступны в логах ИИ.",
          );
          return;
        }
        showToast(`ИИ обработал слов: ${result.count ?? 0}`, "success");
        refreshAll();
      });
      return true;
    } catch (e) {
      const fallback =
        action === "categories"
          ? "Не удалось перераспределить категории"
          : "Не удалось определить падежи";
      if (e instanceof ApiError) reportError(e, fallback);
      else {
        console.error(e);
        showToast(e instanceof Error ? e.message : fallback);
      }
      return false;
    }
  };

  const handleCheckWords = async (ids: string[]): Promise<boolean> => {
    try {
      const started = await checkWordsViaAI(ids);
      showToast(
        "Проверка слов запущена. Результат появится после завершения.",
        "info",
      );
      void pollAIJob(started.id, (result) => {
        if (result.status === "failed") {
          const messages: Record<string, string> = {
            DUPLICATE_WORD:
              "ИИ предложил немецкую форму, которая уже есть в словаре. Конфликтующие исправления не применены; проверьте замечания и раздел «Дубликаты».",
            MISSING_API_KEY:
              "Сначала сохраните API-ключ Gemini в настройках ИИ",
            MISSING_MODEL: "Для проверки слов не выбрана модель Gemini",
            INVALID_AI_RESPONSE:
              "Gemini вернул неполный или некорректный ответ",
            GEMINI_UNAVAILABLE: "Gemini временно недоступен",
            AI_TIMEOUT: "Проверка слов превысила время ожидания",
          };
          showToast(
            messages[result.error ?? ""] ??
              "ИИ не смог проверить слова. Подробности доступны в логах ИИ.",
          );
          return;
        }
        const rows = (result.result ?? []) as Array<{
          id: string;
          issues?: Array<{ field?: string; message?: string }>;
          correctionsApplied?: number;
        }>;
        const corrections = rows.reduce(
          (sum, row) => sum + (row.correctionsApplied ?? 0),
          0,
        );
        const problems = rows.reduce(
          (sum, row) => sum + (row.issues?.length ?? 0),
          0,
        );
        const wordById = new Map(allWords.map((word) => [word.id, word.de]));
        const duplicateWords = [
          ...new Set(
            rows
              .filter((row) =>
                row.issues?.some(
                  (issue) =>
                    issue.field === "de" &&
                    issue.message?.toLowerCase().includes("дубликат"),
                ),
              )
              .map((row) => wordById.get(row.id) ?? row.id),
          ),
        ];
        const duplicateSummary = duplicateWords.length
          ? ` Конфликты немецких форм (${duplicateWords.length}): ${duplicateWords.slice(0, 6).join(", ")}${duplicateWords.length > 6 ? ", …" : ""}. Исправления конфликтующих форм не применены.`
          : "";
        const summary =
          corrections > 0
            ? `Проверка завершена: автоматически исправлено полей — ${corrections}. Найдено замечаний: ${problems}.${duplicateSummary}`
            : problems > 0
              ? `Проверка завершена: безопасных исправлений нет, найдено замечаний — ${problems}.${duplicateSummary}`
              : "Проверка завершена: проблем не найдено.";
        showToast(summary, duplicateWords.length ? "info" : "success");
        refreshAll();
      });
      return true;
    } catch (e) {
      if (e instanceof ApiError) reportError(e, "Не удалось проверить слова");
      else {
        console.error(e);
        showToast(
          e instanceof Error ? e.message : "Не удалось проверить слова",
        );
      }
      return false;
    }
  };

  const pollAIJob = async (
    id: string,
    onFinished: (job: Awaited<ReturnType<typeof getAIBulkJob>>) => void,
  ) => {
    const deadline = Date.now() + 30 * 60_000;
    try {
      while (Date.now() < deadline) {
        const job = await getAIBulkJob(id);
        if (job.status === "completed" || job.status === "failed") {
          onFinished(job);
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
      }
      showToast(
        "Задача ИИ ещё выполняется. Её состояние доступно в логах ИИ.",
        "info",
      );
    } catch (error) {
      reportError(error, "Не удалось обновить состояние задачи ИИ");
    }
  };

  return (
    <div>
      <div className="admin-toolbar">
        <ModeSwitch<AdminTab>
          ariaLabel="Раздел админки"
          value={tab}
          onChange={setTab}
          options={[
            { value: "words", label: "Слова", icon: <BookOpen size={14} /> },
            {
              value: "categories",
              label: "Категории",
              icon: <Tag size={14} />,
            },
            {
              value: "import",
              label: "Импорт / Экспорт",
              icon: <ArrowLeftRight size={14} />,
            },
            {
              value: "duplicates",
              label: "Дубликаты",
              icon: <Copy size={14} />,
            },
            { value: "srs", label: "Ящики SRS", icon: <Layers size={14} /> },
            {
              value: "audio",
              label: "Озвучка",
              icon: <AudioLines size={14} />,
            },
            {
              value: "pictures",
              label: "Картинки",
              icon: <Images size={14} />,
            },
            {
              value: "ai-settings",
              label: "Настройки ИИ",
              icon: <Bot size={14} />,
            },
            {
              value: "ai-logs",
              label: "Логи ИИ",
              icon: <FileText size={14} />,
            },
            {
              value: "analytics",
              label: "Аналитика",
              icon: <BarChart3 size={14} />,
            },
            {
              value: "users",
              label: "Пользователи",
              icon: <Users size={14} />,
            },
          ]}
        />
      </div>

      {tab === "words" && (
        <WordsTab
          words={words}
          categories={categories}
          search={search}
          selectedCategory={category}
          onSearchChange={setSearch}
          onCategoryChange={setCategory}
          onAddWord={() => {
            setEditingWord(null);
            setIsWordOpen(true);
          }}
          onEditWord={(w) => {
            setEditingWord(w);
            setIsWordOpen(true);
          }}
          onDeleteWord={handleDeleteWord}
          onBulkCategory={handleBulkCategory}
          onBulkPartOfSpeech={handleBulkPartOfSpeech}
          onBulkDelete={handleBulkDelete}
          onAIAction={handleAIAction}
          onCheckWords={handleCheckWords}
        />
      )}
      {tab === "categories" && (
        <CategoriesTab
          categories={categories}
          onAddCategory={() => {
            setEditingCat(null);
            setIsCatOpen(true);
          }}
          onEditCategory={(c) => {
            setEditingCat(c);
            setIsCatOpen(true);
          }}
          onDeleteCategory={handleDeleteCategory}
        />
      )}
      {tab === "import" && (
        <div className="import-stack">
          <WordFillCard categories={categories} onRefresh={refreshAll} />
          <details className="import-manual">
            <summary>Ручной импорт / экспорт (JSON и текст)</summary>
            <div className="import-stack">
              <ImportExportTab categories={categories} onRefresh={refreshAll} />
              <ImportReviewCard
                categories={categories}
                onRefresh={refreshAll}
              />
            </div>
          </details>
        </div>
      )}
      {tab === "duplicates" && <DuplicatesTab onChanged={refreshAll} />}
      {tab === "srs" && <SrsSettingsTab />}
      {tab === "audio" && <AudioCacheTab />}
      {tab === "pictures" && <PicturesTab />}
      {tab === "ai-settings" && <AISettingsTab view="settings" />}
      {tab === "ai-logs" && <AISettingsTab view="logs" />}
      {tab === "analytics" && <AnalyticsTab />}
      {tab === "users" && <UsersTab />}

      {isWordOpen && (
        <WordModal
          word={editingWord}
          categories={categories}
          onClose={() => setIsWordOpen(false)}
          onSave={handleSaveWord}
        />
      )}
      {isCatOpen && (
        <CategoryModal
          category={editingCat}
          onClose={() => setIsCatOpen(false)}
          onSave={handleSaveCategory}
        />
      )}
    </div>
  );
};
