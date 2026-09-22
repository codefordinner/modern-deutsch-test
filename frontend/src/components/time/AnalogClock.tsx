import React from 'react';

interface AnalogClockProps {
  hours: number;
  minutes: number;
}

export const AnalogClock: React.FC<AnalogClockProps> = ({ hours, minutes }) => {
  const hourAngle = (hours % 12) * 30 + (minutes / 60) * 30;
  const minuteAngle = minutes * 6;

  return (
    <div className="clock-container">
      <svg className="analog-clock-svg" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="92" fill="var(--bg-secondary)" stroke="var(--border-color)" strokeWidth="4" />
        <circle cx="100" cy="100" r="86" fill="var(--bg-primary)" stroke="none" />

        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => {
          const angle = (num * 30 * Math.PI) / 180;
          const x = 100 + 68 * Math.sin(angle);
          const y = 100 - 68 * Math.cos(angle);
          return (
            <text
              key={num}
              x={x}
              y={y + 5}
              textAnchor="middle"
              fill="var(--text-primary)"
              fontSize="14"
              fontWeight="700"
              fontFamily="var(--mono)"
            >
              {num}
            </text>
          );
        })}

        {[...Array(60)].map((_, i) => {
          if (i % 5 === 0) return null;
          const angle = (i * 6 * Math.PI) / 180;
          const x1 = 100 + 80 * Math.sin(angle);
          const y1 = 100 - 80 * Math.cos(angle);
          const x2 = 100 + 84 * Math.sin(angle);
          const y2 = 100 - 84 * Math.cos(angle);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--text-muted)" strokeWidth="1.5" opacity="0.6" />;
        })}

        {/* Hour Hand */}
        <line
          x1="100"
          y1="100"
          x2="100"
          y2="52"
          stroke="var(--accent-primary)"
          strokeWidth="6"
          strokeLinecap="round"
          transform={`rotate(${hourAngle} 100 100)`}
        />

        {/* Minute Hand */}
        <line
          x1="100"
          y1="100"
          x2="100"
          y2="28"
          stroke="var(--text-primary)"
          strokeWidth="3.5"
          strokeLinecap="round"
          transform={`rotate(${minuteAngle} 100 100)`}
        />

        {/* Center Cap */}
        <circle cx="100" cy="100" r="5" fill="var(--accent-primary)" />
      </svg>
    </div>
  );
};
