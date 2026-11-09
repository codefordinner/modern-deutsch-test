import { useEffect, useRef, useState } from 'react';
import { Navbar } from './components/Navbar';
import { StatsPanel } from './components/StatsPanel';
import { GeneralSettingsModal } from './components/GeneralSettingsModal';
import { TrainerContent } from './components/routing/TrainerContent';
import { ToastHost } from './components/ToastHost';
import { UpdateBanner } from './components/UpdateBanner';
import { trackEvent } from './api/analytics';
import { useHashRoute } from './hooks/useHashRoute';
import { useScores } from './hooks/useScores';
import { useSrsWeightsSync } from './hooks/useSrsWeightsSync';
import { useSrsSync } from './hooks/useSrsSync';
import type { ScoredTab } from './config/tabs';
import { getTabDefinition } from './config/tabs';
import { OnboardingModal } from './components/OnboardingModal';

export function App() {
  const activeTab = useHashRoute();
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
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(() => {
    try { return localStorage.getItem('onboarding_seen') !== '1'; } catch { return true; }
  });
  const closeOnboarding = () => {
    try { localStorage.setItem('onboarding_seen', '1'); } catch { /* storage unavailable */ }
    setIsOnboardingOpen(false);
  };

  const { scores, recordAnswer, resetScore } = useScores();
  const scoredTab: ScoredTab | null = getTabDefinition(activeTab).scored ? activeTab as ScoredTab : null;

  // Leitner box probabilities configured by the admin (defaults until loaded).
  useSrsWeightsSync();

  // Keeps SRS progress in step with the learner's other devices when a sync key is set.
  useSrsSync();

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

  // Fired once per app load so the admin panel can show visitor stats
  // (total visits, unique visitors, visits over time) instead of word stats.
  useEffect(() => {
    trackEvent('visit');
  }, []);

  // One event per tab change — however it happened (a tab link, Back/Forward, a pasted link).
  const previousTab = useRef(activeTab);
  useEffect(() => {
    if (previousTab.current === activeTab) return;
    previousTab.current = activeTab;
    trackEvent('tab_switch', activeTab);
  }, [activeTab]);

  useEffect(() => {
    document.title = `${getTabDefinition(activeTab).pageTitle} — Sprachfunke`;
  }, [activeTab]);

  const handleAnswer = (isCorrect: boolean) => {
    if (!scoredTab) return;
    trackEvent('quiz_answer', scoredTab, isCorrect);
    recordAnswer(scoredTab, isCorrect);
  };

  return (
    <div className="app-shell">
      <Navbar
        activeTab={activeTab}
        isDark={isDark}
        onToggleTheme={() => setIsDark((p) => !p)}
        onOpenStats={() => setIsStatsOpen(true)}
        showStats={scoredTab !== null}
        onOpenSettings={() => setIsSettingsOpen(true)}
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

      {isSettingsOpen && <GeneralSettingsModal onClose={() => setIsSettingsOpen(false)} />}
      {isOnboardingOpen && <OnboardingModal onClose={closeOnboarding} />}

      <UpdateBanner />
      <ToastHost />
    </div>
  );
}

export default App;
