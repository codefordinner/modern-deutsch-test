import React from 'react';
import { Modal } from '../Modal';

interface TimeRulesModalProps {
  onClose: () => void;
}

export const TimeRulesModal: React.FC<TimeRulesModalProps> = ({ onClose }) => {
  return (
    <Modal title="Правила времени в немецком языке (Uhrzeit)" size="lg" onClose={onClose}>
        <div className="modal-body rules-body">
          <h4 className="rules-heading">Разговорный формат (Inoffiziell):</h4>
          <ul className="rules-list">
            <li><strong>Ровный час:</strong> Es ist drei Uhr (3:00)</li>
            <li><strong>Использование «kurz» (1–4 мин):</strong> kurz nach drei (3:02), kurz vor halb vier (3:28), kurz nach halb vier (3:32), kurz vor vier (3:58)</li>
            <li><strong>Четверть часа:</strong> Viertel nach drei (3:15) / Viertel vor vier (3:45)</li>
            <li><strong>Половина:</strong> halb vier = 3:30 (<em>половина следующего часа!</em>)</li>
            <li><strong>Минуты до/после половины:</strong> fünf vor halb vier (3:25), fünf nach halb vier (3:35)</li>
            <li><strong>nach</strong> (после) для минут 1–20, <strong>vor</strong> (до) для минут 40–59</li>
          </ul>

          <h4 className="rules-heading rules-heading--spaced">Официальный формат (Offiziell):</h4>
          <p className="rules-note">
            Использует 24-часовой формат в порядке <code>[Часы] Uhr [Минуты]</code>:
            <br />
            <code>14:25</code> = vierzehn Uhr fünfundzwanzig.
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>Понятно</button>
        </div>
    </Modal>
  );
};
