import { lazy, Suspense } from 'react';
import { ArticlesTrainer } from '../ArticlesTrainer';
import { NumbersTrainer } from '../NumbersTrainer';
import { TimeTrainer } from '../TimeTrainer';
import { VerbsTrainer } from '../VerbsTrainer';
import { WordsTrainer } from '../WordsTrainer';
import type { AppTab } from '../../config/tabs';
import { PictureDescriptionTrainer } from '../PictureDescriptionTrainer';

const AdminPanel = lazy(() => import('../AdminPanel').then((module) => ({ default: module.AdminPanel })));

interface TrainerContentProps {
  activeTab: AppTab;
  onAnswer: (isCorrect: boolean) => void;
}

/** Keeps the app shell independent from the growing list of trainer screens. */
export function TrainerContent({ activeTab, onAnswer }: TrainerContentProps) {
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
