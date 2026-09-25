import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Navbar } from './components/Navbar';
import { StatsPanel } from './components/StatsPanel';
import { GeneralSettingsModal } from './components/GeneralSettingsModal';
import { NumbersTrainer } from './components/NumbersTrainer';
import { WordsTrainer } from './components/WordsTrainer';
import { VerbsTrainer } from './components/VerbsTrainer';
import { TimeTrainer } from './components/TimeTrainer';
import { ToastHost } from './components/ToastHost';
import { trackEvent } from './api/client';
import { useHashRoute } from './hooks/useHashRoute';
import { useScores } from './hooks/useScores';
import type { ScoredTab } from './hooks/useScores';
import type { TrainerTab } from './types';

// The admin panel (tables, forms, analytics) is only for the site owner, so it
// is split into its own chunk that ordinary learners never download.
const AdminPanel = lazy(() => import('./components/AdminPanel').then((m) => ({ default: m.AdminPanel })));

const titles: Record<TrainerTab, string> = {
  numbers: '🔢 Числительные',
  words: '📚 Словарь',
  verbs: '⚡ Глаголы (Präsens, Präteritum, Partizip II)',
  time: '⏰ Немецкое время (Uhrzeit)',
  admin: '⚙️ Панель управления',
};

const pageTitles: Record<TrainerTab, string> = {
  numbers: 'Числительные',
  words: 'Словарь',
  verbs: 'Глаголы',
  time: 'Время',
  admin: 'Админка',
};

export function App() {
  const activeTab = useHashRoute();
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true; // Default dark theme
  });
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const { scores, recordAnswer, resetScore } = useScores();
  const scoredTab: ScoredTab | null = activeTab === 'admin' ? null : activeTab;

  // NOTE: the light theme in index.css is scoped to `html.light` (dark is
  // the default `:root`), so toggling a `dark` class here (as before) never
  // matched any selector and the switch silently did nothing. Toggle the
  // `light` class instead.
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.add('light');
      localStorage.setItem('theme', 'light');
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
    document.title = `${pageTitles[activeTab]} — Deutsch Trainer`;
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
        {activeTab === 'numbers' && <NumbersTrainer onAnswer={handleAnswer} />}
        {activeTab === 'words' && <WordsTrainer onAnswer={handleAnswer} />}
        {activeTab === 'verbs' && <VerbsTrainer onAnswer={handleAnswer} />}
        {activeTab === 'time' && <TimeTrainer />}
        {activeTab === 'admin' && (
          <Suspense fallback={<div className="centered-message">Загрузка панели управления…</div>}>
            <AdminPanel />
          </Suspense>
        )}
      </main>

      {isStatsOpen && scoredTab && (
        <StatsPanel
          score={scores[scoredTab]}
          onReset={() => resetScore(scoredTab)}
          trainerName={titles[activeTab]}
          onClose={() => setIsStatsOpen(false)}
        />
      )}

      {isSettingsOpen && <GeneralSettingsModal onClose={() => setIsSettingsOpen(false)} />}

      <ToastHost />
    </div>
  );
}

export default App;
