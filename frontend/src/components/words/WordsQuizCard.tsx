import React from 'react';
import { Volume2, Check, X } from 'lucide-react';
import { UmlautBar } from '../UmlautBar';
import { speakGerman } from '../../utils/audio';
import type { Word, SRSState } from '../../types';

interface WordsQuizCardProps {
  currentWord: Word;
  direction: 'de_to_ru' | 'ru_to_de';
  formType: 'base' | 'plural' | 'feminine';
  srsItem?: SRSState;
  useSRS?: boolean;
  userInput: string;
  feedback: { isCorrect: boolean; message: string } | null;
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
  onInputChange,
  onSubmit,
  onNext,
  onInsertChar,
}) => {
  const boxNum = srsItem?.box || 1;

  let promptLabel = direction === 'de_to_ru' ? 'Переведите на русский' : 'Напишите по-немецки';
  let mainText = direction === 'de_to_ru' ? currentWord.de : currentWord.ru;
  let subText = currentWord.category ? `${currentWord.category.icon || '📁'} ${currentWord.category.name}` : '';

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

  return (
    <div className="question-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 540, marginBottom: 12 }}>
        <span className="question-prompt-label" style={{ margin: 0 }}>{promptLabel}</span>
        {useSRS ? (
          <span className={`leitner-badge box-${boxNum}`}>Ящик {boxNum}</span>
        ) : (
          <span className="leitner-badge" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', borderColor: 'var(--border-color)' }}>
            🎲 Рандом
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <h2 className="question-text">{mainText}</h2>
        {direction === 'de_to_ru' && (
          <button type="button" className="icon-btn" onClick={() => speakGerman(audioTarget)} title="Озвучить">
            <Volume2 size={18} />
          </button>
        )}
      </div>

      {subText && <div className="question-subtext">{subText}</div>}

      <form onSubmit={onSubmit} style={{ width: '100%' }}>
        <div className="input-group">
          <input
            type="text"
            className="text-input"
            placeholder={direction === 'de_to_ru' ? 'Введите перевод...' : formType === 'plural' ? 'die Tische...' : formType === 'feminine' ? 'die Ärztin...' : 'der / die / das...'}
            value={userInput}
            onChange={(e) => onInputChange(e.target.value)}
            autoFocus
          />
          {feedback ? (
            <button type="button" className="btn-primary" onClick={onNext} autoFocus>Дальше (Enter)</button>
          ) : (
            <button type="submit" className="btn-primary">Проверить</button>
          )}
        </div>
      </form>

      <UmlautBar onInsert={onInsertChar} />

      {feedback && (
        <div className={`feedback-box ${feedback.isCorrect ? 'feedback-success' : 'feedback-error'}`}>
          {feedback.isCorrect ? <Check size={20} /> : <X size={20} />}
          <div>
            <div style={{ fontWeight: 700 }}>{feedback.isCorrect ? 'Верно!' : 'Ошибка!'}</div>
            <div style={{ fontSize: 14 }}>{feedback.message}</div>
          </div>
        </div>
      )}
    </div>
  );
};
