import React from 'react';
import { Volume2, Check, X } from 'lucide-react';
import { UmlautBar } from '../UmlautBar';
import { speakGerman } from '../../utils/audio';

interface NumbersQuizCardProps {
  currentNumber: number;
  expectedGerman: string;
  isGermanToDigits: boolean;
  userInput: string;
  feedback: { isCorrect: boolean; message: string } | null;
  onInputChange: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onNext: () => void;
  onInsertChar: (char: string) => void;
}

export const NumbersQuizCard: React.FC<NumbersQuizCardProps> = ({
  currentNumber,
  expectedGerman,
  isGermanToDigits,
  userInput,
  feedback,
  onInputChange,
  onSubmit,
  onNext,
  onInsertChar,
}) => {
  return (
    <div className="question-card">
      <div className="question-prompt-label">
        {isGermanToDigits ? 'Напишите число цифрами' : 'Напишите число прописью по-немецки'}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <h2 className="question-text">{isGermanToDigits ? expectedGerman : currentNumber.toLocaleString('de-DE')}</h2>
        <button
          type="button"
          className="icon-btn"
          style={{ width: 34, height: 34 }}
          onClick={() => speakGerman(expectedGerman)}
          title="Озвучить"
        >
          <Volume2 size={18} />
        </button>
      </div>

      <form onSubmit={onSubmit} style={{ width: '100%' }}>
        <div className="input-group">
          <input
            type="text"
            className="text-input"
            placeholder={isGermanToDigits ? 'Например: 42' : 'Например: zweiundvierzig'}
            value={userInput}
            onChange={(e) => onInputChange(e.target.value)}
            autoFocus
          />
          {feedback ? (
            <button type="button" className="btn-primary" onClick={onNext} autoFocus>
              Дальше (Enter)
            </button>
          ) : (
            <button type="submit" className="btn-primary">
              Проверить
            </button>
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
