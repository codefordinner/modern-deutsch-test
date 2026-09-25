import React from 'react';

interface DigitalDisplayProps {
  hours: number;
  minutes: number;
}

export const DigitalDisplay: React.FC<DigitalDisplayProps> = ({ hours, minutes }) => {
  const pad = (n: number) => n.toString().padStart(2, '0');

  return <div className="digital-display">{pad(hours)}:{pad(minutes)}</div>;
};
