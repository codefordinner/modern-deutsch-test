import React, { useState } from 'react';

export interface ChartItem {
  /** Short axis label. */
  label: string;
  value: number;
  /** Full description shown under the chart when the column is hovered / tapped. */
  title: string;
}

interface ColumnChartProps {
  items: ChartItem[];
  /** Unit of the value in the caption, e.g. "визитов". */
  unit: string;
  ariaLabel: string;
  /** Show every N-th axis label; by default about 12 labels fit. */
  labelEvery?: number;
}

/** A column chart with no dependencies: hover, focus or tap a column to read its exact value. */
export const ColumnChart: React.FC<ColumnChartProps> = ({ items, unit, ariaLabel, labelEvery }) => {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...items.map((i) => i.value));
  const total = items.reduce((sum, i) => sum + i.value, 0);
  const every = labelEvery ?? Math.max(1, Math.ceil(items.length / 12));
  const shown = active !== null ? items[active] : undefined;

  return (
    <div>
      <div className="achart" role="group" aria-label={ariaLabel} onMouseLeave={() => setActive(null)}>
        {items.map((item, i) => (
          <button
            key={i}
            type="button"
            className={`achart-col ${item.value === 0 ? 'is-zero' : ''} ${active === i ? 'is-active' : ''}`}
            aria-label={`${item.title}: ${item.value} ${unit}`}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onClick={() => setActive(i)}
          >
            <span className="achart-bar" style={{ height: `${(item.value / max) * 100}%` }} />
          </button>
        ))}
      </div>
      <div className="achart-axis" aria-hidden="true">
        {items.map((item, i) => (
          <span key={i} className="achart-tick">
            {i % every === 0 && <span>{item.label}</span>}
          </span>
        ))}
      </div>
      <div className="achart-caption" aria-live="polite">
        <span>{shown ? `${shown.title}: ${shown.value} ${unit}` : 'Наведите или нажмите на столбец'}</span>
        <span>Всего: {total}</span>
      </div>
    </div>
  );
};

interface HeatmapProps {
  /** matrix[row][hour] */
  matrix: number[][];
  rowLabels: string[];
  unit: string;
}

/** Weekday × hour grid: the darker the cell, the more activity. */
export const Heatmap: React.FC<HeatmapProps> = ({ matrix, rowLabels, unit }) => {
  const max = Math.max(1, ...matrix.flat());

  return (
    <div className="table-scroll">
      <div className="heatmap" role="img" aria-label="Активность по дням недели и часам">
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="heatmap-hour">
            {h % 3 === 0 ? h : ''}
          </span>
        ))}
        {matrix.map((row, r) => (
          <React.Fragment key={r}>
            <span className="heatmap-label">{rowLabels[r]}</span>
            {row.map((value, h) => (
              <span key={h} className="heatmap-cell" title={`${rowLabels[r]}, ${h}:00 — ${value} ${unit}`}>
                {value > 0 && <i style={{ opacity: 0.15 + 0.85 * (value / max) }} />}
              </span>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
