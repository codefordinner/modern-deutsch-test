import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sliders, BookOpen, Layers } from 'lucide-react';
import { WordsQuizCard } from './words/WordsQuizCard';
import { WordsDictionaryModal } from './words/WordsDictionaryModal';
import { WordsSRSModal } from './words/WordsSRSModal';
import { WordsSettingsModal } from './words/WordsSettingsModal';
import { getDueCards, updateSRS } from '../utils/srs';
import type { Word, Category, ScoreState, SRSState } from '../types';

export const WordsTrainer: React.FC<{ score: ScoreState; onAnswer: (isCorrect: boolean) => void }> = ({ onAnswer }) => {
  const [directionMode, setDirectionMode] = useState<'ru_to_de' | 'de_to_ru' | 'mixed'>('ru_to_de');
  const [activeDirection, setActiveDirection] = useState<'ru_to_de' | 'de_to_ru'>('ru_to_de');
  const [words, setWords] = useState<Word[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCats, setSelectedCats] = useState<string[]>(['all']);
  const [requireArticle, setRequireArticle] = useState(true);
  const [enableBase, setEnableBase] = useState(true);
  const [enablePlural, setEnablePlural] = useState(true);
  const [enableFeminine, setEnableFeminine] = useState(true);
  const [useSRS, setUseSRS] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('words_use_srs');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [currentWord, setCurrentWord] = useState<Word | null>(null);
  const [currentFormType, setCurrentFormType] = useState<'base' | 'plural' | 'feminine'>('base');
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; message: string } | null>(null);
  const [srsMap, setSrsMap] = useState<Record<string, SRSState>>(() => {
    try { return JSON.parse(localStorage.getItem('words_srs_state') || '{}'); } catch { return {}; }
  });

  const srsMapRef = useRef(srsMap);
  srsMapRef.current = srsMap;

  const [isDictOpen, setIsDictOpen] = useState(false);
  const [isSrsOpen, setIsSrsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetch('/api/words?limit=1000').then((r) => r.json()), fetch('/api/categories').then((r) => r.json())])
      .then(([wData, cData]) => {
        setWords(wData.words || []);
        setCategories(cData || []);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const handleUseSRSChange = (val: boolean) => {
    setUseSRS(val);
    localStorage.setItem('words_use_srs', JSON.stringify(val));
  };

  const nextWord = useCallback(() => {
    if (selectedCats.length === 0) {
      setCurrentWord(null);
      return;
    }

    const isAll = selectedCats.includes('all');
    const activePool = words.filter((w) => isAll || selectedCats.includes(w.categoryId));
    if (activePool.length === 0) { setCurrentWord(null); return; }

    let chosen: Word;
    if (useSRS) {
      const due = getDueCards(activePool, srsMapRef.current);
      chosen = due.length > 0 ? due[Math.floor(Math.random() * due.length)] : activePool[Math.floor(Math.random() * activePool.length)];
    } else {
      chosen = activePool[Math.floor(Math.random() * activePool.length)];
    }
    setCurrentWord(chosen);

    // Pick direction if mixed
    if (directionMode === 'mixed') {
      setActiveDirection(Math.random() > 0.5 ? 'ru_to_de' : 'de_to_ru');
    } else {
      setActiveDirection(directionMode);
    }

    // Pick form type
    const possibleForms: ('base' | 'plural' | 'feminine')[] = [];
    if (enableBase) possibleForms.push('base');
    if (enablePlural && chosen.plural) possibleForms.push('plural');
    if (enableFeminine && chosen.feminine) possibleForms.push('feminine');
    const chosenForm = possibleForms.length > 0 ? possibleForms[Math.floor(Math.random() * possibleForms.length)] : 'base';
    setCurrentFormType(chosenForm);

    setUserInput('');
    setFeedback(null);
  }, [words, selectedCats, useSRS, directionMode, enableBase, enablePlural, enableFeminine]);

  useEffect(() => {
    if (words.length > 0) {
      nextWord();
    }
  }, [words, selectedCats, directionMode, useSRS, enableBase, enablePlural, enableFeminine]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (feedback) { nextWord(); return; }
    if (!currentWord) return;

    let isCorrect = false;
    let expectedTarget = currentWord.de;
    if (currentFormType === 'plural' && currentWord.plural) expectedTarget = currentWord.plural;
    if (currentFormType === 'feminine' && currentWord.feminine) expectedTarget = currentWord.feminine;

    const cleanIn = userInput.trim().toLowerCase();
    if (cleanIn.length === 0) {
      isCorrect = false;
    } else if (activeDirection === 'ru_to_de') {
      const cleanDe = expectedTarget.trim().toLowerCase();
      if (requireArticle) isCorrect = cleanIn === cleanDe;
      else isCorrect = cleanIn === cleanDe.replace(/^(der|die|das)\s+/, '');
    } else {
      isCorrect = currentWord.ru.toLowerCase().split(/[,;/]/).map((s) => s.trim()).includes(cleanIn);
    }

    if (useSRS) {
      const updatedSRS = updateSRS(srsMap, currentWord.id, isCorrect);
      setSrsMap(updatedSRS);
      localStorage.setItem('words_srs_state', JSON.stringify(updatedSRS));
    }

    setFeedback({
      isCorrect,
      message: isCorrect
        ? `Отлично! ${expectedTarget} = ${currentWord.ru}`
        : `Правильный ответ: ${activeDirection === 'ru_to_de' ? expectedTarget : currentWord.ru}`,
    });
    onAnswer(isCorrect);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
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
          currentWord={currentWord} direction={activeDirection} formType={currentFormType} srsItem={srsMap[currentWord.id]} useSRS={useSRS}
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
          onResetSRS={() => { setSrsMap({}); localStorage.removeItem('words_srs_state'); }}
          onToggleUseSRS={handleUseSRSChange}
        />
      )}
      {isSettingsOpen && (
        <WordsSettingsModal
          categories={categories} selectedCategories={selectedCats} requireArticle={requireArticle}
          enableBase={enableBase} enablePlural={enablePlural} enableFeminine={enableFeminine} useSRS={useSRS}
          onClose={() => setIsSettingsOpen(false)} onCategoriesChange={setSelectedCats} onRequireArticleChange={setRequireArticle}
          onEnableBaseChange={setEnableBase} onEnablePluralChange={setEnablePlural} onEnableFeminineChange={setEnableFeminine}
          onUseSRSChange={handleUseSRSChange}
        />
      )}
    </div>
  );
};
