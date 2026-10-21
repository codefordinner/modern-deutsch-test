import React, { useCallback, useEffect, useState } from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import { getDuplicates, mergeDuplicates } from '../../api/client';
import type { DuplicateGroup } from '../../api/client';
import { reportError, showToast } from '../../utils/toast';
import type { Word } from '../../types';

interface DuplicatesTabProps {
  /** Called after words were merged/deleted so the shared dictionary caches are refreshed. */
  onChanged: () => void;
}

const FIELDS: (keyof Word)[] = [
  'hint', 'partOfSpeech', 'plural', 'feminine', 'femininePlural', 'praeteritum', 'partizip2', 'hilfsverb',
  'praesensIch', 'praesensDu', 'praesensErSieEs', 'praesensWir', 'praesensIhr', 'praesensSie',
];

const filledCount = (word: Word) => FIELDS.filter((f) => Boolean(word[f])).length;

/** The most complete entry; on a tie the oldest one (the server lists them oldest first). */
function defaultKeeper(words: Word[]): string {
  return words.reduce((best, w) => (filledCount(w) > filledCount(best) ? w : best), words[0]).id;
}

export const DuplicatesTab: React.FC<DuplicatesTabProps> = ({ onChanged }) => {
  const [groups, setGroups] = useState<DuplicateGroup[] | null>(null);
  const [keep, setKeep] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { groups: found } = await getDuplicates();
      setGroups(found);
      setKeep(Object.fromEntries(found.map((g) => [g.key, defaultKeeper(g.words)])));
    } catch (e) {
      setGroups(null);
      reportError(e, 'Не удалось найти дубликаты');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const mergeGroup = async (group: DuplicateGroup): Promise<boolean> => {
    const keepId = keep[group.key] ?? defaultKeeper(group.words);
    const removeIds = group.words.filter((w) => w.id !== keepId).map((w) => w.id);
    try {
      await mergeDuplicates(keepId, removeIds);
      return true;
    } catch (e) {
      reportError(e, `Не удалось объединить «${group.words[0].de}»`);
      return false;
    }
  };

  const run = async (targets: DuplicateGroup[]) => {
    setBusy(true);
    let merged = 0;
    for (const group of targets) {
      if (await mergeGroup(group)) merged += 1;
      else break;
    }
    setBusy(false);
    if (merged > 0) {
      showToast(`Объединено групп: ${merged}`, 'success');
      onChanged();
      await load();
    }
  };

  if (loading) return <div className="centered-message">Поиск дубликатов...</div>;

  return (
    <div>
      <div className="stats-header">
        <h3 className="stats-title"><Copy size={20} /> Дубликаты{groups ? ` (${groups.length})` : ''}</h3>
        <div className="toolbar-actions">
          <button className="btn-secondary" onClick={() => void load()} disabled={busy}><RefreshCw size={14} /> Обновить</button>
          {groups && groups.length > 1 && (
            <button
              className="btn-primary"
              disabled={busy}
              onClick={() => {
                if (confirm(`Объединить все группы (${groups.length}), оставив отмеченные слова?`)) void run(groups);
              }}
            >
              Объединить все
            </button>
          )}
        </div>
      </div>

      <p className="card-note">
        Дубликат — слово с той же немецкой формой (регистр и пробелы не важны). Выберите, какую запись оставить:
        пустые поля в ней будут заполнены данными из удаляемых.
      </p>

      {groups === null ? null : groups.length === 0 ? (
        <div className="card state-card">
          <div className="state-icon">✅</div>
          <h3 className="state-title">Дубликатов нет</h3>
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.key} className="card dup-group">
            <div className="dup-group-head">
              <strong>{group.words[0].de}</strong>
              <button className="btn-secondary btn-xs" disabled={busy} onClick={() => void run([group])}>Объединить</button>
            </div>
            {group.words.map((w) => (
              <label key={w.id} className={`dup-row ${keep[group.key] === w.id ? 'is-keep' : ''}`}>
                <input
                  type="radio"
                  name={`keep-${group.key}`}
                  checked={keep[group.key] === w.id}
                  onChange={() => setKeep((prev) => ({ ...prev, [group.key]: w.id }))}
                />
                <span className="dup-row-main">
                  <span className="cell-strong">{w.de}</span> — {w.ru}
                  <span className="cell-secondary">
                    {' '}· {w.category?.icon} {w.category?.name} · заполнено полей: {filledCount(w)}
                  </span>
                </span>
                <span className="dup-row-tag">{keep[group.key] === w.id ? 'оставить' : 'удалить'}</span>
              </label>
            ))}
          </div>
        ))
      )}
    </div>
  );
};
