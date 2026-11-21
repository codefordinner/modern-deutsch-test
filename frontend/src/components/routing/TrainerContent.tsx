import { lazy, Suspense } from 'react';
import { ArticlesTrainer } from '../ArticlesTrainer';
import { NumbersTrainer } from '../NumbersTrainer';
import { TimeTrainer } from '../TimeTrainer';
import { VerbsTrainer } from '../VerbsTrainer';
import { WordsTrainer } from '../WordsTrainer';
import type { AppTab } from '../../config/tabs';
import { PictureDescriptionTrainer } from '../PictureDescriptionTrainer';
import { ProfilePage, ProgressPage, TrainerCatalog } from './HubPages';
import type { Scores } from '../../hooks/useScores';

const AdminPanel = lazy(() => import('../AdminPanel').then((module) => ({ default: module.AdminPanel })));

interface TrainerContentProps {
  activeTab: AppTab;
  onAnswer: (isCorrect: boolean) => void;
  scores: Scores;
  profileProps: {
    isAdmin: boolean;
    onOpenSettings: () => void;
    onOpenReminders: () => void;
    onToggleTheme: () => void;
    isDark: boolean;
    onLogout: () => void;
  };
}

/** Keeps the app shell independent from the growing list of trainer screens. */
export function TrainerContent({ activeTab, onAnswer, scores, profileProps }: TrainerContentProps) {
  if (activeTab === 'trainers') return <TrainerCatalog />;
  if (activeTab === 'progress') return <ProgressPage scores={scores} />;
  if (activeTab === 'profile') return <ProfilePage {...profileProps} />;
  if (activeTab === 'numbers') return <NumbersTrainer onAnswer={onAnswer} />;
  if (activeTab === 'words') return <WordsTrainer onAnswer={onAnswer} />;
  if (activeTab === 'articles') return <ArticlesTrainer onAnswer={onAnswer} />;
  if (activeTab === 'verbs') return <VerbsTrainer onAnswer={onAnswer} />;
  if (activeTab === 'time') return <TimeTrainer />;
  if (activeTab === 'pictures') return <PictureDescriptionTrainer />;
  return (
    <Suspense fallback={<div className="centered-message">Загрузка панели управления…</div>}>
      <AdminPanel />
    </Suspense>
  );
}
