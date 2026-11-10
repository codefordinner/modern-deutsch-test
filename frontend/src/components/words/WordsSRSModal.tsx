import React from 'react';
import { Modal } from '../Modal';
import { SRSBoxStats } from '../srs/SRSBoxStats';
import { SRSDueControls, SRSPoolProgress, SRSResetButton, SRSToggle } from '../srs/SRSControls';
import type { Word, SRSRecord } from '../../types';

interface WordsSRSModalProps {
  words: Word[];
  srsState: Record<string, SRSRecord>;
  useSRS: boolean;
  /** Keys of the cards of the currently selected categories (see buildWordCards). */
  poolKeys: readonly string[];
  /** Human-readable description of the selection. */
  scope: string;
  onClose: () => void;
  onResetSRS: () => void;
  onToggleUseSRS: (val: boolean) => void;
}

export const WordsSRSModal: React.FC<WordsSRSModalProps> = ({
  srsState,
  useSRS,
  poolKeys,
  scope,
  onClose,
  onResetSRS,
  onToggleUseSRS,
}) => {
  return (
    <Modal title="Интервальное повторение (SRS Лейтнера)" size="md" onClose={onClose}>
      <div className="modal-body">
        <p className="srs-intro">
          Каждое направление (рус→нем / нем→рус) и каждая форма слова (база, множественное число, женский род)
          отслеживаются отдельно и распределяются по 5 ящикам. Сначала по вероятностям (указаны ниже) выбирается ящик, затем случайная карточка из него. Правильный ответ поднимает
          карточку не более чем на один ящик в день, ошибка возвращает в Ящик 1.
        </p>

        <SRSToggle
          checked={useSRS}
          onChange={onToggleUseSRS}
          onLabel="Включено: сложные слова повторяются чаще"
          offLabel="Отключено: чистый случайный выбор (рандом без ящиков)"
        />

        <SRSPoolProgress keys={poolKeys} srsState={srsState} scope={scope} />

        <SRSDueControls keys={poolKeys} srsState={srsState} useSRS={useSRS} />

        <SRSBoxStats keys={poolKeys} srsState={srsState} />

        <SRSResetButton confirmText="Сбросить весь прогресс Лейтнера?" onReset={onResetSRS} />
      </div>
    </Modal>
  );
};
