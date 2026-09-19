import React, { useState, useEffect } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';

interface AnalyticsTabProps {
  token: string | null;
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ token }) => {
  const [stats, setStats] = useState<any>(null);
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><BarChart3 size={20} /> Статистика сессий</h3>
        <button className="btn-secondary" onClick={fetchStats}><RefreshCw size={14} /> Обновить</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ margin: 0, padding: 18, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Всего ответов</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4 }}>{stats.totalAnswers}</div>
        </div>
        <div className="card" style={{ margin: 0, padding: 18, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Правильных ответов</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4, color: 'var(--success)' }}>{stats.correctAnswers}</div>
        </div>
        <div className="card" style={{ margin: 0, padding: 18, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Точность</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4, color: 'var(--accent-primary)' }}>{stats.overallAccuracy}%</div>
        </div>
      </div>

      <div className="card" style={{ margin: 0 }}>
        <h4 style={{ marginTop: 0, marginBottom: 16 }}>По тренажёрам</h4>
        <table className="data-table">
          <thead>
            <tr><th>Тренажёр</th><th>Всего попыток</th><th>Верно</th><th>Процент</th></tr>
          </thead>
          <tbody>
            {Object.entries(stats.byTrainer || {}).map(([key, val]: any) => {
              const acc = val.total > 0 ? Math.round((val.correct / val.total) * 100) : 0;
              return (
                <tr key={key}>
                  <td style={{ fontWeight: 600 }}>{key}</td>
                  <td>{val.total}</td>
                  <td style={{ color: 'var(--success)' }}>{val.correct}</td>
                  <td>{acc}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
