import React, { useState } from 'react';
import { Sliders, BookOpen, Layers, RefreshCw } from 'lucide-react';
import { WordsQuizCard } from './words/WordsQuizCard';
import { WordsDictionaryModal } from './words/WordsDictionaryModal';
import { WordsSRSModal } from './words/WordsSRSModal';
import { WordsSettingsModal } from './words/WordsSettingsModal';
import { useWordsQuizEngine } from '../hooks/useWordsQuizEngine';
import type { ScoreState } from '../types';

export const WordsTrainer: React.FC<{ score: ScoreState; onAnswer: (isCorrect: boolean) => void }> = ({ onAnswer }) => {
  const {
    words, categories, isLoading, loadError, reload,
    directionMode, setDirectionMode, selectedCats, setSelectedCats,
    requireArticle, setRequireArticle, enableBase, setEnableBase,
    enablePlural, setEnablePlural, enableFeminine, setEnableFeminine,
    useSRS, setUseSRS, srsMap, resetSRS,
    currentWord, activeDirection, currentFormType, currentSrsItem,
    userInput, setUserInput, feedback, nextWord, handleSubmit,
  } = useWordsQuizEngine(onAnswer);

  const [isDictOpen, setIsDictOpen] = useState(false);
  const [isSrsOpen, setIsSrsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div>
      <div className="trainer-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div className="trainer-modes" style={{ margin: 0 }}>
          <button className={`mode-pill ${directionMode === 'ru_to_de' ? 'active' : ''}`} onClick={() => setDirectionMode('ru_to_de')}>Русский → Немецкий</button>
          <button className={`mode-pill ${directionMode === 'de_to_ru' ? 'active' : ''}`} onClick={() => setDirectionMode('de_to_ru')}>Немецкий → Русский</button>
          <button className={`mode-pill ${directionMode === 'mixed' ? 'active' : ''}`} onClick={() => setDirectionMode('mixed')}>Случайно (Оба)</button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={() => setIsSrsOpen(true)}><Layers size={15} /> SRS</button>
          <button className="btn-secondary" onClick={() => setIsDictOpen(true)}><BookOpen size={15} /> Словарь</button>
          <button className="btn-secondary" onClick={() => setIsSettingsOpen(true)}><Sliders size={15} /> Настройки</button>
        </div>
      </div>

      {isLoading ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>Загрузка слов...</div>
      ) : loadError ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
          <h3 style={{ margin: '0 0 8px' }}>Не удалось загрузить слова</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 420, margin: '0 auto 16px', fontSize: 14 }}>{loadError}</p>
          <button className="btn-secondary" onClick={reload}><RefreshCw size={14} /> Повторить</button>
        </div>
      ) : words.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📚</div>
          <h3 style={{ margin: '0 0 8px' }}>В словаре пока нет слов</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 460, margin: '0 auto 16px', fontSize: 14 }}>
            База данных пуста и готова к наполнению. Перейдите в раздел <strong>«Панель управления»</strong> (Админка), чтобы добавить слова, глаголы и категории или импортировать свой список через JSON / CSV.
          </p>
        </div>
      ) : selectedCats.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
          <h3 style={{ margin: '0 0 8px' }}>Категории не выбраны</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 420, margin: '0 auto 20px', fontSize: 14 }}>
            Вы очистили список категорий. Выберите нужные категории в настройках или включите все сразу.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn-primary" onClick={() => setSelectedCats(['all'])}>
              Выбрать все категории
            </button>
            <button className="btn-secondary" onClick={() => setIsSettingsOpen(true)}>
              Открыть настройки
            </button>
          </div>
        </div>
      ) : currentWord ? (
        <WordsQuizCard
          currentWord={currentWord} direction={activeDirection} formType={currentFormType}
          srsItem={currentSrsItem} useSRS={useSRS}
          userInput={userInput} feedback={feedback} onInputChange={setUserInput}
          onSubmit={handleSubmit} onNext={nextWord} onInsertChar={(c) => setUserInput((p) => p + c)}
        />
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>Загрузка...</div>
      )}

      {isDictOpen && <WordsDictionaryModal words={words} categories={categories} onClose={() => setIsDictOpen(false)} />}
      {isSrsOpen && (
        <WordsSRSModal
          words={words}
          srsState={srsMap}
          useSRS={useSRS}
          onClose={() => setIsSrsOpen(false)}
          onResetSRS={resetSRS}
          onToggleUseSRS={setUseSRS}
        />
      )}
      {isSettingsOpen && (
        <WordsSettingsModal
          categories={categories} selectedCategories={selectedCats} requireArticle={requireArticle}
          enableBase={enableBase} enablePlural={enablePlural} enableFeminine={enableFeminine} useSRS={useSRS}
          onClose={() => setIsSettingsOpen(false)} onCategoriesChange={setSelectedCats} onRequireArticleChange={setRequireArticle}
          onEnableBaseChange={setEnableBase} onEnablePluralChange={setEnablePlural} onEnableFeminineChange={setEnableFeminine}
          onUseSRSChange={setUseSRS}
        />
      )}
    </div>
  );
};
