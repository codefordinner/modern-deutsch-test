import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Layers, RefreshCw, Tag, Volume2 } from 'lucide-react';
import { ArticlesSRSModal } from './articles/ArticlesSRSModal';
import { ArticlesCategoriesModal } from './articles/ArticlesCategoriesModal';
import { FeedbackBox } from './FeedbackBox';
import { SRSIdleCard } from './srs/SRSIdleCard';
import { ToolbarButton } from './ToolbarButton';
import { getErrorMessage } from '../api/request';
import { useCategories, useWords } from '../hooks/useDictionary';
import { usePersistentState } from '../hooks/usePersistentState';
import { useSRSProgress } from '../hooks/useSRSProgress';
import { useUISettings } from '../hooks/useUISettings';
import { ARTICLES, articleSrsKey, isArticleNoun, splitArticle } from '../utils/articles';
import type { Article } from '../utils/articles';
import { speakGerman } from '../utils/audio';
import { formatCategories, wordCategoryIds, wordInAnyCategory } from '../utils/wordCategories';
import type { Word } from '../types';

/**
 * Stored selection of categories: `['all']`, a list of ids, or `[]` (explicitly cleared).
 * Older versions saved a single id / 'all' as a plain string — still understood.
 */
function sanitizeCategories(raw: unknown): string[] {
  if (typeof raw === 'string') return raw ? [raw] : ['all'];
  if (Array.isArray(raw)) return raw.filter((c): c is string => typeof c === 'string');
  return ['all'];
}

/**
 * "der / die / das": the noun is shown without its article, the learner taps one of
 * three buttons (or presses 1 / 2 / 3). One Leitner card per noun — a noun that is in
 * several of the selected categories is still asked once.
 */
export const ArticlesTrainer: React.FC<{ onAnswer: (isCorrect: boolean) => void }> = ({ onAnswer }) => {
  const { words, hasData, error, isLoading, refetch } = useWords();
  const { categories } = useCategories();
  const { useSRS, setUseSRS, srsMap, recordAnswer, resetSRS, pickCard } = useSRSProgress('articles');
  const [uiSettings] = useUISettings();

  const [savedCats, setSavedCats] = usePersistentState<string[]>('articles_category', ['all'], sanitizeCategories);
  // A saved category may have been deleted since: ignore the vanished ones, and if nothing is left
  // fall back to "all". An explicitly cleared list stays empty.
  const selectedCats = useMemo(() => {
    if (savedCats.length === 0 || savedCats.includes('all') || categories.length === 0) return savedCats;
    const valid = savedCats.filter((id) => categories.some((c) => c.id === id));
    return valid.length > 0 ? valid : ['all'];
  }, [savedCats, categories]);
  const isAllCategories = selectedCats.includes('all');

  const [current, setCurrent] = useState<Word | null>(null);
  const [picked, setPicked] = useState<Article | null>(null);
  const [isSrsOpen, setIsSrsOpen] = useState(false);
  const [isCatsOpen, setIsCatsOpen] = useState(false);

  const nouns = useMemo(() => words.filter(isArticleNoun), [words]);
  const pool = useMemo(
    () => (selectedCats.length === 0 ? [] : nouns.filter((w) => wordInAnyCategory(w, selectedCats))),
    [nouns, selectedCats]
  );
  const poolKeys = useMemo(() => pool.map((w) => articleSrsKey(w.id)), [pool]);
  const nounCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const noun of nouns) for (const id of wordCategoryIds(noun)) counts[id] = (counts[id] ?? 0) + 1;
    return counts;
  }, [nouns]);
  const scope = isAllCategories ? 'все категории' : `выбрано категорий: ${selectedCats.length}`;

  const nextWord = useCallback(() => {
    setCurrent(pickCard(pool, (w) => articleSrsKey(w.id)) ?? null);
    setPicked(null);
  }, [pool, pickCard]);

  // `nextWord` changes exactly when the pool or the SRS switches change, so a fresh card is dealt then.
  useEffect(() => {
    nextWord();
  }, [nextWord]);

  const parts = current ? splitArticle(current.de) : null;

  const answer = useCallback(
    (article: Article) => {
      if (!current || !parts || picked) return;
      const isCorrect = article === parts.article;
      setPicked(article);
      recordAnswer(articleSrsKey(current.id), isCorrect);
      onAnswer(isCorrect);
    },
    [current, parts, picked, recordAnswer, onAnswer]
  );

  // Keys 1 / 2 / 3 answer; "Дальше" holds focus, so Enter / Space move on without a handler here.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isSrsOpen || isCatsOpen || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      const index = ['1', '2', '3'].indexOf(event.key);
      if (index >= 0) answer(ARTICLES[index]);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [answer, isSrsOpen, isCatsOpen]);

  const loadError = !hasData && error !== undefined ? getErrorMessage(error, 'Не удалось загрузить слова') : null;
  const boxNumber = (current ? srsMap[articleSrsKey(current.id)]?.box : undefined) ?? 1;

  const renderBody = () => {
    if (loadError) {
      return (
        <div className="card state-card">
          <div className="state-icon">⚠️</div>
          <h3 className="state-title">Не удалось загрузить слова</h3>
          <p className="state-text state-text--narrow">{loadError}</p>
          <button className="btn-secondary" onClick={() => void refetch()}><RefreshCw size={14} /> Повторить</button>
        </div>
      );
    }
    if (isLoading) return <div className="card state-card state-card--compact">Загрузка слов...</div>;
    if (nouns.length === 0) {
      return (
        <div className="card state-card">
          <div className="state-icon">🔤</div>
          <h3 className="state-title">Нет существительных с артиклем</h3>
          <p className="state-text">
            Добавьте в словарь существительные, записанные с артиклем (<strong>der Tisch</strong>, <strong>die Stadt</strong>), — они появятся здесь автоматически.
          </p>
        </div>
      );
    }
    if (selectedCats.length === 0) {
      return (
        <div className="card state-card">
          <div className="state-icon">📂</div>
          <h3 className="state-title">Категории не выбраны</h3>
          <p className="state-text state-text--narrow">Выберите нужные категории или включите все сразу.</p>
          <div className="state-actions">
            <button className="btn-primary" onClick={() => setSavedCats(['all'])}>Выбрать все категории</button>
            <button className="btn-secondary" onClick={() => setIsCatsOpen(true)}>Выбрать категории</button>
          </div>
        </div>
      );
    }
    if (pool.length === 0) {
      return (
        <div className="card state-card">
          <div className="state-icon">📂</div>
          <h3 className="state-title">В выбранных категориях нет подходящих слов</h3>
          <div className="state-actions">
            <button className="btn-primary" onClick={() => setSavedCats(['all'])}>Все категории</button>
            <button className="btn-secondary" onClick={() => setIsCatsOpen(true)}>Выбрать категории</button>
          </div>
        </div>
      );
    }
    if (!current || !parts) return <SRSIdleCard />;

    return (
      <div className="question-card">
        <div className="question-header">
          <span className="question-prompt-label">Какой артикль?</span>
          {useSRS ? (
            <span className={`leitner-badge box-${boxNumber}`}>Ящик {boxNumber}</span>
          ) : (
            <span className="leitner-badge leitner-badge--random">🎲 Рандом</span>
          )}
        </div>

        <div className="question-title-row">
          <h2 className="question-text">{parts.noun}</h2>
          <button
            type="button"
            className="icon-btn"
            onClick={() => speakGerman(picked ? current.de : parts.noun)}
            title="Озвучить"
            aria-label="Озвучить"
          >
            <Volume2 size={18} />
          </button>
        </div>

        <div className="question-subtext">
          {current.ru}
          {uiSettings.showCategoryHint && formatCategories(current, '📁') ? ` · ${formatCategories(current, '📁')}` : ''}
        </div>
        {current.hint && <div className="question-subtext question-subtext--hint">💡 {current.hint}</div>}

        <div className="article-grid" role="group" aria-label="Выберите артикль">
          {ARTICLES.map((article, i) => {
            const state = !picked ? '' : article === parts.article ? 'is-correct' : article === picked ? 'is-wrong' : 'is-dim';
            return (
              <button
                key={article}
                type="button"
                className={`article-btn article-btn--${article} ${state}`}
                disabled={picked !== null}
                onClick={() => answer(article)}
              >
                {article}
                <span className="article-btn-key" aria-hidden="true">{i + 1}</span>
              </button>
            );
          })}
        </div>

        {picked && (
          <div className="mc-result">
            <FeedbackBox
              feedback={{
                isCorrect: picked === parts.article,
                message: `${parts.article} ${parts.noun} — ${current.ru}${current.plural ? ` (${current.plural})` : ''}`,
              }}
            />
            <button type="button" className="btn-primary" onClick={nextWord} autoFocus={uiSettings.autoFocus}>
              Дальше (Enter)
            </button>
          </div>
        )}
      </div>
    );
  };

  const categoriesLabel = `Категории: ${isAllCategories ? 'все' : selectedCats.length}`;

  return (
    <div>
      <div className="trainer-toolbar">
        <div className="toolbar-actions">
          <ToolbarButton
            icon={<Tag size={15} />}
            label={categoriesLabel}
            compactLabel={isAllCategories ? 'Все' : String(selectedCats.length)}
            onClick={() => setIsCatsOpen(true)}
          />
        </div>
        <div className="toolbar-actions">
          <ToolbarButton icon={<Layers size={15} />} label="SRS" onClick={() => setIsSrsOpen(true)} />
        </div>
      </div>

      {renderBody()}

      {isCatsOpen && (
        <ArticlesCategoriesModal
          categories={categories}
          selected={selectedCats}
          counts={nounCounts}
          onChange={setSavedCats}
          onClose={() => setIsCatsOpen(false)}
        />
      )}
      {isSrsOpen && (
        <ArticlesSRSModal
          nouns={nouns}
          srsState={srsMap}
          useSRS={useSRS}
          poolKeys={poolKeys}
          scope={scope}
          onClose={() => setIsSrsOpen(false)}
          onResetSRS={resetSRS}
          onToggleUseSRS={setUseSRS}
        />
      )}
    </div>
  );
};
