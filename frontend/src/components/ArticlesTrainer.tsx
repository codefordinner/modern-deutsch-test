import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Layers, RefreshCw, Volume2 } from 'lucide-react';
import { ArticlesSRSModal } from './articles/ArticlesSRSModal';
import { FeedbackBox } from './FeedbackBox';
import { SRSIdleCard } from './srs/SRSIdleCard';
import { getErrorMessage } from '../api/client';
import { useCategories, useWords } from '../hooks/useDictionary';
import { usePersistentState } from '../hooks/usePersistentState';
import { useSRSProgress } from '../hooks/useSRSProgress';
import { useUISettings } from '../hooks/useUISettings';
import { ARTICLES, articleSrsKey, isArticleNoun, splitArticle } from '../utils/articles';
import type { Article } from '../utils/articles';
import { speakGerman } from '../utils/audio';
import type { Word } from '../types';

/**
 * "der / die / das": the noun is shown without its article, the learner taps one of
 * three buttons (or presses 1 / 2 / 3). One Leitner card per noun.
 */
export const ArticlesTrainer: React.FC<{ onAnswer: (isCorrect: boolean) => void }> = ({ onAnswer }) => {
  const { words, hasData, error, isLoading, refetch } = useWords();
  const { categories } = useCategories();
  const { useSRS, setUseSRS, srsMap, recordAnswer, resetSRS, pickCard } = useSRSProgress('articles');
  const [uiSettings] = useUISettings();

  const [savedCategoryId, setCategoryId] = usePersistentState<string>('articles_category', 'all', (raw) =>
    typeof raw === 'string' && raw ? raw : 'all'
  );
  // A saved category may have been deleted since: fall back to "all" instead of an empty pool.
  const categoryId =
    savedCategoryId === 'all' || categories.length === 0 || categories.some((c) => c.id === savedCategoryId)
      ? savedCategoryId
      : 'all';
  const [current, setCurrent] = useState<Word | null>(null);
  const [picked, setPicked] = useState<Article | null>(null);
  const [isSrsOpen, setIsSrsOpen] = useState(false);

  const nouns = useMemo(() => words.filter(isArticleNoun), [words]);
  const pool = useMemo(
    () => (categoryId === 'all' ? nouns : nouns.filter((w) => w.categoryId === categoryId)),
    [nouns, categoryId]
  );
  const poolKeys = useMemo(() => pool.map((w) => articleSrsKey(w.id)), [pool]);
  const scope = categoryId === 'all' ? 'все категории' : (categories.find((c) => c.id === categoryId)?.name ?? 'категория');

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
      if (isSrsOpen || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      const index = ['1', '2', '3'].indexOf(event.key);
      if (index >= 0) answer(ARTICLES[index]);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [answer, isSrsOpen]);

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
    if (pool.length === 0) {
      return (
        <div className="card state-card">
          <div className="state-icon">📂</div>
          <h3 className="state-title">В этой категории нет подходящих слов</h3>
          <button className="btn-primary" onClick={() => setCategoryId('all')}>Все категории</button>
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
          {uiSettings.showCategoryHint && current.category ? ` · ${current.category.icon || '📁'} ${current.category.name}` : ''}
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

  return (
    <div>
      <div className="trainer-toolbar">
        <div className="toolbar-filters">
          <select
            className="text-input select-compact"
            aria-label="Категория"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="all">Все категории</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.icon || '📌'} {c.name}</option>
            ))}
          </select>
        </div>
        <div className="toolbar-actions">
          <button className="btn-secondary" onClick={() => setIsSrsOpen(true)}><Layers size={15} /> SRS</button>
        </div>
      </div>

      {renderBody()}

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
