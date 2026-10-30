import React from 'react';

/** The "Ящик N" badge of a card, or "🎲 Рандом" when SRS is switched off (the box means nothing then). */
export const LeitnerBadge: React.FC<{ box: number; useSRS?: boolean }> = ({ box, useSRS = true }) =>
  useSRS ? (
    <span className={`leitner-badge box-${box}`}>Ящик {box}</span>
  ) : (
    <span className="leitner-badge leitner-badge--random">🎲 Рандом</span>
  );
