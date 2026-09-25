import React, { useState } from 'react';
import { Search, Volume2 } from 'lucide-react';
import { Modal } from '../Modal';
import type { Word } from '../../types';
import { speakGerman } from '../../utils/audio';

interface VerbsTableModalProps {
  verbs: Word[];
  onClose: () => void;
}

export const VerbsTableModal: React.FC<VerbsTableModalProps> = ({ verbs, onClose }) => {
  const [search, setSearch] = useState('');

  const filtered = verbs.filter((v) => {
    return (
      !search ||
      v.de.toLowerCase().includes(search.toLowerCase()) ||
      v.ru.toLowerCase().includes(search.toLowerCase()) ||
      v.praeteritum?.toLowerCase().includes(search.toLowerCase()) ||
      v.partizip2?.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <Modal title={`Таблица 3-х форм глаголов (${verbs.length})`} size="xl" onClose={onClose}>
      <div className="modal-toolbar">
        <div className="search-field search-field--lg">
          <Search size={16} className="search-field-icon" aria-hidden="true" />
          <input
            type="text"
            className="text-input"
            placeholder="Поиск глагола..."
            aria-label="Поиск глагола"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="modal-body modal-body--flush">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Infinitiv</th>
                <th>Präteritum</th>
                <th>Partizip II</th>
                <th>Hilfsverb</th>
                <th>Перевод</th>
                <th>Аудио</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr key={v.id}>
                  <td className="cell-bold">{v.de}</td>
                  <td className="cell-accent">{v.praeteritum || '—'}</td>
                  <td className="cell-success">{v.partizip2 || '—'}</td>
                  <td className="cell-italic">{v.hilfsverb || 'haben'}</td>
                  <td>{v.ru}</td>
                  <td>
                    <button
                      type="button"
                      className="icon-btn icon-btn--xs"
                      onClick={() => speakGerman(`${v.de}, ${v.praeteritum || ''}, ${v.partizip2 || ''}`)}
                      aria-label={`Озвучить: ${v.de}`}
                    >
                      <Volume2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
};
