import React, { useMemo } from 'react';
import { Modal } from '../Modal';
import { SRSBoxStats } from '../srs/SRSBoxStats';
import { SRSResetButton, SRSToggle } from '../srs/SRSControls';
import { srsKeys } from '../../utils/srs';
import type { Word, SRSRecord, WordDirection, WordFormType } from '../../types';

interface WordsSRSModalProps {
  words: Word[];
  srsState: Record<string, SRSRecord>;
  useSRS: boolean;
  onClose: () => void;
  onResetSRS: () => void;
  onToggleUseSRS: (val: boolean) => void;
}

const DIRECTIONS: WordDirection[] = ['ru_to_de', 'de_to_ru'];

export const WordsSRSModal: React.FC<WordsSRSModalProps> = ({
  words,
  srsState,
  useSRS,
  onClose,
  onResetSRS,
  onToggleUseSRS,
}) => {
  // Each direction (ru→de / de→ru) and each applicable form (base/plural/
  // feminine) has its own box per word, so we count every such card.
  const keys = useMemo(
    () =>
      words.flatMap((w) => {
        const forms: WordFormType[] = ['base'];
        if (w.plural) forms.push('plural');
        if (w.feminine) forms.push('feminine');
        return DIRECTIONS.flatMap((direction) => forms.map((formType) => srsKeys.word(w.id, direction, formType)));
      }),
    [words]
  );

  return (
    <Modal title="Интервальное повторение (SRS Лейтнера)" size="md" onClose={onClose}>
      <div className="modal-body">
        <p className="srs-intro">
          Каждое направление (рус→нем / нем→рус) и каждая форма слова (база, множественное число, женский род)
          отслеживаются отдельно и распределяются по 5 ящикам. Правильный ответ переносит карточку в следующий ящик,
          ошибка возвращает в Ящик 1.
        </p>

        <SRSToggle
          checked={useSRS}
          onChange={onToggleUseSRS}
          onLabel="Включено: сложные слова повторяются чаще"
          offLabel="Отключено: чистый случайный выбор (рандом без ящиков)"
        />

        <SRSBoxStats keys={keys} srsState={srsState} />

        <SRSResetButton confirmText="Сбросить весь прогресс Лейтнера?" onReset={onResetSRS} />
      </div>
    </Modal>
  );
};
