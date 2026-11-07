import React, { useEffect, useState } from 'react';
import { AudioLines, Play, RefreshCw, Trash2 } from 'lucide-react';
import { clearAudioCache, fetchAudioSettings, getAudioCacheStats, getAudioRegenerationJob, previewAudioSettings, regenerateWordAudio, resetAudioSettings, saveAudioSettings } from '../../api/client';
import type { AudioCacheStats, AudioRegenerationJob, AudioSettings } from '../../api/client';
import { reportError, showToast } from '../../utils/toast';

const DEFAULTS: AudioSettings = { voice: 'de_DE-thorsten-medium', lengthScale: 1, noiseScale: 0.667, noiseWScale: 0.8, sentenceSilence: 0 };

export const AudioCacheTab: React.FC = () => {
  const [stats, setStats] = useState<AudioCacheStats | null>(null);
  const [settings, setSettings] = useState<AudioSettings>(DEFAULTS);
  const [saved, setSaved] = useState<AudioSettings>(DEFAULTS);
  const [sample, setSample] = useState('Guten Tag!');
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [regeneration, setRegeneration] = useState<AudioRegenerationJob | null>(null);

  const refresh = () => getAudioCacheStats().then(setStats).catch((e) => reportError(e, 'Не удалось загрузить состояние кэша'));
  useEffect(() => {
    void refresh();
    void getAudioRegenerationJob().then(setRegeneration).catch(() => {});
    fetchAudioSettings().then((result) => { setSettings(result.settings); setSaved(result.settings); }).catch((e) => reportError(e, 'Не удалось загрузить настройки озвучки'));
  }, []);

  useEffect(() => {
    if (regeneration?.status !== 'running') return;
    const timer = window.setInterval(() => {
      void getAudioRegenerationJob().then((job) => { setRegeneration(job); if (job?.status !== 'running') refresh(); }).catch(() => {});
    }, 2000);
    return () => window.clearInterval(timer);
  }, [regeneration?.status]);

  const changed = JSON.stringify(settings) !== JSON.stringify(saved);
  const update = (field: keyof AudioSettings, value: string | number) => setSettings((current) => ({ ...current, [field]: field === 'voice' ? value : Number(value) } as AudioSettings));
  const preview = async () => {
    if (!sample.trim()) return;
    setPlaying(true);
    try {
      const blob = await previewAudioSettings(sample, settings);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); setPlaying(false); };
      audio.onerror = () => { URL.revokeObjectURL(url); setPlaying(false); };
      await audio.play();
    } catch (e) { setPlaying(false); reportError(e, 'Не удалось прослушать тестовую озвучку'); }
  };
  const save = async () => {
    setBusy(true);
    try { const result = await saveAudioSettings(settings); setSettings(result.settings); setSaved(result.settings); showToast('Настройки озвучки сохранены', 'success'); refresh(); }
    catch (e) { reportError(e, 'Не удалось сохранить настройки озвучки'); } finally { setBusy(false); }
  };
  const reset = async () => {
    setBusy(true);
    try { const result = await resetAudioSettings(); setSettings(result.settings); setSaved(result.settings); showToast('Настройки по умолчанию восстановлены', 'success'); refresh(); }
    catch (e) { reportError(e, 'Не удалось сбросить настройки озвучки'); } finally { setBusy(false); }
  };
  const runCache = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true); try { await action(); showToast(message, 'success'); refresh(); } catch (e) { reportError(e, 'Операция с кэшем не выполнена'); } finally { setBusy(false); }
  };
  const startRegeneration = async () => {
    setBusy(true);
    try { setRegeneration(await regenerateWordAudio()); showToast('Генерация озвучки запущена', 'success'); }
    catch (e) { reportError(e, 'Не удалось запустить генерацию озвучки'); }
    finally { setBusy(false); }
  };
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms} мс`;
    const seconds = Math.round(ms / 100) / 10;
    if (seconds < 60) return `${seconds} с`;
    return `${Math.floor(seconds / 60)} мин ${Math.round(seconds % 60)} с`;
  };
  const progress = regeneration && regeneration.total > 0 ? Math.min(100, Math.round((regeneration.generated / regeneration.total) * 100)) : 0;

  return <div className="card">
    <h3 className="card-title"><AudioLines size={20} /> Озвучка и кэш</h3>
    <p className="card-note">Piper поддерживает модель и параметры просодии. Изменение настроек создаёт новый вариант кэша; старые WAV можно очистить.</p>
    <p>В кэше: <strong>{stats?.total ?? '—'}</strong> записей (слова: {stats?.words ?? '—'}, предложения: {stats?.sentences ?? '—'})</p>
    {regeneration && <div className="audio-regeneration-status" aria-live="polite">
      <div className="settings-group-title">Фоновая генерация слов</div>
      <div className="daily-goal-track" role="progressbar" aria-valuemin={0} aria-valuemax={regeneration.total} aria-valuenow={regeneration.generated}>
        <div className="daily-goal-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="audio-regeneration-meta">
        <span>{regeneration.status === 'running' ? `Готово: ${regeneration.generated} из ${regeneration.total}` : regeneration.status === 'completed' ? 'Генерация завершена' : 'Генерация завершилась с ошибкой'}</span>
        <strong>{progress}%</strong>
      </div>
      <div className="muted-note">Осталось: {regeneration.remaining}. Общее время: {formatDuration(regeneration.durationMs)}{regeneration.averageMs !== null && ` · в среднем ${formatDuration(regeneration.averageMs)} на слово`}</div>
      {regeneration.error && <div className="status-msg status-msg--error" role="alert">{regeneration.error}</div>}
    </div>}
    <div className="settings-divider">
      <label className="setting-toggle-title" htmlFor="audio-voice-select">Модель голоса Piper</label>
      <select id="audio-voice-select" className="text-input" value={settings.voice} onChange={(e) => update('voice', e.target.value)}>
        <option value="de_DE-thorsten-medium">Thorsten — обычное качество</option>
        <option value="de_DE-thorsten-high">Thorsten — высокое качество</option>
      </select>
      <label className="setting-toggle-title" htmlFor="audio-length">Скорость (length_scale): {settings.lengthScale.toFixed(2)}</label>
      <input id="audio-length" type="range" min="0.1" max="3" step="0.05" value={settings.lengthScale} onChange={(e) => update('lengthScale', e.target.value)} />
      <label className="setting-toggle-title" htmlFor="audio-noise">Вариативность интонации (noise_scale): {settings.noiseScale.toFixed(3)}</label>
      <input id="audio-noise" type="range" min="0" max="2" step="0.01" value={settings.noiseScale} onChange={(e) => update('noiseScale', e.target.value)} />
      <label className="setting-toggle-title" htmlFor="audio-noise-w">Вариативность длительности (noise_w_scale): {settings.noiseWScale.toFixed(3)}</label>
      <input id="audio-noise-w" type="range" min="0" max="2" step="0.01" value={settings.noiseWScale} onChange={(e) => update('noiseWScale', e.target.value)} />
      <label className="setting-toggle-title" htmlFor="audio-silence">Пауза между предложениями: {settings.sentenceSilence.toFixed(1)} с</label>
      <input id="audio-silence" type="range" min="0" max="10" step="0.1" value={settings.sentenceSilence} onChange={(e) => update('sentenceSilence', e.target.value)} />
      <span className="setting-toggle-desc">Параметр speaker появится только если будет подключена multi-speaker модель. Текущие Thorsten-модели одноголосые.</span>
      <div className="backup-actions"><button type="button" className="btn-secondary" disabled={busy || !changed} onClick={() => void save()}>Сохранить настройки</button><button type="button" className="btn-secondary" disabled={busy} onClick={() => void reset()}>По умолчанию</button></div>
    </div>
    <div className="settings-divider">
      <label className="setting-toggle-title" htmlFor="audio-preview-text">Проверить настройки</label>
      <div className="backup-actions"><input id="audio-preview-text" className="text-input w-full" value={sample} maxLength={10_000} onChange={(e) => setSample(e.target.value)} placeholder="Введите немецкое слово или фразу" /><button type="button" className="btn-primary" disabled={playing || !sample.trim()} onClick={() => void preview()}><Play size={14} /> {playing ? 'Воспроизведение…' : 'Прослушать'}</button></div>
    </div>
    <div className="import-actions"><button type="button" className="btn-secondary" disabled={busy || regeneration?.status === 'running'} onClick={() => { if (confirm('Удалить весь кэш озвучки у всех слов и фраз?')) void runCache(clearAudioCache, 'Кэш озвучки очищен'); }}><Trash2 size={16} /> Очистить весь кэш</button><button type="button" className="btn-primary" disabled={busy || regeneration?.status === 'running'} onClick={() => void startRegeneration()}><RefreshCw size={16} /> {regeneration?.status === 'running' ? 'Генерация выполняется…' : 'Заново сгенерировать слова'}</button></div>
  </div>;
};
