import React, { useState, useEffect } from 'react';
import { Users, RefreshCw, Eye, CalendarDays } from 'lucide-react';
import { getErrorMessage, getStats } from '../../api/client';
import type { AnalyticsStats } from '../../types';

const tabLabels: Record<string, string> = {
  numbers: '🔢 Числительные',
  words: '📚 Словарь',
  verbs: '⚡ Глаголы',
  time: '⏰ Время',
  admin: '⚙️ Админка',
  other: 'Прочее',
};

export const AnalyticsTab: React.FC = () => {
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      setStats(await getStats());
    } catch (e) {
      console.error('Failed to load analytics stats:', e);
      setStats(null);
      setError(getErrorMessage(e, 'Не удалось загрузить статистику'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) return <div className="centered-message">Загрузка аналитики...</div>;
  if (!stats) {
    return (
      <div className="state-card">
        <div className="state-text--flush">Не удалось загрузить статистику посетителей.</div>
        {error && <div className="error-note">{error}</div>}
        <div className="muted-note state-text">
          Убедитесь, что backend пересобран и задеплоен с обновлённым /api/analytics/stats.
        </div>
        <button className="btn-secondary" onClick={fetchStats}><RefreshCw size={14} /> Повторить попытку</button>
      </div>
    );
  }

  const last7Days = stats.last7Days ?? [];
  const topTabs = stats.topTabs ?? [];
  const maxDayCount = Math.max(1, ...last7Days.map((d) => d.count));
  const maxTabCount = Math.max(1, ...topTabs.map((t) => t.count));

  return (
    <div>
      <div className="stats-header">
        <h3 className="stats-title"><Users size={20} /> Статистика посетителей</h3>
        <button className="btn-secondary" onClick={fetchStats}><RefreshCw size={14} /> Обновить</button>
      </div>

      <div className="stat-cards">
        <div className="card stat-card">
          <div className="stat-card-label">Всего визитов</div>
          <div className="stat-card-value">{stats.totalVisits ?? 0}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-card-label">Уникальных посетителей</div>
          <div className="stat-card-value stat-card-value--accent">{stats.uniqueVisitors ?? 0}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-card-label">Визитов сегодня</div>
          <div className="stat-card-value stat-card-value--success">{stats.visitsToday ?? 0}</div>
        </div>
      </div>

      <div className="card panel-card">
        <h4 className="panel-card-title"><CalendarDays size={16} /> Визиты за 7 дней</h4>
        <div className="bar-chart">
          {last7Days.map((d) => (
            <div key={d.date} className="bar-col">
              <div className="bar-value">{d.count}</div>
              <div className="bar" style={{ height: `${Math.max(4, (d.count / maxDayCount) * 100)}px` }} />
              <div className="bar-label">{d.date.slice(5)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card panel-card panel-card--last">
        <h4 className="panel-card-title"><Eye size={16} /> Популярные разделы</h4>
        {topTabs.length === 0 ? (
          <div className="muted-note">Пока нет данных о переходах</div>
        ) : (
          <div className="hbar-list">
            {topTabs.map((t) => (
              <div key={t.tab} className="hbar-row">
                <div className="hbar-label">{tabLabels[t.tab] || t.tab}</div>
                <div className="hbar-track">
                  <div className="hbar-fill" style={{ width: `${(t.count / maxTabCount) * 100}%` }} />
                </div>
                <div className="hbar-count">{t.count}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};