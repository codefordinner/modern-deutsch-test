import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer
      style={{
        marginTop: 'auto',
        padding: '24px 16px',
        borderTop: '1px solid var(--border-color)',
        textAlign: 'center',
        fontSize: '13px',
        color: 'var(--text-muted)',
        background: 'var(--bg-secondary)',
      }}
    >
      <div>Deutsch Trainer — Тренажёр немецкого языка с алгоритмом Лейтнера (SRS)</div>
      <div style={{ marginTop: 4, fontSize: '12px' }}>
        Немецкие числительные, интервальное запоминание слов, спряжение сильных и слабых глаголов, стрелочные часы
      </div>
    </footer>
  );
};
