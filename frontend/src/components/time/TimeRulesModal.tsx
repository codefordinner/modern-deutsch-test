import React from 'react';
import { X } from 'lucide-react';

interface TimeRulesModalProps {
  onClose: () => void;
}

export const TimeRulesModal: React.FC<TimeRulesModalProps> = ({ onClose }) => {
  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: 620, maxHeight: '85vh' }}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>Правила времени в немецком языке (Uhrzeit)</h3>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ fontSize: 14, lineHeight: 1.6 }}>
          <h4 style={{ marginTop: 0, color: 'var(--accent-primary)' }}>Разговорный формат (Inoffiziell):</h4>
          <ul style={{ paddingLeft: 20 }}>
            <li><strong>Ровный час:</strong> Es ist drei Uhr (3:00)</li>
            <li><strong>Использование «kurz» (1–4 мин):</strong> kurz nach drei (3:02), kurz vor halb vier (3:28), kurz nach halb vier (3:32), kurz vor vier (3:58)</li>
            <li><strong>Четверть часа:</strong> Viertel nach drei (3:15) / Viertel vor vier (3:45)</li>
            <li><strong>Половина:</strong> halb vier = 3:30 (<em>половина следующего часа!</em>)</li>
            <li><strong>Минуты до/после половины:</strong> fünf vor halb vier (3:25), fünf nach halb vier (3:35)</li>
            <li><strong>nach</strong> (после) для минут 1–20, <strong>vor</strong> (до) для минут 40–59</li>
          </ul>

          <h4 style={{ color: 'var(--accent-primary)', marginTop: 18 }}>Официальный формат (Offiziell):</h4>
          <p style={{ margin: 0 }}>
            Использует 24-часовой формат в порядке <code>[Часы] Uhr [Минуты]</code>:
            <br />
            <code>14:25</code> = vierzehn Uhr fünfundzwanzig.
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>Понятно</button>
        </div>
      </div>
    </div>
  );
};
