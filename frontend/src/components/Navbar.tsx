import React from 'react';
import type { TrainerTab } from '../types';
import { tabHref } from '../hooks/useHashRoute';
import { Hash, BookOpen, Zap, Clock, ShieldCheck, Sun, Moon, BarChart3, Settings } from 'lucide-react';

interface NavbarProps {
  activeTab: TrainerTab;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenStats: () => void;
  showStats: boolean;
  onOpenSettings: () => void;
}

const tabs = [
  { id: 'numbers' as TrainerTab, label: 'Числа', icon: Hash },
  { id: 'words' as TrainerTab, label: 'Слова', icon: BookOpen },
  { id: 'verbs' as TrainerTab, label: 'Глаголы', icon: Zap },
  { id: 'time' as TrainerTab, label: 'Время', icon: Clock },
  { id: 'admin' as TrainerTab, label: 'Админка', icon: ShieldCheck },
];

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  isDark,
  onToggleTheme,
  onOpenStats,
  showStats,
  onOpenSettings,
}) => {
  const themeLabel = isDark ? 'Включить светлую тему' : 'Включить тёмную тему';

  return (
    <header className="app-header">
      <a className="sr-only" href="#main">Перейти к содержимому</a>
      <div className="header-inner">
        <a className="brand-area" href={tabHref('numbers')} aria-label="Deutsch Trainer — на главную">
          <div className="brand-flag" aria-hidden="true">
            <div className="flag-stripe-black"></div>
            <div className="flag-stripe-red"></div>
            <div className="flag-stripe-gold"></div>
          </div>
          <div>
            <h1 className="brand-title">Deutsch Trainer</h1>
            <div className="brand-sub">Умный тренажёр немецкого языка</div>
          </div>
        </a>

        <nav className="nav-tabs" aria-label="Разделы">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <a
                key={t.id}
                id={`tab-${t.id}`}
                className={`nav-tab-btn ${isActive ? 'active' : ''}`}
                href={tabHref(t.id)}
                aria-current={isActive ? 'page' : undefined}
                title={t.label}
              >
                <Icon size={16} aria-hidden="true" />
                <span>{t.label}</span>
              </a>
            );
          })}
        </nav>

        <div className="header-actions">
          {showStats && (
            <button
              id="open-stats-btn"
              className="icon-btn"
              onClick={onOpenStats}
              title="Статистика"
              aria-label="Статистика"
              type="button"
            >
              <BarChart3 size={18} />
            </button>
          )}
          <button
            id="open-settings-btn"
            className="icon-btn"
            onClick={onOpenSettings}
            title="Настройки"
            aria-label="Настройки"
            type="button"
          >
            <Settings size={18} />
          </button>
          <button
            id="theme-toggle-btn"
            className="icon-btn"
            onClick={onToggleTheme}
            title={themeLabel}
            aria-label={themeLabel}
            type="button"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>
    </header>
  );
};
