import { useCallback, useEffect, useRef, useState } from 'react';
import { Navbar } from './components/Navbar';
import { StatsPanel } from './components/StatsPanel';
import { GeneralSettingsModal } from './components/GeneralSettingsModal';
import { TrainerContent } from './components/routing/TrainerContent';
import { ToastHost } from './components/ToastHost';
import { trackEvent } from './api/analytics';
import { useHashRoute } from './hooks/useHashRoute';
import { useServiceWorkerUpdates } from './hooks/useServiceWorkerUpdates';
import { useScores } from './hooks/useScores';
import { useSrsWeightsSync } from './hooks/useSrsWeightsSync';
import { useSrsSync } from './hooks/useSrsSync';
import { hasSeenLearnerOnboarding, markLearnerOnboardingSeen, prepareLearnerSyncUser, setLearnerSyncUser, syncNow } from './utils/srsSync';
import { clearAccountTrainerSettings, hasAccountTrainerSettings } from './utils/trainerSettingsStore';
import { resetAccountStudyPrefs } from './utils/studyPrefs';
import type { ScoredTab } from './config/tabs';
import { getTabDefinition } from './config/tabs';
import { OnboardingModal } from './components/OnboardingModal';
import { ConfirmProvider } from './components/ConfirmProvider';
import { TelegramLogin } from './components/TelegramLogin';
import {
  getLearnerSession,
  getLearnerAuthConfig,
  loginWithMiniApp,
  logoutLearner,
} from './api/telegramAuth';
import { ApiError, getErrorMessage } from './api/request';
import type { LearnerSession } from './api/telegramAuth';

export function App() {
  useServiceWorkerUpdates();
  const activeTab = useHashRoute();
  const [learner, setLearner] = useState<LearnerSession['user'] | null>(null);
  const [authRequired, setAuthRequired] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [logoutError, setLogoutError] = useState('');
  const miniAppAttempted = useRef(false);
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const saved = localStorage.getItem('theme');
      return saved ? saved === 'dark' : true; // Default dark theme
    } catch {
      return true;
    }
  });
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const closeOnboarding = () => {
    markLearnerOnboardingSeen();
    setIsOnboardingOpen(false);
    void syncNow();
  };

  const handleLearnerAuthenticated = useCallback(async (user: LearnerSession['user']) => {
    prepareLearnerSyncUser(user.id);
    setLearnerSyncUser(user.id);
    // Hydrate account-owned trainer preferences before any trainer is mounted.
    await syncNow();
    if (!hasAccountTrainerSettings()) throw new Error('Не удалось загрузить настройки аккаунта.');
    setIsOnboardingOpen(!hasSeenLearnerOnboarding());
    setLearner(user);
    setAuthError('');
    setAuthLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    const webApp = window.Telegram?.WebApp;
    if (webApp?.initData) {
      webApp.ready?.();
      webApp.expand?.();
    }
    const authenticate = async () => {
      try {
        try {
          await getLearnerAuthConfig();
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) {
            // Fail closed: never allow trainers to run without an authenticated learner.
            if (active) {
              setAuthRequired(true);
              setAuthError('Сервер не поддерживает обязательный вход. Обновите приложение и сервер.');
            }
            return;
          }
          throw error;
        }
        if (active) setAuthRequired(true);
        try {
          const session = await getLearnerSession();
          if (active) await handleLearnerAuthenticated(session.user);
        } catch {
          if (!active) return;
          const initData = window.Telegram?.WebApp?.initData;
          if (initData && !miniAppAttempted.current) {
            miniAppAttempted.current = true;
            try {
              const session = await loginWithMiniApp(initData);
              if (active) await handleLearnerAuthenticated(session.user);
            } catch (error) {
              if (active) setAuthError(getErrorMessage(error, 'Не удалось войти через Telegram.'));
            }
          } else {
            setAuthError('');
          }
        }
      } catch (error) {
        if (active) {
          setAuthRequired(true);
          setAuthError(getErrorMessage(error, 'Не удалось проверить состояние входа.'));
        }
      } finally {
        if (active) setAuthLoading(false);
      }
    };
    void authenticate();
    return () => { active = false; };
  }, [handleLearnerAuthenticated]);

  const handleLearnerLogout = useCallback(async () => {
    setLogoutError('');
    try {
      await logoutLearner();
      clearAccountTrainerSettings(learner?.id);
      resetAccountStudyPrefs();
      setLearner(null);
    } catch (error) {
      setLogoutError(getErrorMessage(error, 'Не удалось завершить сеанс. Попробуйте ещё раз.'));
    }
  }, [learner]);

  const { scores, recordAnswer, resetScore } = useScores();
  const scoredTab: ScoredTab | null = getTabDefinition(activeTab).scored ? activeTab as ScoredTab : null;

  // Leitner box probabilities configured by the admin (defaults until loaded).
  useSrsWeightsSync();

  // Keeps SRS progress in step with the learner's other devices through their Telegram account.
  useSrsSync(learner?.id ?? null);

  // NOTE: the light theme in index.css is scoped to `html.light` (dark is
  // the default `:root`), so toggling a `dark` class here (as before) never
  // matched any selector and the switch silently did nothing. Toggle the
  // `light` class instead.
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.remove('light');
      try {
        localStorage.setItem('theme', 'dark');
      } catch {
        // Keep the theme usable when browser storage is unavailable.
      }
    } else {
      document.documentElement.classList.add('light');
      try {
        localStorage.setItem('theme', 'light');
      } catch {
        // Keep the theme usable when browser storage is unavailable.
      }
    }
  }, [isDark]);

  // Count visits only after Telegram authentication, so analytics can identify learners
  // consistently across devices without treating the login screen as a visit.
  const learnerId = learner?.id;
  useEffect(() => {
    if (learnerId) trackEvent('visit');
  }, [learnerId]);

  // One event per tab change — however it happened (a tab link, Back/Forward, a pasted link).
  const previousTab = useRef(activeTab);
  useEffect(() => {
    if (previousTab.current === activeTab) return;
    previousTab.current = activeTab;
    trackEvent('tab_switch', activeTab);
  }, [activeTab]);

  useEffect(() => {
    document.title = `${getTabDefinition(activeTab).pageTitle} — BlitzDeutsch`;
  }, [activeTab]);

  const handleAnswer = (isCorrect: boolean) => {
    if (!scoredTab) return;
    trackEvent('quiz_answer', scoredTab, isCorrect);
    recordAnswer(scoredTab, isCorrect);
  };

  // Learner accounts gate training only. The existing admin area keeps its
  // independent cookie-based authentication and can still be opened directly.
  if (activeTab !== 'admin' && authLoading) {
    return (
      <>
        <main className="telegram-login" id="main" aria-live="polite">Загружаем профиль ученика…</main>
        <ToastHost />
      </>
    );
  }
  if (activeTab !== 'admin' && authRequired && !learner) {
    return (
      <>
        <TelegramLogin onAuthenticated={handleLearnerAuthenticated} initialError={authError} />
        <ToastHost />
      </>
    );
  }

  return (
    <ConfirmProvider>
    <div className="app-shell">
      <Navbar
        activeTab={activeTab}
        isDark={isDark}
        onToggleTheme={() => setIsDark((p) => !p)}
        onOpenStats={() => setIsStatsOpen(true)}
        showStats={scoredTab !== null}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isLearnerSignedIn={Boolean(learner)}
        isAdmin={Boolean(learner?.isAdmin)}
        onLearnerLogout={handleLearnerLogout}
      />

       <main className="app-container" id="main">
         <TrainerContent activeTab={activeTab} onAnswer={handleAnswer} />
       </main>

      {isStatsOpen && scoredTab && (
        <StatsPanel
           score={scores[scoredTab]}
           scores={scores}
          onReset={() => resetScore(scoredTab)}
           trainerName={getTabDefinition(activeTab).title}
          onClose={() => setIsStatsOpen(false)}
        />
      )}

      {isSettingsOpen && <GeneralSettingsModal onClose={() => setIsSettingsOpen(false)} isLearnerSignedIn={Boolean(learner)} />}
      {isOnboardingOpen && <OnboardingModal onClose={closeOnboarding} />}
      {logoutError && <p className="telegram-login-error" role="alert">{logoutError}</p>}

      <ToastHost />
    </div>
    </ConfirmProvider>
  );
}

export default App;
