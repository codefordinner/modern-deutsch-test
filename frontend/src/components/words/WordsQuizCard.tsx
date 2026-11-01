import React from 'react';
import { Lightbulb, Volume2 } from 'lucide-react';
import { UmlautBar } from '../UmlautBar';
import { FeedbackSlot } from '../FeedbackBox';
import { ArticleText, ArticleWord } from '../ArticleText';
import { speakGerman } from '../../utils/audio';
import { useUISettings } from '../../hooks/useUISettings';
import type { WordHint } from '../../utils/wordHint';
import type { Word, SRSRecord, Feedback } from '../../types';

interface WordsQuizCardProps {
  currentWord: Word;
  direction: 'de_to_ru' | 'ru_to_de';
  formType: 'base' | 'plural' | 'feminine';
  srsItem?: SRSRecord;
  useSRS?: boolean;
  userInput: string;
  feedback: Feedback | null;
  hint: WordHint;
  onHint: () => void;
  onInputChange: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onNext: () => void;
  onInsertChar: (char: string) => void;
}

export const WordsQuizCard: React.FC<WordsQuizCardProps> = ({
  currentWord,
  direction,
  formType,
  srsItem,
  useSRS = true,
  userInput,
  feedback,
  hint,
  onHint,
  onInputChange,
  onSubmit,
  onNext,
  onInsertChar,
}) => {
  const [settings] = useUISettings();
  const boxNum = srsItem?.box || 1;

  let promptLabel = direction === 'de_to_ru' ? 'Переведите на русский' : 'Напишите по-немецки';
  let mainText = direction === 'de_to_ru' ? currentWord.de : currentWord.ru;
  // The category hint can be switched off in the settings (it may give the answer away).
  const subText =
    settings.showCategoryHint && currentWord.category
      ? `${currentWord.category.icon || '📁'} ${currentWord.category.name}`
      : '';

  if (formType === 'plural') {
    promptLabel = direction === 'de_to_ru' ? 'Переведите форму Plural' : 'Напишите форму множественного числа (Plural)';
    if (direction === 'de_to_ru') {
      mainText = currentWord.plural || currentWord.de;
    } else {
      mainText = `${currentWord.ru} (множ. число)`;
    }
  } else if (formType === 'feminine') {
    promptLabel = direction === 'de_to_ru' ? 'Переведите форму Feminin' : 'Напишите форму женского рода (Feminin)';
    if (direction === 'de_to_ru') {
      mainText = currentWord.feminine || currentWord.de;
    } else {
      mainText = `${currentWord.ru} (жен. род)`;
    }
  }

  const audioTarget = formType === 'plural' ? (currentWord.plural || currentWord.de) : formType === 'feminine' ? (currentWord.feminine || currentWord.de) : currentWord.de;
  const hintExhausted = hint.level >= hint.maxLevel;

  return (
    <div className="question-card">
      <div className="question-header">
        <span className="question-prompt-label">{promptLabel}</span>
        {useSRS ? (
          <span className={`leitner-badge box-${boxNum}`}>Ящик {boxNum}</span>
        ) : (
          <span className="leitner-badge leitner-badge--random">🎲 Рандом</span>
        )}
      </div>

      <div className="question-title-row">
        <h2 className="question-text">{direction === 'de_to_ru' ? <ArticleText text={mainText} /> : mainText}</h2>
        {direction === 'de_to_ru' && (
          <button type="button" className="icon-btn" onClick={() => speakGerman(audioTarget)} title="Озвучить" aria-label="Озвучить">
            <Volume2 size={18} />
          </button>
        )}
      </div>

      {subText && <div className="question-subtext">{subText}</div>}
      {currentWord.hint && (
        <div className="question-subtext question-subtext--hint">
          💡 {currentWord.hint}
        </div>
      )}

      <form onSubmit={onSubmit} className="question-form">
        <div className="input-group">
          <input
            type="text"
            className="text-input"
            placeholder={direction === 'de_to_ru' ? 'Введите перевод...' : formType === 'plural' ? 'die Tische...' : formType === 'feminine' ? 'die Ärztin...' : 'der / die / das...'}
            value={userInput}
            onChange={(e) => onInputChange(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            autoFocus={settings.autoFocus}
          />
          {feedback ? (
            <button
              key="next"
              type="button"
              className="btn-primary"
              onClick={onNext}
              autoFocus={settings.autoFocus && settings.collapseKeyboardAfterAnswer}
            >
              Дальше (Enter)
            </button>
          ) : (
            <button key="check" type="submit" className="btn-primary">Проверить</button>
          )}
        </div>
      </form>

      {/* The row is always rendered, so showing a hint never moves the layout (see FeedbackSlot). */}
      <div className="hint-row">
        <button
          type="button"
          className="btn-secondary btn-xs hint-btn"
          disabled={feedback !== null || hintExhausted}
          // Keep focus (and the on-screen keyboard) in the answer field when the button is tapped.
          onMouseDown={(e) => e.preventDefault()}
          onClick={onHint}
          title={hint.level === 0 ? 'Показать артикль, дальше — по букве' : 'Показать ещё одну букву'}
        >
          <Lightbulb size={14} aria-hidden="true" /> Подсказка
        </button>
        {hint.level > 0 && (
          <span className="hint-text" aria-live="polite">
            {hint.article && (
              <>
                <ArticleWord article={hint.article} />{' '}
              </>
            )}
            {hint.masked}
          </span>
        )}
      </div>

      <UmlautBar onInsert={onInsertChar} />

      <FeedbackSlot feedback={feedback} />
    </div>
  );
};
