import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, Clock, Eye, Flame, Monitor, RefreshCw, Target, Users } from 'lucide-react';
import { getErrorMessage } from '../../api/request';
import { getStats } from '../../api/analytics';
import { ModeSwitch } from '../ModeSwitch';
import { ColumnChart, Heatmap } from './AnalyticsCharts';
import type { ChartItem } from './AnalyticsCharts';
import type { AnalyticsStats, NamedCount, StatsBucket } from '../../types';
import { ANALYTICS_TAB_LABELS } from '../../config/tabs';

const tabLabels = ANALYTICS_TAB_LABELS;

const deviceLabels: Record<string, string> = {
  mobile: '📱 Телефон',
  tablet: '📲 Планшет',
  desktop: '💻 Компьютер',
  bot: '🤖 Боты',
  unknown: 'Неизвестно',
};

type RangeKey = '7' | '30' | '90' | '365';
type Metric = 'visits' | 'visitors' | 'answers';

const METRIC_UNITS: Record<Metric, string> = { visits: 'визитов', visitors: 'посетителей', answers: 'ответов' };
const WEEKDAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const WEEKDAY_LONG = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

/** 2025-03-07 → 07.03 */
const shortDate = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
/** 2025-03-07 → 07.03.2025 */
const fullDate = (iso: string) => `${shortDate(iso)}.${iso.slice(0, 4)}`;

interface HBarListProps {
  items: { key: string; label: string; value: number; display: string }[];
}

/** Horizontal bars; the longest value fills the track. */
const HBarList: React.FC<HBarListProps> = ({ items }) => {
  if (items.length === 0) return <div className="muted-note">Пока нет данных</div>;
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="hbar-list">
      {items.map((item) => (
        <div key={item.key} className="hbar-row">
          <div className="hbar-label">{item.label}</div>
          <div className="hbar-track">
            <div className="hbar-fill" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
          <div className="hbar-count">{item.display}</div>
        </div>
      ))}
    </div>
  );
};

const countItems = (list: NamedCount[], labels: Record<string, string>) =>
  list.map((c) => ({ key: c.name, label: labels[c.name] ?? c.name, value: c.count, display: String(c.count) }));

export const AnalyticsTab: React.FC = () => {
  const [days, setDays] = useState<RangeKey>('30');
  const [metric, setMetric] = useState<Metric>('visits');
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setBusy(true);
    setError(null);
    try {
      const data = await getStats(Number(days));
      if (id === requestId.current) setStats(data);
    } catch (e) {
      console.error('Failed to load analytics stats:', e);
      if (id !== requestId.current) return;
      setStats(null);
      setError(getErrorMessage(e, 'Не удалось загрузить статистику'));
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!stats) {
    if (busy) return <div className="centered-message">Загрузка аналитики...</div>;
    return (
      <div className="state-card">
        <div className="state-text--flush">Не удалось загрузить статистику посетителей.</div>
        {error && <div className="error-note">{error}</div>}
        <div className="muted-note state-text">
          Убедитесь, что backend пересобран и задеплоен с обновлённым /api/analytics/stats.
        </div>
        <button className="btn-secondary" onClick={() => void load()}><RefreshCw size={14} /> Повторить попытку</button>
      </div>
    );
  }

  const { totals } = stats;
  const unit = METRIC_UNITS[metric];
  const pick = (b: StatsBucket) => b[metric];

  const dailyItems: ChartItem[] = stats.daily.map((d) => ({
    label: shortDate(d.date),
    value: pick(d),
    title: fullDate(d.date),
  }));
  const weeklyItems: ChartItem[] = stats.weekly.map((w) => ({
    label: shortDate(w.weekStart),
    value: pick(w),
    title: `Неделя с ${fullDate(w.weekStart)}`,
  }));
  const hourlyItems: ChartItem[] = stats.hourly.map((h) => ({
    label: String(h.hour),
    value: pick(h),
    title: `${h.hour}:00–${h.hour}:59`,
  }));
  const weekdayItems: ChartItem[] = stats.weekdays.map((w) => ({
    label: WEEKDAY_SHORT[w.weekday] ?? String(w.weekday),
    value: pick(w),
    title: WEEKDAY_LONG[w.weekday] ?? String(w.weekday),
  }));

  const trainerItems = stats.trainers.map((t) => ({
    key: t.trainer,
    label: tabLabels[t.trainer] ?? t.trainer,
    value: t.answers,
    display: t.accuracy === null ? '—' : `${t.accuracy}%`,
  }));

  return (
    <div className="analytics-tab">
      <div className="stats-header">
        <h3 className="stats-title"><Users size={20} /> Статистика посетителей</h3>
        <button className="btn-secondary" onClick={() => void load()} disabled={busy}>
          <RefreshCw size={14} /> {busy ? 'Обновление…' : 'Обновить'}
        </button>
      </div>

      <div className="analytics-controls">
        <div className="analytics-control">
          <span className="submode-label">Период:</span>
          <ModeSwitch<RangeKey>
            ariaLabel="Период"
            value={days}
            onChange={setDays}
            options={[
              { value: '7', label: '7 дней' },
              { value: '30', label: '30 дней' },
              { value: '90', label: '90 дней' },
              { value: '365', label: 'Год' },
            ]}
          />
        </div>
        <div className="analytics-control">
          <span className="submode-label">Показатель:</span>
          <ModeSwitch<Metric>
            ariaLabel="Показатель"
            value={metric}
            onChange={setMetric}
            options={[
              { value: 'visits', label: 'Визиты' },
              { value: 'visitors', label: 'Уникальные' },
              { value: 'answers', label: 'Ответы' },
            ]}
          />
        </div>
      </div>

      {stats.truncated && (
        <div className="panel panel--warning">
          Событий слишком много: сервер учёл только самые свежие, поэтому старые дни периода могут быть занижены.
        </div>
      )}

      <div className="stat-cards">
        <div className="card stat-card">
          <div className="stat-card-label">Визитов за период</div>
          <div className="stat-card-value">{totals.visits}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-card-label">Уникальных посетителей</div>
          <div className="stat-card-value stat-card-value--accent">{totals.uniqueVisitors}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-card-label">Сегодня (визитов / уник.)</div>
          <div className="stat-card-value stat-card-value--success">{totals.visitsToday} / {totals.uniqueToday}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-card-label">Ответов в тренажёрах</div>
          <div className="stat-card-value">{totals.answers}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-card-label">Точность ответов</div>
          <div className="stat-card-value stat-card-value--success">{totals.accuracy === null ? '—' : `${totals.accuracy}%`}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-card-label">Вернулись (2+ дня)</div>
          <div className="stat-card-value stat-card-value--accent">{totals.returningVisitors} · {totals.returningRate}%</div>
        </div>
        <div className="card stat-card">
          <div className="stat-card-label">Визитов в день (в среднем)</div>
          <div className="stat-card-value">{totals.avgVisitsPerDay}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-card-label">Активных дней</div>
          <div className="stat-card-value">{totals.activeDays} / {stats.days}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-card-label">Визитов за всё время</div>
          <div className="stat-card-value">{totals.allTimeVisits}</div>
        </div>
      </div>

      <div className="card panel-card">
        <h4 className="panel-card-title"><CalendarDays size={16} /> По дням</h4>
        <ColumnChart items={dailyItems} unit={unit} ariaLabel="График по дням" />
      </div>

      <div className="card panel-card">
        <h4 className="panel-card-title"><CalendarDays size={16} /> По неделям (с понедельника)</h4>
        <ColumnChart items={weeklyItems} unit={unit} ariaLabel="График по неделям" />
      </div>

      <div className="analytics-grid">
        <div className="card panel-card">
          <h4 className="panel-card-title"><Clock size={16} /> По часам суток</h4>
          <ColumnChart items={hourlyItems} unit={unit} ariaLabel="График по часам" labelEvery={3} />
          <div className="muted-note">Часовой пояс: {stats.timeZone}</div>
        </div>
        <div className="card panel-card">
          <h4 className="panel-card-title"><CalendarDays size={16} /> По дням недели</h4>
          <ColumnChart items={weekdayItems} unit={unit} ariaLabel="График по дням недели" labelEvery={1} />
        </div>
      </div>

      <div className="card panel-card">
        <h4 className="panel-card-title"><Flame size={16} /> Когда заходят: день недели × час (визиты)</h4>
        <Heatmap matrix={stats.heatmap} rowLabels={WEEKDAY_SHORT} unit="визитов" />
      </div>

      <div className="analytics-grid">
        <div className="card panel-card">
          <h4 className="panel-card-title"><Target size={16} /> Тренажёры: ответы и точность</h4>
          <HBarList items={trainerItems} />
          <div className="muted-note analytics-note">Длина полосы — число ответов, справа — доля верных.</div>
        </div>
        <div className="card panel-card">
          <h4 className="panel-card-title"><Eye size={16} /> Популярные разделы (переходы)</h4>
          <HBarList items={countItems(stats.tabs, tabLabels)} />
        </div>
        <div className="card panel-card">
          <h4 className="panel-card-title"><Monitor size={16} /> Устройства</h4>
          <HBarList items={countItems(stats.devices, deviceLabels)} />
        </div>
        <div className="card panel-card">
          <h4 className="panel-card-title"><Monitor size={16} /> Браузеры</h4>
          <HBarList items={countItems(stats.browsers, {})} />
        </div>
      </div>
    </div>
  );
};
