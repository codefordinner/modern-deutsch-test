import type { LucideIcon } from 'lucide-react';
import { BookOpen, Clock, Hash, Images, ShieldCheck, Type, Zap } from 'lucide-react';

export const APP_TABS = [
  { id: 'numbers', label: 'Числа', title: '🔢 Числительные', pageTitle: 'Числительные', icon: Hash, scored: true, srs: false },
  { id: 'words', label: 'Слова', title: '📚 Словарь', pageTitle: 'Словарь', icon: BookOpen, scored: true, srs: true },
  { id: 'articles', label: 'Артикли', title: '🔤 Артикли (der / die / das)', pageTitle: 'Артикли', icon: Type, scored: true, srs: true },
  { id: 'verbs', label: 'Глаголы', title: '⚡ Глаголы (Präsens, Präteritum, Partizip II)', pageTitle: 'Глаголы', icon: Zap, scored: true, srs: true },
  { id: 'time', label: 'Время', title: '⏰ Немецкое время (Uhrzeit)', pageTitle: 'Время', icon: Clock, scored: false, srs: false },
  { id: 'pictures', label: 'Картинки', title: '🖼️ Описание картинки', pageTitle: 'Описание картинки', icon: Images, scored: false, srs: false },
  { id: 'admin', label: 'Админка', title: '⚙️ Панель управления', pageTitle: 'Админка', icon: ShieldCheck, scored: false, srs: false },
] as const satisfies readonly {
  id: string;
  label: string;
  title: string;
  pageTitle: string;
  icon: LucideIcon;
  scored: boolean;
  srs: boolean;
}[];

export type AppTab = (typeof APP_TABS)[number]['id'];
export type TrainerTab = Exclude<AppTab, 'admin'>;
export type ScoredTab = Extract<(typeof APP_TABS)[number], { scored: true }>['id'];

export const TAB_IDS: readonly AppTab[] = APP_TABS.map((tab) => tab.id);
export const SCORED_TABS: readonly ScoredTab[] = APP_TABS.filter((tab) => tab.scored).map((tab) => tab.id as ScoredTab);

export function getTabDefinition(tab: AppTab) {
  return APP_TABS.find((definition) => definition.id === tab) ?? APP_TABS[0];
}

export const TAB_LABELS: Record<string, string> = Object.fromEntries(
  APP_TABS.map((tab) => [tab.id, tab.title])
);

// Kept in the registry so analytics labels cannot silently lag behind navigation.
export const ANALYTICS_TAB_LABELS: Record<string, string> = {
  ...TAB_LABELS,
  other: 'Прочее',
};
