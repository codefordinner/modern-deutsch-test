import React from 'react';
import type { TrainerTab } from '../types';
import { Hash, BookOpen, Zap, Clock, ShieldCheck, Sun, Moon, BarChart3, Settings } from 'lucide-react';

interface NavbarProps {
  activeTab: TrainerTab;
  onSelectTab: (tab: TrainerTab) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenStats: () => void;
  showStats: boolean;
  onOpenSettings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  isDark,
  onToggleTheme,
  onOpenStats,
  showStats,
  onOpenSettings,
}) => {
  const tabs = [
    { id: 'numbers' as TrainerTab, label: 'Числа', icon: Hash },
    { id: 'words' as TrainerTab, label: 'Слова', icon: BookOpen },
    { id: 'verbs' as TrainerTab, label: 'Глаголы', icon: Zap },
    { id: 'time' as TrainerTab, label: 'Время', icon: Clock },
    { id: 'admin' as TrainerTab, label: 'Админка', icon: ShieldCheck },
  ];

  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="brand-area" onClick={() => onSelectTab('numbers')}>
          <div className="brand-flag">
            <div className="flag-stripe-black"></div>
            <div className="flag-stripe-red"></div>
            <div className="flag-stripe-gold"></div>
          </div>
          <div>
            <h1 className="brand-title">Deutsch Trainer</h1>
            <div className="brand-sub">Умный тренажёр немецкого языка</div>
          </div>
        </div>

        <nav className="nav-tabs">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                id={`tab-${t.id}`}
                className={`nav-tab-btn ${isActive ? 'active' : ''}`}
                onClick={() => onSelectTab(t.id)}
                type="button"
                title={t.label}
              >
                <Icon size={16} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="header-actions">
          {showStats && (
            <button
              id="open-stats-btn"
              className="icon-btn"
              onClick={onOpenStats}
              title="Статистика сессии"
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
            type="button"
          >
            <Settings size={18} />
          </button>
          <button
            id="theme-toggle-btn"
            className="icon-btn"
            onClick={onToggleTheme}
            title={isDark ? 'Включить светлую тему' : 'Включить тёмную тему'}
            type="button"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>
    </header>
  );
};
