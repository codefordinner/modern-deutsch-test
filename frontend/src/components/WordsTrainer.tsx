import React, { useState } from 'react';
import { Sliders, BookOpen, Layers, RefreshCw } from 'lucide-react';
import { WordsQuizCard } from './words/WordsQuizCard';
import { WordsDictionaryModal } from './words/WordsDictionaryModal';
import { WordsSRSModal } from './words/WordsSRSModal';
import { WordsSettingsModal } from './words/WordsSettingsModal';
import { SRSIdleCard } from './srs/SRSIdleCard';
import { ModeSwitch } from './ModeSwitch';
import { ToolbarButton } from './ToolbarButton';
import { useWordsQuizEngine } from '../hooks/useWordsQuizEngine';
import type { DirectionMode } from '../hooks/useWordsQuizEngine';

export const WordsTrainer: React.FC<{ onAnswer: (isCorrect: boolean) => void }> = ({ onAnswer }) => {
  const {
    words, categories, isLoading, loadError, reload, isPoolEmpty,
    directionMode, setDirectionMode, selectedCats, setSelectedCats,
    requireArticle, setRequireArticle, enableBase, setEnableBase,
    enablePlural, setEnablePlural, enableFeminine, setEnableFeminine,
    useSRS, setUseSRS, srsMap, resetSRS, poolKeys,
    currentWord, activeDirection, currentFormType, currentSrsItem,
    userInput, setUserInput, feedback, nextWord, handleSubmit,
  } = useWordsQuizEngine(onAnswer);

  const [isDictOpen, setIsDictOpen] = useState(false);
  const [isSrsOpen, setIsSrsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const scope = selectedCats.includes('all') ? 'все категории' : `выбрано категорий: ${selectedCats.length}`;

  return (
    <div>
      <div className="trainer-toolbar">
        <ModeSwitch<DirectionMode>
          ariaLabel="Направление"
          value={directionMode}
          onChange={setDirectionMode}
          options={[
            { value: 'ru_to_de', label: 'Русский → Немецкий', short: 'Рус → Нем' },
            { value: 'de_to_ru', label: 'Немецкий → Русский', short: 'Нем → Рус' },
            { value: 'mixed', label: 'Случайно (Оба)', short: 'Случайно' },
          ]}
        />
        <div className="toolbar-actions">
          <ToolbarButton icon={<Layers size={15} />} label="SRS" onClick={() => setIsSrsOpen(true)} />
          <ToolbarButton icon={<BookOpen size={15} />} label="Словарь" onClick={() => setIsDictOpen(true)} />
          <ToolbarButton icon={<Sliders size={15} />} label="Настройки" onClick={() => setIsSettingsOpen(true)} />
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
      ) : isPoolEmpty ? (
        <div className="card state-card">
          <div className="state-icon">🧩</div>
          <h3 className="state-title">Нет карточек для этих настроек</h3>
          <p className="state-text state-text--narrow">
            {!enableBase && !enablePlural && !enableFeminine
              ? 'Все типы форм отключены. Включите хотя бы один в настройках.'
              : 'В выбранных категориях нет слов с включёнными формами (например, отключена базовая форма, а у слов нет plural или feminin). Включите другие формы или категории в настройках.'}
          </p>
          <div className="state-actions">
            <button className="btn-primary" onClick={() => setIsSettingsOpen(true)}>Открыть настройки</button>
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
        <SRSIdleCard />
      )}

      {isDictOpen && <WordsDictionaryModal words={words} categories={categories} onClose={() => setIsDictOpen(false)} />}
      {isSrsOpen && (
        <WordsSRSModal
          words={words}
          srsState={srsMap}
          useSRS={useSRS}
          poolKeys={poolKeys}
          scope={scope}
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
