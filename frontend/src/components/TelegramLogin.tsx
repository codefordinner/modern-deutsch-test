import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, getErrorMessage } from '../api/request';
import {
  completeTelegramChallenge,
  getTelegramChallengeStatus,
  requestTelegramChallenge,
  type TelegramChallenge,
} from '../api/telegramAuth';
import type { LearnerSession } from '../api/telegramAuth';

interface TelegramLoginProps {
  onAuthenticated: (user: LearnerSession['user']) => void;
  initialError?: string;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: { initData?: string; ready?: () => void; expand?: () => void } };
  }
}

export function TelegramLogin({ onAuthenticated, initialError }: TelegramLoginProps) {
  const [challenge, setChallenge] = useState<TelegramChallenge | null>(null);
  const [error, setError] = useState(initialError ?? '');
  const [loading, setLoading] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const started = useRef(false);
  const completing = useRef(false);

  const issueChallenge = useCallback(async () => {
    setLoading(true);
    setError(initialError ?? '');
    setConfirmed(false);
    completing.current = false;
    try {
      const result = await requestTelegramChallenge();
      setChallenge(result);
      setRemainingSeconds(Math.max(0, Math.ceil((Date.parse(result.expiresAt) - Date.now()) / 1000)));
    } catch (requestError) {
      setChallenge(null);
      setError(getErrorMessage(requestError, 'Не удалось получить код. Попробуйте ещё раз.'));
    } finally {
      setLoading(false);
    }
  }, [initialError]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void issueChallenge();
  }, [issueChallenge]);

  useEffect(() => {
    if (!challenge) return;
    const interval = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((Date.parse(challenge.expiresAt) - Date.now()) / 1000));
      setRemainingSeconds(remaining);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [challenge]);

  useEffect(() => {
    if (!challenge) return;
    let active = true;
    let timeoutId = 0;
    const poll = async () => {
      if (Date.parse(challenge.expiresAt) <= Date.now()) {
        setRemainingSeconds(0);
        return;
      }
      try {
        const status = await getTelegramChallengeStatus();
        if (!active) return;
        if (status.status === 'confirmed') {
          if (completing.current) return;
          completing.current = true;
          setConfirmed(true);
          try {
            const session = await completeTelegramChallenge();
            if (active && session.authenticated) onAuthenticated(session.user);
          } catch (completionError) {
            completing.current = false;
            if (!active) return;
            if (completionError instanceof ApiError && [401, 409, 410].includes(completionError.status)) {
              setRemainingSeconds(0);
              setConfirmed(false);
              setError('Срок входа истёк. Запросите новый код.');
              return;
            }
            throw completionError;
          }
          return;
        }
      } catch (pollError) {
        if (!active) return;
        if (pollError instanceof ApiError && [401, 410].includes(pollError.status)) {
          setRemainingSeconds(0);
          setError(getErrorMessage(pollError, 'Срок входа истёк. Запросите новый код.'));
          return;
        }
        if (!(pollError instanceof ApiError) || pollError.status !== 429) {
          setError(getErrorMessage(pollError, 'Не удалось проверить подтверждение. Повторяем попытку.'));
        }
      }
      if (active) timeoutId = window.setTimeout(() => void poll(), 2500);
    };
    timeoutId = window.setTimeout(() => void poll(), 1200);
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [challenge, onAuthenticated]);

  const formattedTime = `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, '0')}`;

  return (
    <main className="telegram-login" id="main">
      <section className="telegram-login-card" aria-labelledby="telegram-login-heading">
        <h1 id="telegram-login-heading">Вход через Telegram</h1>
        <p>Войдите через бота, чтобы продолжить занятия и синхронизировать прогресс.</p>

        {challenge && remainingSeconds > 0 ? (
          <>
            <p className="telegram-login-instruction">
              Нажмите, чтобы перейти к боту <strong>@{challenge.botUsername}</strong>, затем отправьте ему код:
            </p>
            <output className="telegram-login-code" aria-label="Одноразовый код">{challenge.code}</output>
            <p className="telegram-login-expiry" aria-live="polite">Код действует ещё {formattedTime}</p>
            <a className="telegram-login-open-bot" href={challenge.botUrl} target="_blank" rel="noopener noreferrer">
              Перейти к боту @{challenge.botUsername}
            </a>
            <p className="telegram-login-status" role="status" aria-live="polite">
              {confirmed ? 'Код подтверждён. Завершаем вход…' : 'Ожидаем подтверждение в Telegram…'}
            </p>
          </>
        ) : (
          <button className="telegram-login-button" type="button" onClick={() => void issueChallenge()} disabled={loading}>
            {loading ? 'Получаем код…' : challenge ? 'Получить новый код' : 'Получить код'}
          </button>
        )}

        {error && <p className="telegram-login-error" role="alert">{error}</p>}
      </section>
    </main>
  );
}
