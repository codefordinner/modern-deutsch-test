import React from 'react';
import { X, RotateCcw } from 'lucide-react';
import type { Word, SRSState } from '../../types';
import { buildKnownPraesensCards, hasStammformen, hasPartizip2, hasPraeteritum } from '../../utils/verbConjugation';

interface VerbsSRSModalProps {
  verbs: Word[];
  srsState: Record<string, SRSState>;
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
  // Each verb quiz mode has its own box per verb, so we count every
  // (verb, mode) card rather than one bucket per verb. Präsens and
  // Форма → Инфинитив additionally split into one card per pronoun
  // (ich/du/er-sie-es/wir/ihr/sie-Sie), since mastering one form of a verb
  // shouldn't hide the others.
  //
  // The pools below mirror exactly what VerbsTrainer quizzes on (see
  // utils/verbConjugation.ts): not every verb has every form filled in, so
  // a verb missing Partizip II simply contributes no multiple_choice card
  // here, rather than an artificial "Box 1" entry for a question that could
  // never actually be asked.
  const praesensCards = buildKnownPraesensCards(verbs);
  const stammPool = verbs.filter(hasStammformen);
  const mcPool = verbs.filter(hasPartizip2);
  // "Форма → Инфинитив" also draws on Präteritum and Partizip II forms, each
  // with its own independent box (no pronoun involved for these two).
  const praeteritumReversePool = verbs.filter(hasPraeteritum);
  const partizip2ReversePool = mcPool;

  const boxCounts = [0, 0, 0, 0, 0, 0];
  const bump = (key: string) => {
    const item = srsState[key];
    const box = item ? item.box : 1;
    boxCounts[box] = (boxCounts[box] || 0) + 1;
  };

  praesensCards.forEach((c) => {
    bump(`${c.verb.id}:praesens:${c.pronoun}`);
    bump(`${c.verb.id}:form_to_infinitive:${c.pronoun}`);
  });
  stammPool.forEach((v) => bump(`${v.id}:stammformen`));
  mcPool.forEach((v) => bump(`${v.id}:multiple_choice`));
  praeteritumReversePool.forEach((v) => bump(`${v.id}:form_to_infinitive_praeteritum`));
  partizip2ReversePool.forEach((v) => bump(`${v.id}:form_to_infinitive_partizip2`));

  const totalCards =
    praesensCards.length * 2 + stammPool.length + mcPool.length + praeteritumReversePool.length + partizip2ReversePool.length;

  const boxLabels = [
    '',
    'Ящик 1 (Каждый день)',
    'Ящик 2 (Каждые 3 дня)',
    'Ящик 3 (Раз в неделю)',
    'Ящик 4 (Раз в 2 недели)',
    'Ящик 5 (Изучено навсегда)',
  ];

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>SRS Лейтнера для глаголов</h3>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 0 }}>
            Каждая форма глагола отслеживается отдельно и распределяется по 5 ящикам: Спряжение Präsens и обратное угадывание инфинитива по форме Präsens (отдельно для каждого лица: ich, du, er/sie/es, wir, ihr, sie/Sie), угадывание инфинитива по Präteritum, угадывание инфинитива по Partizip II, 3 формы (Stammformen) и тест.
            Например, если вы хорошо выучили форму "ihr", это никак не влияет на ящик формы "du" — у каждой формы свой независимый прогресс. То же самое верно и для направлений: прогресс по "Спряжению" не влияет на прогресс по "Форма → Инфинитив" того же глагола.
            При правильном ответе карточка переходит на следующий уровень, при ошибке возвращается в Ящик 1.
            Учитываются только формы, которые реально заполнены в базе — если у глагола не указан, например, Partizip II, он просто не попадает в соответствующий режим.
          </p>

          {totalCards === 0 && (
            <div style={{ padding: '10px 14px', marginBottom: 12, background: 'var(--warning-light)', border: '1px solid var(--warning)', borderRadius: 8, fontSize: 13 }}>
              Пока нет ни одной карточки: заполните формы глаголов (Präteritum, Partizip II, спряжение Präsens) в «Панели управления», чтобы SRS начал их отслеживать.
            </div>
          )}

          <div style={{ marginBottom: 16, padding: '12px 14px', background: 'var(--bg-tertiary)', borderRadius: 8 }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={useSRS}
                onChange={(e) => onToggleUseSRS(e.target.checked)}
                style={{ accentColor: 'var(--accent-primary)', marginTop: 2 }}
              />
              <div>
                <span style={{ fontWeight: 600, display: 'block' }}>Использовать алгоритм повторения SRS</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {useSRS ? 'Включено: глаголы повторяются по ящикам' : 'Отключено: чистый случайный выбор (рандом)'}
                </span>
              </div>
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '14px 0' }}>
            {[1, 2, 3, 4, 5].map((box) => (
              <div key={box} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{boxLabels[box]}</span>
                <span className={`leitner-badge box-${box}`}>{boxCounts[box]} карточек</span>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'right', marginTop: 10 }}>
            <button
              className="btn-secondary"
              style={{ color: 'var(--error)' }}
              onClick={() => { if (confirm('Сбросить весь прогресс SRS для глаголов?')) onResetSRS(); }}
            >
              <RotateCcw size={14} /> Сбросить прогресс SRS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
