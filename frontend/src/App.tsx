import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Scorebar } from './components/Scorebar';
import { NumbersTrainer } from './components/NumbersTrainer';
import { WordsTrainer } from './components/WordsTrainer';
import { VerbsTrainer } from './components/VerbsTrainer';
import { TimeTrainer } from './components/TimeTrainer';
import { AdminPanel } from './components/AdminPanel';
import { Footer } from './components/Footer';
import type { TrainerTab, ScoreState } from './types';
import { trackEvent } from './utils/analytics';

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

  const [scores, setScores] = useState<Record<string, ScoreState>>({
    numbers: { ...initialScore }, words: { ...initialScore }, verbs: { ...initialScore }, time: { ...initialScore },
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

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
      />

      <main className="app-container">
        {activeTab !== 'admin' && (
          <Scorebar
            score={scores[activeTab] || initialScore}
            onReset={() => setScores((p) => ({ ...p, [activeTab]: { ...initialScore } }))}
            trainerName={titles[activeTab]}
          />
        )}

        {activeTab === 'numbers' && <NumbersTrainer score={scores.numbers || initialScore} onAnswer={handleAnswer} />}
        {activeTab === 'words' && <WordsTrainer score={scores.words || initialScore} onAnswer={handleAnswer} />}
        {activeTab === 'verbs' && <VerbsTrainer score={scores.verbs || initialScore} onAnswer={handleAnswer} />}
        {activeTab === 'time' && <TimeTrainer score={scores.time || initialScore} onAnswer={handleAnswer} />}
        {activeTab === 'admin' && <AdminPanel />}
      </main>

      <Footer />
    </div>
  );
}

export default App;
