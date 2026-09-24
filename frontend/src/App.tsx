import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { StatsPanel } from './components/StatsPanel';
import { GeneralSettingsModal } from './components/GeneralSettingsModal';
import { NumbersTrainer } from './components/NumbersTrainer';
import { WordsTrainer } from './components/WordsTrainer';
import { VerbsTrainer } from './components/VerbsTrainer';
import { TimeTrainer } from './components/TimeTrainer';
import { AdminPanel } from './components/AdminPanel';
import type { TrainerTab, ScoreState } from './types';
import { trackEvent } from './api/client';
import { ToastHost } from './components/ToastHost';

const initialScore: ScoreState = { correct: 0, total: 0, streak: 0, bestStreak: 0 };

const titles: Record<TrainerTab, string> = {
  numbers: '🔢 Числительные',
  words: '📚 Словарь',
  verbs: '⚡ Глаголы (Präsens, Präteritum, Partizip II)',
  time: '⏰ Немецкое время (Uhrzeit)',
  admin: '⚙️ Панель управления',
};

export function App() {
  const [activeTab, setActiveTab] = useState<TrainerTab>('numbers');
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true; // Default dark theme
  });
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [scores, setScores] = useState<Record<string, ScoreState>>({
    numbers: { ...initialScore }, words: { ...initialScore }, verbs: { ...initialScore }, time: { ...initialScore },
  });

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

  const handleAnswer = (isCorrect: boolean) => {
    trackEvent('quiz_answer', activeTab, isCorrect);
    setScores((prev) => {
      const cur = prev[activeTab] || { ...initialScore };
      const nextStreak = isCorrect ? cur.streak + 1 : 0;
      return {
        ...prev,
        [activeTab]: {
          correct: isCorrect ? cur.correct + 1 : cur.correct,
          total: cur.total + 1,
          streak: nextStreak,
          bestStreak: Math.max(cur.bestStreak, nextStreak),
        },
      };
    });
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        activeTab={activeTab}
        onSelectTab={(tab) => { setActiveTab(tab); trackEvent('tab_switch', tab); }}
        isDark={isDark}
        onToggleTheme={() => setIsDark((p) => !p)}
        onOpenStats={() => setIsStatsOpen(true)}
        showStats={activeTab !== 'admin'}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main className="app-container">
        {activeTab === 'numbers' && <NumbersTrainer score={scores.numbers || initialScore} onAnswer={handleAnswer} />}
        {activeTab === 'words' && <WordsTrainer score={scores.words || initialScore} onAnswer={handleAnswer} />}
        {activeTab === 'verbs' && <VerbsTrainer score={scores.verbs || initialScore} onAnswer={handleAnswer} />}
        {activeTab === 'time' && <TimeTrainer score={scores.time || initialScore} onAnswer={handleAnswer} />}
        {activeTab === 'admin' && <AdminPanel />}
      </main>

      <StatsPanel
        score={scores[activeTab] || initialScore}
        onReset={() => setScores((p) => ({ ...p, [activeTab]: { ...initialScore } }))}
        trainerName={titles[activeTab]}
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
      />

      {isSettingsOpen && <GeneralSettingsModal onClose={() => setIsSettingsOpen(false)} />}

      <ToastHost />
    </div>
  );
}

export default App;
