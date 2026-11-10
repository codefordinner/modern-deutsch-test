import { useEffect, useState } from 'react';
import { Bot, CheckCircle, RefreshCw, RotateCcw, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { checkAISettings, clearAIErrorLogs, fetchAIErrorLogs, fetchAIModels, fetchAISettings, resetAIPrompt, saveAISettings, type AIErrorLog, type AIModel, type AISettingsResponse } from '../../api/settings';
import { reportError, showToast } from '../../utils/toast';

const PICTURE_PROFILE = 'pictureDescription';
const PICTURE_FORMAT_PROFILE = 'pictureAnswerFormat';
const CHECK_PROFILE = 'pictureAnswerCheck';
const WORD_FILL_PROFILE = 'wordFill';
const AI_OPERATION_LABELS: Record<string, string> = {
  models: 'Список моделей',
  'settings-check': 'Проверка настроек',
  'picture-description': 'Описание картинки',
  'picture-format': 'Форматирование диктовки',
  'picture-check': 'Проверка ответа',
  'word-fill': 'Заполнение слов',
  'prompt-test': 'Тест промпта',
};

interface ProfileEditors {
  model: string;
  prompt: string;
  severity: number;
}

export function AISettingsTab() {
  const [settings, setSettings] = useState<AISettingsResponse | null>(null);
  const [models, setModels] = useState<AIModel[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<AIErrorLog[]>([]);
  const [logsBusy, setLogsBusy] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, ProfileEditors>>({
    [PICTURE_PROFILE]: { model: '', prompt: '', severity: 3 },
    [PICTURE_FORMAT_PROFILE]: { model: '', prompt: '', severity: 3 },
    [CHECK_PROFILE]: { model: '', prompt: '', severity: 3 },
    [WORD_FILL_PROFILE]: { model: '', prompt: '', severity: 3 },
  });

  const setProfile = (id: string, patch: Partial<ProfileEditors>) =>
    setProfiles((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const load = async () => {
    try {
      const result = await fetchAISettings();
      setSettings(result);
      const next: Record<string, ProfileEditors> = {};
      for (const id of [PICTURE_PROFILE, PICTURE_FORMAT_PROFILE, CHECK_PROFILE, WORD_FILL_PROFILE]) {
        next[id] = {
          model: result.profiles[id]?.model ?? '',
          prompt: result.profiles[id]?.prompt ?? '',
          severity: result.profiles[id]?.severity ?? 3,
        };
      }
      setProfiles(next);
      if (result.hasApiKey) { try { setModels((await fetchAIModels()).models); } catch { /* catalog is optional on load */ } }
    } catch (error) { reportError(error, 'Не удалось загрузить настройки ИИ'); }
  };
  useEffect(() => { void load(); }, []);

  const loadLogs = async () => {
    setLogsBusy(true);
    try { setLogs((await fetchAIErrorLogs(100)).logs); }
    catch (error) { reportError(error, 'Не удалось загрузить журнал ошибок ИИ'); }
    finally { setLogsBusy(false); }
  };
  useEffect(() => { void loadLogs(); }, []);

  const save = async () => {
    setBusy(true);
    try {
      // Save the API key once (with the first profile), then each profile separately.
      let last: AISettingsResponse | null = null;
      for (const [id, editor] of Object.entries(profiles)) {
        const hasSeverity = id === CHECK_PROFILE;
        last = await saveAISettings(
          id,
          editor.model,
          last ? undefined : apiKey,
          editor.prompt,
          hasSeverity ? editor.severity : undefined
        );
      }
      setApiKey('');
      setSettings(last);
      showToast('Настройки ИИ сохранены', 'success');
    } catch (error) { reportError(error, 'Не удалось сохранить настройки ИИ'); }
    finally { setBusy(false); }
  };

  const resetPrompt = async (profileId: string, label: string) => {
    if (!confirm(`Сбросить промпт «${label}» к исходному тексту?`)) return;
    setBusy(true);
    try {
      const result = await resetAIPrompt(profileId);
      setSettings(result);
      setProfile(profileId, { prompt: result.profiles[profileId]?.prompt ?? '' });
      showToast(`Промпт «${label}» сброшен`, 'success');
    } catch (error) { reportError(error, 'Не удалось сбросить промпт'); }
    finally { setBusy(false); }
  };

  const check = async () => {
    setBusy(true);
    try {
      const result = await checkAISettings();
      setModels(result.models);
      showToast(result.message, result.ok ? 'success' : 'error');
    } catch (error) { reportError(error, 'Не удалось проверить настройки ИИ'); }
    finally { setBusy(false); }
  };

  const clearLogs = async () => {
    if (!confirm('Очистить журнал ошибок ИИ?')) return;
    setLogsBusy(true);
    try { await clearAIErrorLogs(); setLogs([]); showToast('Журнал ошибок ИИ очищен', 'success'); }
    catch (error) { reportError(error, 'Не удалось очистить журнал ошибок ИИ'); }
    finally { setLogsBusy(false); }
  };

  const profileBlock = (id: string, title: string, label: string, showSeverity: boolean) => (
    <div className="ai-profile-block">
      <h4 className="ai-profile-title">{title}</h4>
      <label className="setting-toggle-title" htmlFor={`ai-model-${id}`}>Модель для этого профиля</label>
      <select id={`ai-model-${id}`} className="text-input" value={profiles[id].model} onChange={(event) => setProfile(id, { model: event.target.value })} disabled={!models.length}>
        <option value="">{models.length ? 'Выберите модель' : 'Сначала проверьте ключ'}</option>
        {models.map((item) => <option key={item.name} value={item.name}>{item.displayName} ({item.name})</option>)}
      </select>
      <div className="ai-prompt-label">
        <label className="setting-toggle-title" htmlFor={`ai-prompt-${id}`}>{label}</label>
        <button type="button" className="btn-secondary ai-reset-prompt" disabled={busy} onClick={() => void resetPrompt(id, label)}><RotateCcw size={14} /> Сбросить промпт</button>
      </div>
      <textarea id={`ai-prompt-${id}`} className="text-input ai-prompt-input" value={profiles[id].prompt} maxLength={10000} rows={9} onChange={(event) => setProfile(id, { prompt: event.target.value })} placeholder="Инструкция для Gemini" />
      {showSeverity && (
        <label className="setting-toggle-title" htmlFor="ai-severity">Жёсткость проверки: {profiles[id].severity} из 5</label>
      )}
      {showSeverity && <input id="ai-severity" type="range" min="1" max="5" step="1" value={profiles[id].severity} onChange={(event) => setProfile(id, { severity: Number(event.target.value) })} />}
    </div>
  );

  return <div className="card ai-settings-card">
    <h3 className="card-title"><Bot size={20} /> Модуль ИИ</h3>
    <p className="card-note">Провайдер — Google Gemini. Для каждого профиля можно выбрать свою модель и инструкцию. Новые профили можно добавить без изменения AI API.</p>
    <div className="settings-divider">
      <label className="setting-toggle-title" htmlFor="ai-api-key">API-ключ Gemini</label>
      <input id="ai-api-key" className="text-input" type="password" autoComplete="new-password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={settings?.hasApiKey ? 'Ключ сохранён — введите новый для замены' : 'Введите API-ключ'} />
      <div className="ai-key-status"><ShieldCheck size={16} /> {settings?.hasApiKey ? 'Ключ сохранён на сервере' : 'Ключ не задан'}</div>

      {profileBlock(PICTURE_PROFILE, 'Профиль: описание картинок', 'Промпт для описания картинок', false)}
      {profileBlock(PICTURE_FORMAT_PROFILE, 'Профиль: обработка голосового ответа', 'Промпт обработки голосового ответа', false)}
      {profileBlock(CHECK_PROFILE, 'Профиль: проверка ответа пользователя', 'Промпт проверки ответа', true)}
      {profileBlock(WORD_FILL_PROFILE, 'Профиль: заполнение слов', 'Промпт заполнения слов', false)}

      <div className="backup-actions">
        <button type="button" className="btn-primary" disabled={busy || (!apiKey && !settings?.hasApiKey)} onClick={() => void save()}><Save size={15} /> Сохранить</button>
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => void check()}><CheckCircle size={15} /> Проверить настройки</button>
      </div>

      <section className="ai-error-log" aria-labelledby="ai-error-log-title">
        <div className="stats-header">
          <h3 id="ai-error-log-title" className="card-title"><Bot size={18} /> Журнал ошибок ИИ</h3>
          <div className="backup-actions">
            <button type="button" className="btn-secondary" disabled={logsBusy} onClick={() => void loadLogs()}><RefreshCw size={14} /> Обновить</button>
            <button type="button" className="btn-secondary" disabled={logsBusy || !logs.length} onClick={() => void clearLogs()}><Trash2 size={14} /> Очистить</button>
          </div>
        </div>
        <p className="card-note">Сохраняются только технические данные: операция, модель, код и статус ошибки. Тексты ответов, изображения и API-ключи не записываются.</p>
        {logs.length === 0 ? <div className="muted-note">Ошибок ИИ пока нет.</div> : <div className="ai-error-log-list">
          {logs.map((log) => <details key={log.id} className="ai-error-log-item">
            <summary><strong>{AI_OPERATION_LABELS[log.operation] ?? log.operation}</strong> · {log.errorCode} · {new Date(log.createdAt).toLocaleString('ru-RU')}</summary>
            <div className="ai-error-log-details">
              <div>Профиль: {log.profileId ?? '—'}</div>
              <div>Модель: {log.model ?? '—'}</div>
              <div>HTTP Gemini: {log.providerStatus ?? '—'}</div>
              <div>Длительность: {log.durationMs === null ? '—' : `${log.durationMs} мс`}</div>
              <div>Сообщение: {log.message}</div>
            </div>
          </details>)}
        </div>}
      </section>
    </div>
  </div>;
}
