import React, { useState } from 'react';
import { X, Search, Volume2 } from 'lucide-react';
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
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: 740, height: '80vh' }}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>Таблица 3-х форм глаголов ({verbs.length})</h3>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: 12, color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="text-input"
              style={{ width: '100%', paddingLeft: 34, fontSize: 13 }}
              placeholder="Поиск глагола..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="modal-body" style={{ padding: 0 }}>
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
                  <td style={{ fontWeight: 700 }}>{v.de}</td>
                  <td style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{v.praeteritum || '—'}</td>
                  <td style={{ color: 'var(--success)', fontWeight: 600 }}>{v.partizip2 || '—'}</td>
                  <td style={{ fontStyle: 'italic' }}>{v.hilfsverb || 'haben'}</td>
                  <td>{v.ru}</td>
                  <td>
                    <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => speakGerman(`${v.de}, ${v.praeteritum || ''}, ${v.partizip2 || ''}`)}>
                      <Volume2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
