import React from 'react';
import { Check, X } from 'lucide-react';
import { diffAnswers } from '../utils/answerDiff';
import type { DiffSegment } from '../utils/answerDiff';
import type { AnswerCheck, Feedback } from '../types';

/** Renders a run of characters; a changed run that is only whitespace stays visible. */
const renderSegments = (segments: DiffSegment[], changedClass: string) =>
  segments.map((seg, i) =>
    seg.changed ? (
      <strong key={i} className={seg.text.trim() === '' ? `${changedClass} answer-diff-space` : changedClass}>
        {seg.text}
      </strong>
    ) : (
      <React.Fragment key={i}>{seg.text}</React.Fragment>
    ),
  );

const AnswerComparison: React.FC<{ check: AnswerCheck }> = ({ check }) => {
  // The article (der/die/das) may be shown but not asked for — keep it out of the comparison.
  const prefix =
    check.neutralPrefix && check.expected.startsWith(check.neutralPrefix) ? check.neutralPrefix : '';
  const core = check.expected.slice(prefix.length);
  const diff = diffAnswers(check.user, core, { ignoreSpaces: check.ignoreSpaces });
  const userText = check.user.trim();

  return (
    <div className="answer-compare">
      {check.label && <div className="answer-compare-heading">{check.label}</div>}

      <div className="answer-compare-row">
        <span className="answer-compare-tag">{check.userLabel ?? 'Вы ввели'}:</span>
        <span className="answer-compare-text answer-compare-user">
          {userText ? renderSegments(diff.user, 'answer-diff-wrong') : <em className="answer-compare-empty">ничего не введено</em>}
        </span>
      </div>

      <div className="answer-compare-row">
        <span className="answer-compare-tag">Правильно:</span>
        <span className="answer-compare-text answer-compare-expected">
          {prefix}
          {renderSegments(diff.expected, 'answer-diff-right')}
        </span>
      </div>

      {check.alternatives && check.alternatives.length > 0 && (
        <div className="answer-compare-alt">Все варианты: {check.alternatives.join(', ')}</div>
      )}
    </div>
  );
};

interface FeedbackBoxProps {
  feedback: Feedback;
  /** Extra control shown at the right edge (e.g. a "speak" button). */
  action?: React.ReactNode;
}

export const FeedbackBox: React.FC<FeedbackBoxProps> = ({ feedback, action }) => {
  const showChecks = !feedback.isCorrect && !!feedback.checks && feedback.checks.length > 0;

  return (
    <div
      className={`feedback-box ${feedback.isCorrect ? 'feedback-success' : 'feedback-error'} ${showChecks ? 'feedback-box-compare' : ''}`}
      role={feedback.isCorrect ? 'status' : 'alert'}
    >
      {feedback.isCorrect ? <Check size={20} className="feedback-icon" /> : <X size={20} className="feedback-icon" />}
      <div className="feedback-content">
        <div className="feedback-title">{feedback.isCorrect ? 'Верно!' : 'Ошибка!'}</div>

        {showChecks ? (
          <div className="answer-compare-list">
            {feedback.checks!.map((check, i) =>
              check.isCorrect ? (
                <div key={i} className="answer-compare-ok">
                  <Check size={14} />
                  <span>
                    {check.label ? `${check.label}: ` : ''}
                    <strong>{check.expected}</strong>
                  </span>
                </div>
              ) : (
                <AnswerComparison key={i} check={check} />
              ),
            )}
          </div>
        ) : (
          <div className="feedback-message">{feedback.message}</div>
        )}
      </div>
      {action}
    </div>
  );
};
