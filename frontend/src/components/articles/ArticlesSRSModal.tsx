import React from 'react';
import { Modal } from '../Modal';
import { SRSBoxStats } from '../srs/SRSBoxStats';
import { SRSDueControls, SRSPoolProgress, SRSResetButton, SRSToggle } from '../srs/SRSControls';
import type { Word, SRSRecord } from '../../types';

interface ArticlesSRSModalProps {
  nouns: Word[];
  srsState: Record<string, SRSRecord>;
  useSRS: boolean;
  /** Keys of the cards of the currently selected category. */
  poolKeys: readonly string[];
  /** Human-readable description of the selection. */
  scope: string;
  onClose: () => void;
  onResetSRS: () => void;
  onToggleUseSRS: (val: boolean) => void;
}

export const ArticlesSRSModal: React.FC<ArticlesSRSModalProps> = ({
  srsState,
  useSRS,
  poolKeys,
  scope,
  onClose,
  onResetSRS,
  onToggleUseSRS,
}) => {
  // One card per noun; the current pool already reflects the selected categories.

  return (
    <Modal title="SRS Лейтнера для артиклей" size="md" onClose={onClose}>
      <div className="modal-body">
        <p className="srs-intro">
          У каждого существительного одна карточка: «какой у него артикль?». Карточки делятся на 5 ящиков;
          ошибка возвращает карточку в Ящик 1, правильный ответ поднимает её не более чем на один ящик в день.
        </p>

        <SRSToggle
          checked={useSRS}
          onChange={onToggleUseSRS}
          onLabel="Включено: трудные слова повторяются чаще"
          offLabel="Отключено: чистый случайный выбор"
        />

        <SRSPoolProgress keys={poolKeys} srsState={srsState} scope={scope} />

        <SRSDueControls keys={poolKeys} srsState={srsState} useSRS={useSRS} />

        <SRSBoxStats keys={poolKeys} srsState={srsState} />

        <SRSResetButton confirmText="Сбросить прогресс SRS по артиклям?" onReset={onResetSRS} />
      </div>
    </Modal>
  );
};
