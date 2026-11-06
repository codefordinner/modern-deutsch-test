import React, { useEffect, useState } from 'react';
import { AudioLines, RefreshCw, Trash2 } from 'lucide-react';
import { clearAudioCache, getAudioCacheStats, regenerateWordAudio } from '../../api/client';
import type { AudioCacheStats } from '../../api/client';
import { reportError, showToast } from '../../utils/toast';

export const AudioCacheTab: React.FC = () => {
  const [stats, setStats] = useState<AudioCacheStats | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => getAudioCacheStats().then(setStats).catch((e) => reportError(e, 'Не удалось загрузить состояние кэша'));
  useEffect(() => { void refresh(); }, []);
  const run = async (action: () => Promise<void>, success: string) => {
    setBusy(true);
    try { await action(); showToast(success, 'success'); refresh(); } catch (e) { reportError(e, 'Операция с кэшем не выполнена'); } finally { setBusy(false); }
  };
  return <div className="card">
    <h3 className="card-title"><AudioLines size={20} /> Озвучка и кэш</h3>
    <p className="card-note">Используется голос Piper. Отсутствующие слова генерируются автоматически при первом прослушивании. Кэш также подготовлен для целых предложений.</p>
    <p>В кэше: <strong>{stats?.total ?? '—'}</strong> записей (слова: {stats?.words ?? '—'}, предложения: {stats?.sentences ?? '—'})</p>
    <div className="import-actions">
      <button type="button" className="btn-secondary" disabled={busy} onClick={() => { if (confirm('Удалить весь кэш озвучки у всех слов и фраз?')) void run(async () => { await clearAudioCache(); }, 'Кэш озвучки очищен'); }}><Trash2 size={16} /> Очистить весь кэш</button>
      <button type="button" className="btn-primary" disabled={busy} onClick={() => void run(async () => { const result = await regenerateWordAudio(); showToast(`Сгенерировано слов: ${result.generated}`, 'success'); }, 'Озвучка слов обновлена')}><RefreshCw size={16} /> {busy ? 'Подождите…' : 'Заново сгенерировать слова'}</button>
    </div>
  </div>;
};
