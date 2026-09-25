import React, { useMemo } from 'react';
import { Modal } from '../Modal';
import { SRSBoxStats } from '../srs/SRSBoxStats';
import { SRSResetButton, SRSToggle } from '../srs/SRSControls';
import { buildVerbCards } from '../../utils/verbCards';
import type { Word, SRSRecord } from '../../types';

interface VerbsSRSModalProps {
  verbs: Word[];
  srsState: Record<string, SRSRecord>;
  useSRS: boolean;
  onClose: () => void;
  onResetSRS: () => void;
  onToggleUseSRS: (val: boolean) => void;
}

export const VerbsSRSModal: React.FC<VerbsSRSModalProps> = ({
  verbs,
  srsState,
  useSRS,
  onClose,
  onResetSRS,
  onToggleUseSRS,
}) => {
  // The exact same cards the trainer quizzes on (see utils/verbCards.ts), so a
  // verb missing a form simply contributes no card here, rather than an
  // artificial "Box 1" entry for a question that could never actually be asked.
  const keys = useMemo(() => buildVerbCards(verbs).map((card) => card.key), [verbs]);

  return (
    <Modal title="SRS Лейтнера для глаголов" size="md" onClose={onClose}>
      <div className="modal-body">
        <p className="srs-intro">
          Каждая форма глагола отслеживается отдельно и распределяется по 5 ящикам: Спряжение Präsens и обратное угадывание инфинитива по форме Präsens (отдельно для каждого лица: ich, du, er/sie/es, wir, ihr, sie/Sie), угадывание инфинитива по Präteritum, угадывание инфинитива по Partizip II, 3 формы (Stammformen) и тест.
          Например, если вы хорошо выучили форму "ihr", это никак не влияет на ящик формы "du" — у каждой формы свой независимый прогресс. То же самое верно и для направлений: прогресс по "Спряжению" не влияет на прогресс по "Форма → Инфинитив" того же глагола.
          При правильном ответе карточка переходит на следующий уровень, при ошибке возвращается в Ящик 1.
          Учитываются только формы, которые реально заполнены в базе — если у глагола не указан, например, Partizip II, он просто не попадает в соответствующий режим.
        </p>

        {keys.length === 0 && (
          <div className="panel panel--warning">
            Пока нет ни одной карточки: заполните формы глаголов (Präteritum, Partizip II, спряжение Präsens) в «Панели управления», чтобы SRS начал их отслеживать.
          </div>
        )}

        <SRSToggle
          checked={useSRS}
          onChange={onToggleUseSRS}
          onLabel="Включено: глаголы повторяются по ящикам"
          offLabel="Отключено: чистый случайный выбор (рандом)"
        />

        <SRSBoxStats keys={keys} srsState={srsState} />

        <SRSResetButton confirmText="Сбросить весь прогресс SRS для глаголов?" onReset={onResetSRS} />
      </div>
    </Modal>
  );
};
