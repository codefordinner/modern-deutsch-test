import React, { useState } from 'react';
import { BookOpen, Layers, RefreshCw } from 'lucide-react';
import { VerbsTableModal } from './verbs/VerbsTableModal';
import { VerbsSRSModal } from './verbs/VerbsSRSModal';
import { PraesensQuiz } from './verbs/PraesensQuiz';
import { StammformenQuiz } from './verbs/StammformenQuiz';
import { MultipleChoiceQuiz } from './verbs/MultipleChoiceQuiz';
import { FormToInfinitiveQuiz } from './verbs/FormToInfinitiveQuiz';
import { useVerbsQuizEngine } from '../hooks/useVerbsQuizEngine';
import type { VerbQuizMode } from '../hooks/useVerbsQuizEngine';

export const VerbsTrainer: React.FC<{ onAnswer: (ok: boolean) => void }> = ({ onAnswer }) => {
  const {
    verbs, isLoading, loadError, reload, isPoolEmpty,
    mode, setMode, praesensSubMode, handleSetPraesensSubMode,
    useSRS, setUseSRS, srsMap, resetSRS,
    currentVerb, currentPronoun, currentPraesensType, currentFormText, expectedPraesens, mcOptions, currentSrsItem,
    userInput, setUserInput,
    praeteritumInput, setPraeteritumInput, partizip2Input, setPartizip2Input, hilfsverbInput, setHilfsverbInput,
    feedback,
    nextQuestion, handlePraesensSubmit, handleFormToInfinitiveSubmit, handleStammSubmit, handleSelectOption,
  } = useVerbsQuizEngine(onAnswer);

  const [isTableOpen, setIsTableOpen] = useState(false);
  const [isSrsOpen, setIsSrsOpen] = useState(false);

  const emptyPoolMessage: Record<VerbQuizMode, string> = {
    stammformen: 'Нет глаголов, у которых заполнены обе формы — Präteritum и Partizip II. Заполните их в «Панели управления», чтобы этот режим заработал.',
    multiple_choice: 'Для теста нужно минимум два глагола с разными формами Partizip II — неверные варианты берутся из формы других глаголов словаря. Заполните Partizip II в «Панели управления», чтобы этот режим заработал.',
    praesens: 'Нет данных для этого режима. Заполните спряжение Präsens (ich/du/er.../wir/ihr/sie), Präteritum и/или Partizip II в «Панели управления» — формы «wir» и «sie/Sie» подставляются автоматически, остальное нужно указать вручную.',
  };

  return (
    <div>
      <div className="trainer-toolbar">
        <div className="trainer-modes trainer-modes--flush">
          <button className={`mode-pill ${mode === 'stammformen' ? 'active' : ''}`} onClick={() => setMode('stammformen')}>3 Формы (Stammformen)</button>
          <button className={`mode-pill ${mode === 'praesens' ? 'active' : ''}`} onClick={() => setMode('praesens')}>Спряжение / Форма → Инфинитив</button>
          <button className={`mode-pill ${mode === 'multiple_choice' ? 'active' : ''}`} onClick={() => setMode('multiple_choice')}>Тест (4 варианта)</button>
        </div>
        <div className="toolbar-actions">
          <button className="btn-secondary" onClick={() => setIsSrsOpen(true)}><Layers size={15} /> SRS</button>
          <button className="btn-secondary" onClick={() => setIsTableOpen(true)}><BookOpen size={15} /> Таблица глаголов</button>
        </div>
      </div>

      {mode === 'praesens' && (
        <div className="submode-bar">
          <div className="submode-row">
            <span className="submode-label">Направление:</span>
            <div className="trainer-modes trainer-modes--flush">
              <button
                className={`mode-pill ${praesensSubMode === 'both' ? 'active' : ''}`}
                onClick={() => handleSetPraesensSubMode('both')}
              >
                Вперемешку
              </button>
              <button
                className={`mode-pill ${praesensSubMode === 'praesens' ? 'active' : ''}`}
                onClick={() => handleSetPraesensSubMode('praesens')}
              >
                Только Спряжение
              </button>
              <button
                className={`mode-pill ${praesensSubMode === 'form_to_infinitive' ? 'active' : ''}`}
                onClick={() => handleSetPraesensSubMode('form_to_infinitive')}
              >
                Только Форма → Инфинитив
              </button>
            </div>
          </div>
          {praesensSubMode !== 'praesens' && (
            <div className="submode-hint">
              «Форма → Инфинитив» показывает форму Präsens (по лицам), Präteritum или Partizip II — в зависимости от того, что заполнено у глагола.
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="card state-card state-card--compact">Загрузка глаголов...</div>
      ) : loadError ? (
        <div className="card state-card">
          <div className="state-icon">⚠️</div>
          <h3 className="state-title">Не удалось загрузить глаголы</h3>
          <p className="state-text state-text--narrow">{loadError}</p>
          <button className="btn-secondary" onClick={reload}><RefreshCw size={14} /> Повторить</button>
        </div>
      ) : verbs.length === 0 ? (
        <div className="card state-card">
          <div className="state-icon">⚡</div>
          <h3 className="state-title">В базе пока нет глаголов</h3>
          <p className="state-text">
            Чтобы тренировать формы глаголов (Präsens, Präteritum, Partizip II), добавьте слова через <strong>«Панель управления»</strong> (Админка), указав часть речи «Глагол» и заполнив формы.
          </p>
        </div>
      ) : isPoolEmpty ? (
        <div className="card state-card">
          <div className="state-icon">✍️</div>
          <h3 className="state-title">Недостаточно данных для этого режима</h3>
          <p className="state-text state-text--flush">
            {emptyPoolMessage[mode]}
          </p>
        </div>
      ) : currentVerb && mode === 'stammformen' ? (
        <StammformenQuiz
          verb={currentVerb} srsItem={currentSrsItem} praeteritumInput={praeteritumInput} partizip2Input={partizip2Input} hilfsverbInput={hilfsverbInput} feedback={feedback}
          onPraeteritumChange={setPraeteritumInput} onPartizip2Change={setPartizip2Input} onHilfsverbChange={setHilfsverbInput}
          onSubmit={handleStammSubmit} onNext={nextQuestion} onInsertChar={(c) => setPraeteritumInput((p) => p + c)}
        />
      ) : currentVerb && mode === 'praesens' && currentPraesensType === 'praesens' ? (
        <PraesensQuiz
          verb={currentVerb} srsItem={currentSrsItem} pronoun={currentPronoun} expected={expectedPraesens} userInput={userInput} feedback={feedback}
          onInputChange={setUserInput} onSubmit={handlePraesensSubmit} onNext={nextQuestion} onInsertChar={(c) => setUserInput((p) => p + c)}
        />
      ) : currentVerb && mode === 'praesens' && currentPraesensType === 'form_to_infinitive' ? (
        <FormToInfinitiveQuiz
          srsItem={currentSrsItem} formText={currentFormText} userInput={userInput} feedback={feedback}
          onInputChange={setUserInput} onSubmit={handleFormToInfinitiveSubmit} onNext={nextQuestion} onInsertChar={(c) => setUserInput((p) => p + c)}
        />
      ) : currentVerb && mode === 'multiple_choice' ? (
        <MultipleChoiceQuiz
          verb={currentVerb} srsItem={currentSrsItem} options={mcOptions} feedback={feedback}
          onSelectOption={handleSelectOption}
          onNext={nextQuestion}
        />
      ) : (
        <div className="card state-card state-card--compact">Загрузка...</div>
      )}

      {isTableOpen && <VerbsTableModal verbs={verbs} onClose={() => setIsTableOpen(false)} />}
      {isSrsOpen && (
        <VerbsSRSModal
          verbs={verbs}
          srsState={srsMap}
          useSRS={useSRS}
          onClose={() => setIsSrsOpen(false)}
          onResetSRS={resetSRS}
          onToggleUseSRS={setUseSRS}
        />
      )}
    </div>
  );
};
