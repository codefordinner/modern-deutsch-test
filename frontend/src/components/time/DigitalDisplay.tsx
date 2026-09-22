import React from 'react';

interface DigitalDisplayProps {
  hours: number;
  minutes: number;
}

export const DigitalDisplay: React.FC<DigitalDisplayProps> = ({ hours, minutes }) => {
  const pad = (n: number) => n.toString().padStart(2, '0');

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px 28px',
        borderRadius: 12,
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border-color)',
        fontFamily: 'var(--mono)',
        fontSize: 36,
        fontWeight: 800,
        letterSpacing: 2,
        color: 'var(--text-primary)',
        margin: '12px 0',
      }}
    >
      {pad(hours)}:{pad(minutes)}
    </div>
  );
};
