import React from 'react';
import { APP_TABS } from '../config/tabs';
import type { AppTab } from '../config/tabs';
import { getTabDefinition } from '../config/tabs';
import { tabHref } from '../hooks/useHashRoute';
import { useDailyCount, useStudyPrefs } from '../utils/studyPrefs';

interface NavbarProps {
  activeTab: AppTab;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
}) => {
  const [{ dailyGoal }] = useStudyPrefs();
  const answeredToday = useDailyCount();
  const visibleTabs = APP_TABS.filter((tab) => tab.surface === 'primary');
  const activePrimary = getTabDefinition(activeTab).surface === 'trainer'
    ? 'trainers'
    : activeTab === 'admin' ? 'profile' : activeTab;

  return (
    <>
      <header className="app-header">
        <a className="sr-only" href="#main">Перейти к содержимому</a>
        <div className="header-inner">
          <a className="brand-area" href={tabHref('trainers')} aria-label="BlitzDeutsch — на главную">
            <img className="brand-logo" src="/icons/blitzdeutsch-logo.svg" alt="" aria-hidden="true" />
            <div className="brand-text">
              <h1 className="brand-title">BlitzDeutsch</h1>
              <div className="brand-sub">Умный тренажёр немецкого языка</div>
            </div>
          </a>

          {/* Wide screens: tabs in the header. Phones: the same tabs live in the bottom bar below. */}
          <nav className="nav-tabs" aria-label="Разделы">
            {visibleTabs.map((t) => {
              const Icon = t.icon;
              const isActive = activePrimary === t.id;
              return (
                <a
                  key={t.id}
                  id={`tab-${t.id}`}
                  className={`nav-tab-btn ${isActive ? 'active' : ''}`}
                  href={tabHref(t.id)}
                  aria-current={isActive ? 'page' : undefined}
                  title={t.label}
                  aria-label={t.label}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span>{t.label}</span>
                </a>
              );
            })}
          </nav>

          <div className="header-actions">
            {activeTab !== 'profile' && dailyGoal > 0 && (
              <span
                className={`daily-chip ${answeredToday >= dailyGoal ? 'is-done' : ''}`}
                title={`Цель на сегодня: ${answeredToday} из ${dailyGoal} ответов`}
              >
                🎯 {answeredToday}/{dailyGoal}
              </span>
            )}
          </div>
        </div>
      </header>

      <nav className="bottom-nav" aria-label="Разделы" style={{ '--bottom-nav-count': visibleTabs.length } as React.CSSProperties}>
        {visibleTabs.map((t) => {
          const Icon = t.icon;
          const isActive = activePrimary === t.id;
          return (
            <a
              key={t.id}
              id={`bottom-tab-${t.id}`}
              className={`bottom-nav-item ${isActive ? 'active' : ''}`}
              href={tabHref(t.id)}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={20} aria-hidden="true" />
              <span>{t.label}</span>
            </a>
          );
        })}
      </nav>
    </>
  );
};
