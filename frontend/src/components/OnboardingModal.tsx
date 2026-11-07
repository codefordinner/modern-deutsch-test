import React from 'react';
import { Modal } from './Modal';

interface OnboardingModalProps {
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onClose }) => (
  <Modal title="Добро пожаловать в Deutsch Trainer" size="sm" onClose={onClose}>
    <div className="modal-body modal-body--stack onboarding-content">
      <p>Тренируйте немецкие слова, артикли, глаголы, числа и время короткими ежедневными сессиями.</p>
      <ol>
        <li>Выберите вкладку и ответьте на карточку.</li>
        <li>Включённый SRS запоминает сложные карточки и возвращает их в нужный день.</li>
        <li>В «Настройках» можно задать дневную цель, панель умлаутов и резервную копию.</li>
      </ol>
      <p className="muted-note">Прогресс хранится в этом браузере. Для переноса используйте резервную копию или длинный ключ синхронизации.</p>
    </div>
    <div className="modal-footer">
      <button type="button" className="btn-primary" onClick={onClose}>Начать обучение</button>
    </div>
  </Modal>
);
