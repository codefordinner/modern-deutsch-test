import React, { useState, useEffect } from 'react';
import { Users, RefreshCw, Eye, CalendarDays } from 'lucide-react';

interface DayCount {
  date: string;
  count: number;
}

interface TabCount {
  tab: string;
  count: number;
}

interface StatsResponse {
  totalVisits: number;
  uniqueVisitors: number;
  visitsToday: number;
  last7Days: DayCount[];
  topTabs: TabCount[];
}

interface AnalyticsTabProps {
  token: string | null;
}

const tabLabels: Record<string, string> = {
  numbers: '🔢 Числительные',
  words: '📚 Словарь',
  verbs: '⚡ Глаголы',
  time: '⏰ Время',
  admin: '⚙️ Админка',
  other: 'Прочее',
};

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ token }) => {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/analytics/stats', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setStats(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Загрузка аналитики...</div>;
  if (!stats) return <div style={{ textAlign: 'center', padding: 40 }}>Данные отсутствуют</div>;

  const maxDayCount = Math.max(1, ...stats.last7Days.map((d) => d.count));
  const maxTabCount = Math.max(1, ...stats.topTabs.map((t) => t.count));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Users size={20} /> Статистика посетителей</h3>
        <button className="btn-secondary" onClick={fetchStats}><RefreshCw size={14} /> Обновить</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ margin: 0, padding: 18, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Всего визитов</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4 }}>{stats.totalVisits}</div>
        </div>
        <div className="card" style={{ margin: 0, padding: 18, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Уникальных посетителей</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4, color: 'var(--accent-primary)' }}>{stats.uniqueVisitors}</div>
        </div>
        <div className="card" style={{ margin: 0, padding: 18, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Визитов сегодня</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4, color: 'var(--success)' }}>{stats.visitsToday}</div>
        </div>
      </div>

      <div className="card" style={{ margin: '0 0 20px' }}>
        <h4 style={{ marginTop: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CalendarDays size={16} /> Визиты за 7 дней
        </h4>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 140 }}>
          {stats.last7Days.map((d) => (
            <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{d.count}</div>
              <div
                style={{
                  width: '100%',
                  maxWidth: 36,
                  height: `${Math.max(4, (d.count / maxDayCount) * 100)}px`,
                  background: 'var(--accent-primary)',
                  borderRadius: 4,
                }}
              />
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{d.date.slice(5)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ margin: 0 }}>
        <h4 style={{ marginTop: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Eye size={16} /> Популярные разделы
        </h4>
        {stats.topTabs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Пока нет данных о переходах</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {stats.topTabs.map((t) => (
              <div key={t.tab} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 140, fontSize: 13, fontWeight: 600 }}>{tabLabels[t.tab] || t.tab}</div>
                <div style={{ flex: 1, background: 'var(--bg-tertiary)', borderRadius: 6, overflow: 'hidden', height: 14 }}>
                  <div style={{ width: `${(t.count / maxTabCount) * 100}%`, background: 'var(--accent-primary)', height: '100%' }} />
                </div>
                <div style={{ width: 40, textAlign: 'right', fontSize: 13, fontWeight: 700 }}>{t.count}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
