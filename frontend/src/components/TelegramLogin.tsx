import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, LockKeyhole, Send, ShieldCheck } from 'lucide-react';
import { ApiError, getErrorMessage } from '../api/request';
import {
  completeTelegramChallenge,
  getTelegramChallengeStatus,
  requestTelegramChallenge,
  type TelegramChallenge,
} from '../api/telegramAuth';
import type { LearnerSession } from '../api/telegramAuth';

interface TelegramLoginProps {
  onAuthenticated: (user: LearnerSession['user']) => void | Promise<void>;
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
  const [authenticatedUser, setAuthenticatedUser] = useState<LearnerSession['user'] | null>(null);
  const started = useRef(false);
  const completing = useRef(false);

  const finishAuthentication = useCallback(async (user: LearnerSession['user']) => {
    setLoading(true);
    setError('');
    try {
      await onAuthenticated(user);
    } catch {
      setError('Вход выполнен, но не удалось загрузить настройки аккаунта. Проверьте соединение и повторите попытку.');
    } finally {
      setLoading(false);
    }
  }, [onAuthenticated]);

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
            if (active && session.authenticated) {
              setAuthenticatedUser(session.user);
              await finishAuthentication(session.user);
            }
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
  }, [challenge, finishAuthentication]);

  const formattedTime = `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, '0')}`;

  return (
    <main className="telegram-login" id="main">
      <section className="telegram-login-card" aria-labelledby="telegram-login-brand">
        <header className="telegram-login-brand">
          <img
            className="telegram-login-logo"
            src="/icons/blitzdeutsch-logo.svg"
            alt=""
            aria-hidden="true"
            width="64"
            height="64"
          />
          <div>
            <h1 id="telegram-login-brand">BlitzDeutsch</h1>
            <p className="telegram-login-tagline">Немецкий — шаг за шагом</p>
          </div>
        </header>

        <div className="telegram-login-welcome">
          <h2>Продолжить обучение</h2>
          <p>Войдите, чтобы заниматься и сохранять прогресс на всех устройствах.</p>
        </div>

        <section className="telegram-login-method" aria-labelledby="telegram-login-heading">
          <div className="telegram-login-method-heading">
            <span className="telegram-login-method-icon" aria-hidden="true"><Send size={19} /></span>
            <div>
              <h3 id="telegram-login-heading">Вход через Telegram</h3>
              <p>Без пароля и лишних шагов</p>
            </div>
          </div>

          {authenticatedUser ? (
            <>
              <p className="telegram-login-status is-confirmed" role="status">
                Вход выполнен. Осталось загрузить настройки аккаунта.
              </p>
              <button
                className="telegram-login-button"
                type="button"
                onClick={() => void finishAuthentication(authenticatedUser)}
                disabled={loading}
              >
                {loading ? 'Загружаем настройки…' : 'Повторить загрузку аккаунта'}
              </button>
            </>
          ) : challenge && remainingSeconds > 0 ? (
            <>
              <p className="telegram-login-instruction">
                Откройте бота <strong>@{challenge.botUsername}</strong> и отправьте ему этот код:
              </p>
              <output className="telegram-login-code" aria-label="Одноразовый код">{challenge.code}</output>
              <p className="telegram-login-expiry" aria-live="polite">Код действует ещё {formattedTime}</p>
              <a className="telegram-login-open-bot" href={challenge.botUrl} target="_blank" rel="noopener noreferrer">
                <Send size={17} aria-hidden="true" />
                <span>Открыть Telegram</span>
                <ArrowUpRight size={16} aria-hidden="true" />
              </a>
              <p className={`telegram-login-status${confirmed ? ' is-confirmed' : ''}`} role="status" aria-live="polite">
                <span className="telegram-login-status-dot" aria-hidden="true" />
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

        <p className="telegram-login-security">
          <ShieldCheck size={16} aria-hidden="true" />
          <span>Ваш аккаунт защищён подтверждением в Telegram</span>
        </p>
        <p className="telegram-login-privacy"><LockKeyhole size={13} aria-hidden="true" /> Мы никогда не попросим ваш пароль</p>
      </section>
    </main>
  );
}
