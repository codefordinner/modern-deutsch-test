import React, { useMemo } from 'react';
import { Modal } from '../Modal';
import { SRSBoxStats } from '../srs/SRSBoxStats';
import { SRSDueControls, SRSResetButton, SRSToggle } from '../srs/SRSControls';
import { articleSrsKey } from '../../utils/articles';
import type { Word, SRSRecord } from '../../types';

interface ArticlesSRSModalProps {
  nouns: Word[];
  srsState: Record<string, SRSRecord>;
  useSRS: boolean;
  onClose: () => void;
  onResetSRS: () => void;
  onToggleUseSRS: (val: boolean) => void;
}

export const ArticlesSRSModal: React.FC<ArticlesSRSModalProps> = ({
  nouns,
  srsState,
  useSRS,
  onClose,
  onResetSRS,
  onToggleUseSRS,
}) => {
  // One card per noun: "which article does it take?"
  const keys = useMemo(() => nouns.map((w) => articleSrsKey(w.id)), [nouns]);

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

        <SRSDueControls keys={keys} srsState={srsState} useSRS={useSRS} />

        <SRSBoxStats keys={keys} srsState={srsState} />

        <SRSResetButton confirmText="Сбросить прогресс SRS по артиклям?" onReset={onResetSRS} />
      </div>
    </Modal>
  );
};
