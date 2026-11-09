import React from 'react';
import { Modal } from './Modal';

interface OnboardingModalProps {
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onClose }) => (
  <Modal title="Добро пожаловать в Sprachfunke" size="sm" onClose={onClose}>
    <div className="modal-body modal-body--stack onboarding-content">
      <p><strong>Sprachfunke</strong> помогает уверенно закреплять немецкий через регулярную практику — без длинных уроков и лишней теории.</p>
      <p>Выберите нужный раздел: слова, артикли, глаголы, числа, время или описание картинок.</p>
      <h4>Как заниматься</h4>
      <ol>
        <li>Откройте раздел и отвечайте на карточки в удобном темпе.</li>
        <li>Отмечайте результат честно: так повторения будут действительно полезными.</li>
        <li>Включите SRS, чтобы сложные карточки возвращались именно тогда, когда пора их повторить.</li>
      </ol>
      <p className="muted-note">Ваш прогресс сохраняется в этом браузере. В разделе «Настройки» его можно экспортировать или перенести на другое устройство с помощью ключа синхронизации.</p>
    </div>
    <div className="modal-footer">
      <button type="button" className="btn-primary" onClick={onClose}>Начать обучение</button>
    </div>
  </Modal>
);
