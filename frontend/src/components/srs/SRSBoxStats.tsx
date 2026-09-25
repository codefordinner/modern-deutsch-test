import React, { useMemo } from 'react';
import type { SRSRecord } from '../../types';

const BOX_LABELS: Record<number, string> = {
  1: 'Ящик 1 (Каждый день)',
  2: 'Ящик 2 (Каждые 3 дня)',
  3: 'Ящик 3 (Раз в неделю)',
  4: 'Ящик 4 (Раз в 2 недели)',
  5: 'Ящик 5 (Изучено навсегда)',
};
const BOXES = [1, 2, 3, 4, 5];

interface SRSBoxStatsProps {
  /** The Leitner keys of every card that can be asked (see `srsKeys` in utils/srs.ts). */
  keys: readonly string[];
  srsState: Record<string, SRSRecord>;
}

/** How many of the cards are in each of the five Leitner boxes; a card never answered yet counts as box 1. */
export const SRSBoxStats: React.FC<SRSBoxStatsProps> = ({ keys, srsState }) => {
  const counts = useMemo(() => {
    const result = [0, 0, 0, 0, 0, 0];
    for (const key of keys) {
      const box = Math.min(5, Math.max(1, srsState[key]?.box ?? 1));
      result[box] += 1;
    }
    return result;
  }, [keys, srsState]);

  return (
    <div className="srs-boxes">
      {BOXES.map((box) => (
        <div key={box} className="srs-box-row">
          <span className="srs-box-label">{BOX_LABELS[box]}</span>
          <span className={`leitner-badge box-${box}`}>{counts[box]} карточек</span>
        </div>
      ))}
    </div>
  );
};
