import React, { useState } from 'react';
import { Sliders, BookOpen, Layers, RefreshCw } from 'lucide-react';
import { WordsQuizCard } from './words/WordsQuizCard';
import { WordsDictionaryModal } from './words/WordsDictionaryModal';
import { WordsSRSModal } from './words/WordsSRSModal';
import { WordsSettingsModal } from './words/WordsSettingsModal';
import { useWordsQuizEngine } from '../hooks/useWordsQuizEngine';

export const WordsTrainer: React.FC<{ onAnswer: (isCorrect: boolean) => void }> = ({ onAnswer }) => {
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
      <div className="trainer-toolbar">
        <div className="trainer-modes trainer-modes--flush">
          <button className={`mode-pill ${directionMode === 'ru_to_de' ? 'active' : ''}`} onClick={() => setDirectionMode('ru_to_de')}>Русский → Немецкий</button>
          <button className={`mode-pill ${directionMode === 'de_to_ru' ? 'active' : ''}`} onClick={() => setDirectionMode('de_to_ru')}>Немецкий → Русский</button>
          <button className={`mode-pill ${directionMode === 'mixed' ? 'active' : ''}`} onClick={() => setDirectionMode('mixed')}>Случайно (Оба)</button>
        </div>
        <div className="toolbar-actions">
          <button className="btn-secondary" onClick={() => setIsSrsOpen(true)}><Layers size={15} /> SRS</button>
          <button className="btn-secondary" onClick={() => setIsDictOpen(true)}><BookOpen size={15} /> Словарь</button>
          <button className="btn-secondary" onClick={() => setIsSettingsOpen(true)}><Sliders size={15} /> Настройки</button>
        </div>
      </div>

      {isLoading ? (
        <div className="card state-card state-card--compact">Загрузка слов...</div>
      ) : loadError ? (
        <div className="card state-card">
          <div className="state-icon">⚠️</div>
          <h3 className="state-title">Не удалось загрузить слова</h3>
          <p className="state-text state-text--narrow">{loadError}</p>
          <button className="btn-secondary" onClick={reload}><RefreshCw size={14} /> Повторить</button>
        </div>
      ) : words.length === 0 ? (
        <div className="card state-card">
          <div className="state-icon">📚</div>
          <h3 className="state-title">В словаре пока нет слов</h3>
          <p className="state-text">
            База данных пуста и готова к наполнению. Перейдите в раздел <strong>«Панель управления»</strong> (Админка), чтобы добавить слова, глаголы и категории или импортировать свой список через JSON / CSV.
          </p>
        </div>
      ) : selectedCats.length === 0 ? (
        <div className="card state-card">
          <div className="state-icon">📂</div>
          <h3 className="state-title">Категории не выбраны</h3>
          <p className="state-text state-text--narrow">
            Вы очистили список категорий. Выберите нужные категории в настройках или включите все сразу.
          </p>
          <div className="state-actions">
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
        <div className="card state-card state-card--compact">Загрузка...</div>
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
