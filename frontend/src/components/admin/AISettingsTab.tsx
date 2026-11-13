import { useCallback, useEffect, useState } from 'react';
import { Bot, CheckCircle, RefreshCw, RotateCcw, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { checkAISettings, clearAIErrorLogs, fetchAIErrorLogs, fetchAIModels, fetchAISettings, fetchAIQueue, resetAIPrompt, retryAIQueueItem, saveAISettings, type AIErrorLog, type AIModel, type AISettingsResponse, type AIQueueSnapshot } from '../../api/settings';
import { reportError, showToast } from '../../utils/toast';

const PICTURE_PROFILE = 'pictureDescription';
const PICTURE_FORMAT_PROFILE = 'pictureAnswerFormat';
const CHECK_PROFILE = 'pictureAnswerCheck';
const WORD_FILL_PROFILE = 'wordFill';
const CATEGORY_PROFILE = 'categoryRedistribution';
const REQUIRED_CASE_PROFILE = 'requiredCase';
const AI_OPERATION_LABELS: Record<string, string> = {
  models: 'Список моделей',
  'settings-check': 'Проверка настроек',
  'picture-description': 'Описание картинки',
  'picture-format': 'Форматирование диктовки',
  'picture-check': 'Проверка ответа',
  'word-fill': 'Заполнение слов',
  'category-redistribution': 'Перераспределение категорий',
  'required-case': 'Определение падежей глаголов',
  'prompt-test': 'Тест промпта',
};
const AI_QUEUE_STATUS_LABELS: Record<string, string> = { queued: 'ожидает', running: 'выполняется', completed: 'завершено', failed: 'ошибка' };

interface AISettingsTabProps {
  view?: 'settings' | 'logs';
}

type LogSubtab = 'active' | 'completed' | 'errors';

const describeAIError = (code: string, message: string, providerStatus: number | null): string => {
  if (code === 'HTTP_404' || providerStatus === 404) return 'Модель не найдена Gemini (HTTP 404). Проверьте, что она доступна для вашего API-ключа, и выберите модель из актуального списка.';
  if (code === 'HTTP_401' || code === 'INVALID_API_KEY') return 'Ключ Gemini недействителен или не имеет доступа к этой модели.';
  if (code === 'HTTP_403') return 'Gemini запретил запрос. Проверьте API-ключ, проект и доступ к модели.';
  if (code === 'HTTP_429') return 'Gemini ограничил частоту запросов (HTTP 429). Уменьшите нагрузку или подождите.';
  if (code.startsWith('HTTP_5')) return `Gemini временно недоступен (${code}). Попробуйте повторить запрос.`;
  return message;
};

const mergeConfiguredModels = (catalog: AIModel[], profiles: AISettingsResponse['profiles']): AIModel[] => {
  const result = [...catalog];
  for (const profile of Object.values(profiles)) {
    if (!profile.model || result.some((model) => model.name === profile.model)) continue;
    result.push({ name: profile.model, displayName: `${profile.model} (сохранённая модель)`, supportedGenerationMethods: ['generateContent'] });
  }
  return result;
};

interface ProfileEditors {
  model: string;
  prompt: string;
  severity: number;
  batchSize?: number;
}

export function AISettingsTab({ view = 'settings' }: AISettingsTabProps) {
  const showSettings = view === 'settings';
  const [settings, setSettings] = useState<AISettingsResponse | null>(null);
  const [models, setModels] = useState<AIModel[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [requestsPerMinute, setRequestsPerMinute] = useState(10);
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<AIErrorLog[]>([]);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [logsBusy, setLogsBusy] = useState(false);
  const [logCounts, setLogCounts] = useState({ completed: 0, errors: 0 });
  const [queue, setQueue] = useState<AIQueueSnapshot | null>(null);
  const [logFilter, setLogFilter] = useState('all');
  const [retrying, setRetrying] = useState<string | null>(null);
  const [logSubtab, setLogSubtab] = useState<LogSubtab>('errors');
  const [hasChosenLogTab, setHasChosenLogTab] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, ProfileEditors>>({
    [PICTURE_PROFILE]: { model: '', prompt: '', severity: 3 },
    [PICTURE_FORMAT_PROFILE]: { model: '', prompt: '', severity: 3 },
    [CHECK_PROFILE]: { model: '', prompt: '', severity: 3 },
    [WORD_FILL_PROFILE]: { model: '', prompt: '', severity: 3 },
    [CATEGORY_PROFILE]: { model: '', prompt: '', severity: 3, batchSize: 100 },
    [REQUIRED_CASE_PROFILE]: { model: '', prompt: '', severity: 3, batchSize: 100 },
  });

  const setProfile = (id: string, patch: Partial<ProfileEditors>) =>
    setProfiles((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const load = async () => {
    try {
      const result = await fetchAISettings();
      setSettings(result);
      setRequestsPerMinute(result.requestsPerMinute ?? 10);
      const next: Record<string, ProfileEditors> = {};
      for (const id of [PICTURE_PROFILE, PICTURE_FORMAT_PROFILE, CHECK_PROFILE, WORD_FILL_PROFILE, CATEGORY_PROFILE, REQUIRED_CASE_PROFILE]) {
        next[id] = {
          model: result.profiles[id]?.model ?? '',
          prompt: result.profiles[id]?.prompt ?? '',
          severity: result.profiles[id]?.severity ?? 3,
          batchSize: result.profiles[id]?.batchSize ?? 100,
        };
      }
      setProfiles(next);
      if (result.hasApiKey) { try { setModels(mergeConfiguredModels((await fetchAIModels()).models, result.profiles)); } catch { setModels(mergeConfiguredModels([], result.profiles)); } }
    } catch (error) { reportError(error, 'Не удалось загрузить настройки ИИ'); }
  };
  useEffect(() => { if (showSettings) void load(); }, [showSettings]);

  const loadLogs = useCallback(async () => {
    setLogsBusy(true);
    try {
      // Load one consistent snapshot. Filtering by tab on the server can
      // cause overlapping requests to overwrite each other with stale data.
      const result = await fetchAIErrorLogs(200);
      setLogs(result.logs);
      setLogCounts(result.counts);
      setLogsLoaded(true);
    }
    catch (error) { reportError(error, 'Не удалось загрузить журнал ошибок ИИ'); }
    finally { setLogsBusy(false); }
  }, []);
  useEffect(() => { if (!showSettings) void loadLogs(); }, [showSettings, loadLogs]);
  useEffect(() => {
    if (!showSettings && logsLoaded && !hasChosenLogTab && logSubtab === 'errors' && logCounts.errors === 0 && logCounts.completed > 0) {
      setLogSubtab('completed');
    }
  }, [showSettings, logsLoaded, hasChosenLogTab, logSubtab, logCounts]);
  useEffect(() => {
    if (showSettings) return undefined;
    const source = new EventSource('/api/settings/ai/queue');
    source.onmessage = (event) => { try { setQueue(JSON.parse(event.data) as AIQueueSnapshot); } catch { /* ignore malformed event */ } };
    void fetchAIQueue().then(setQueue).catch(() => undefined);
    const fallback = window.setInterval(() => { void fetchAIQueue().then(setQueue).catch(() => undefined); }, 5000);
    return () => { source.close(); window.clearInterval(fallback); };
  }, [showSettings]);

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
          hasSeverity ? editor.severity : undefined,
           id === CATEGORY_PROFILE || id === REQUIRED_CASE_PROFILE ? editor.batchSize : undefined,
           id === PICTURE_PROFILE ? requestsPerMinute : undefined
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
      setModels(mergeConfiguredModels(result.models, result.settings.profiles));
      showToast(result.message, result.ok ? 'success' : 'error');
    } catch (error) { reportError(error, 'Не удалось проверить настройки ИИ'); }
    finally { setBusy(false); }
  };

  const clearLogs = async () => {
    if (!confirm('Очистить журнал ошибок ИИ?')) return;
    setLogsBusy(true);
    try { await clearAIErrorLogs(); setLogs([]); setLogCounts({ completed: 0, errors: 0 }); showToast('Журнал ошибок ИИ очищен', 'success'); }
    catch (error) { reportError(error, 'Не удалось очистить журнал ошибок ИИ'); }
    finally { setLogsBusy(false); }
  };

  const retry = async (id: string) => {
    setRetrying(id);
    try { await retryAIQueueItem(id); showToast('Запрос снова поставлен в очередь', 'success'); }
    catch (error) { reportError(error, 'Не удалось повторить запрос'); }
    finally { setRetrying(null); }
  };

  const profileBlock = (id: string, title: string, label: string, showSeverity: boolean) => (
    <details className="ai-profile-block">
      <summary className="ai-profile-summary"><span className="ai-profile-title">{title}</span><span className="ai-profile-open-hint">Открыть</span></summary>
      <div className="ai-profile-content">
      <label className="setting-toggle-title" htmlFor={`ai-model-${id}`}>Модель для этого профиля</label>
       <select id={`ai-model-${id}`} className="text-input" value={profiles[id].model} onChange={(event) => setProfile(id, { model: event.target.value })} disabled={!models.length && !profiles[id].model}>
         <option value="">{models.length ? 'Выберите модель' : profiles[id].model ? 'Текущая модель сохранена' : 'Сначала проверьте ключ'}</option>
         {profiles[id].model && !models.some((item) => item.name === profiles[id].model) && <option value={profiles[id].model}>{profiles[id].model} (сохранённая модель)</option>}
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
      {(id === CATEGORY_PROFILE || id === REQUIRED_CASE_PROFILE) && <>
        <label className="setting-toggle-title" htmlFor={`ai-batch-size-${id}`}>Слов за один промпт: {profiles[id].batchSize}</label>
        <input id={`ai-batch-size-${id}`} type="range" min="10" max="1000" step="10" value={profiles[id].batchSize ?? 100} onChange={(event) => setProfile(id, { batchSize: Number(event.target.value) })} />
      </>}
      </div>
    </details>
  );

  const queueStatusOrder: Record<string, number> = { running: 0, queued: 1, failed: 2 };
  const visibleQueueItems = (queue?.items.filter((item) => item.status !== 'completed') ?? [])
    .slice()
    .sort((a, b) => (queueStatusOrder[a.status] ?? 3) - (queueStatusOrder[b.status] ?? 3) || b.createdAt.localeCompare(a.createdAt));
  const completedLogs = logs.filter((log) => log.errorCode === 'AI_OK');
  const errorLogs = logs.filter((log) => log.errorCode !== 'AI_OK');
  const failedQueueItems = visibleQueueItems.filter((item) => item.status === 'failed');
  const selectedLogs = logSubtab === 'completed' ? completedLogs : errorLogs;
  const filteredLogs = logFilter === 'all' ? selectedLogs : selectedLogs.filter((log) => log.operation === logFilter);
  const logOperations = [...new Set(logs.map((log) => log.operation))];

  return <div className={`card ai-settings-card ${showSettings ? 'ai-settings-card--settings' : 'ai-settings-card--logs'}`}>
    <h3 className="card-title"><Bot size={20} /> {showSettings ? 'Настройки ИИ' : 'Логи ИИ'}</h3>
    <p className="card-note">{showSettings ? 'Провайдер — Google Gemini. Выберите нужный профиль ниже, чтобы открыть его подробности и изменить инструкцию.' : 'Здесь отображаются активные задачи и технические ошибки AI-операций. Тексты промптов и ответы пользователей не сохраняются.'}</p>
      <div className="settings-divider">
       <label className="setting-toggle-title" htmlFor="ai-rate-limit">Запросов к Gemini в минуту: {requestsPerMinute}</label>
       <input id="ai-rate-limit" type="range" min="1" max="60" step="1" value={requestsPerMinute} onChange={(event) => setRequestsPerMinute(Number(event.target.value))} />
       <p className="card-note">Ограничение действует для всех операций ИИ. Если Gemini часто отвечает 429, уменьшите значение.</p>
       <label className="setting-toggle-title" htmlFor="ai-api-key">API-ключ Gemini</label>
      <input id="ai-api-key" className="text-input" type="password" autoComplete="new-password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={settings?.hasApiKey ? 'Ключ сохранён — введите новый для замены' : 'Введите API-ключ'} />
      <div className="ai-key-status"><ShieldCheck size={16} /> {settings?.hasApiKey ? 'Ключ сохранён на сервере' : 'Ключ не задан'}</div>

      {profileBlock(PICTURE_PROFILE, 'Профиль: описание картинок', 'Промпт для описания картинок', false)}
      {profileBlock(PICTURE_FORMAT_PROFILE, 'Профиль: обработка голосового ответа', 'Промпт обработки голосового ответа', false)}
      {profileBlock(CHECK_PROFILE, 'Профиль: проверка ответа пользователя', 'Промпт проверки ответа', true)}
      {profileBlock(WORD_FILL_PROFILE, 'Профиль: заполнение слов', 'Промпт заполнения слов', false)}
      {profileBlock(CATEGORY_PROFILE, 'Профиль: перераспределение категорий', 'Промпт перераспределения категорий', false)}
      {profileBlock(REQUIRED_CASE_PROFILE, 'Профиль: определение падежей глаголов', 'Промпт определения падежей', false)}

      <div className="backup-actions">
        <button type="button" className="btn-primary" disabled={busy || (!apiKey && !settings?.hasApiKey)} onClick={() => void save()}><Save size={15} /> Сохранить</button>
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => void check()}><CheckCircle size={15} /> Проверить настройки</button>
      </div>

       <div className="ai-log-subtabs" role="tablist" aria-label="Разделы логов ИИ">
         <button type="button" className={`ai-log-subtab ${logSubtab === 'active' ? 'is-active' : ''}`} role="tab" aria-selected={logSubtab === 'active'} onClick={() => setLogSubtab('active')}>Текущие / Ожидание <span>{visibleQueueItems.filter((item) => item.status === 'running' || item.status === 'queued').length}</span></button>
          <button type="button" className={`ai-log-subtab ${logSubtab === 'completed' ? 'is-active' : ''}`} role="tab" aria-selected={logSubtab === 'completed'} onClick={() => { setHasChosenLogTab(true); setLogSubtab('completed'); }}>Выполненные <span>{logCounts.completed}</span></button>
          <button type="button" className={`ai-log-subtab ${logSubtab === 'errors' ? 'is-active' : ''}`} role="tab" aria-selected={logSubtab === 'errors'} onClick={() => { setHasChosenLogTab(true); setLogSubtab('errors'); }}>Ошибки <span>{logCounts.errors + failedQueueItems.length}</span></button>
       </div>

       {logSubtab === 'active' && <section className="ai-logs-content" aria-labelledby="ai-queue-title">
        <section className="ai-error-log" aria-labelledby="ai-queue-title">
          <h3 id="ai-queue-title" className="card-title"><Bot size={18} /> Очередь ИИ</h3>
          <p className="card-note">Выполняется: {queue?.active ?? 0} · ожидает: {queue?.waiting ?? 0} · параллельно: {queue?.concurrency ?? '—'}</p>
            {!visibleQueueItems.filter((item) => item.status === 'running' || item.status === 'queued').length ? <div className="muted-note">Нет текущих или ожидающих задач.</div> : <div className="ai-queue-list">{visibleQueueItems.filter((item) => item.status === 'running' || item.status === 'queued').map((item) => <div key={item.id} className={`ai-queue-item ai-queue-item--${item.status}`}><div className="ai-queue-item-main"><strong>{AI_OPERATION_LABELS[item.operation] ?? item.operation}</strong><span className="ai-status">{AI_QUEUE_STATUS_LABELS[item.status] ?? item.status}</span><small>{item.model ?? (item.operation === 'models' ? 'служебный запрос' : 'модель не указана')}</small><code className="ai-queue-id" title={item.id}>ID: {item.id.slice(0, 8)}</code></div></div>)}</div>}
         </section>
       </section>}
        {logSubtab !== 'active' && <section className="ai-error-log ai-logs-content" aria-labelledby="ai-error-log-title">
          <div className="stats-header">
             <h3 id="ai-error-log-title" className="card-title"><Bot size={18} /> {logSubtab === 'completed' ? 'Выполненные запросы' : 'Ошибки ИИ'}</h3>
            <div className="backup-actions">
              <select className="text-input ai-log-filter" aria-label="Фильтр операций" value={logFilter} onChange={(event) => setLogFilter(event.target.value)}><option value="all">Все операции</option>{logOperations.map((operation) => <option key={operation} value={operation}>{AI_OPERATION_LABELS[operation] ?? operation}</option>)}</select>
             <button type="button" className="btn-secondary" disabled={logsBusy} onClick={() => void loadLogs()}><RefreshCw size={14} /> Обновить</button>
            <button type="button" className="btn-secondary" disabled={logsBusy || !logs.length} onClick={() => void clearLogs()}><Trash2 size={14} /> Очистить</button>
          </div>
        </div>
         <p className="card-note">Сохраняются технические данные всех запросов: операция, модель, HTTP-статус и результат. Тексты ответов, изображения и API-ключи не записываются.</p>
          {logSubtab === 'errors' && failedQueueItems.length > 0 && <div className="ai-queue-list">{failedQueueItems.map((item) => <div key={item.id} className="ai-queue-item ai-queue-item--failed"><div className="ai-queue-item-main"><strong>{AI_OPERATION_LABELS[item.operation] ?? item.operation}</strong><span className="ai-status">ошибка</span><small>{item.model ?? 'модель не указана'}</small><code className="ai-queue-id" title={item.id}>ID: {item.id.slice(0, 8)}</code></div>{item.error && <div className="ai-queue-error">{item.error}</div>}<button type="button" className="btn-secondary ai-retry-button" disabled={retrying === item.id} onClick={() => void retry(item.id)}><RotateCcw size={14} /> {retrying === item.id ? 'Ставим…' : 'Повторить запрос'}</button></div>)}</div>}
           {!logsLoaded ? <div className="muted-note">Загрузка журнала…</div> : !filteredLogs.length && !(logSubtab === 'errors' && failedQueueItems.length) ? <div className="muted-note">{logSubtab === 'completed' ? 'Выполненных запросов пока нет.' : 'Ошибок ИИ пока нет.'}</div> : <div className="ai-error-log-list">
           {filteredLogs.map((log) => <article key={log.id} className="ai-log-card"><div className="ai-log-card-head"><div><strong>{AI_OPERATION_LABELS[log.operation] ?? log.operation}</strong><span className="ai-log-code" data-success={log.errorCode === 'AI_OK' ? 'true' : 'false'}>{log.errorCode}</span></div><time dateTime={log.createdAt}>{new Date(log.createdAt).toLocaleString('ru-RU')}</time></div><p className="ai-log-message">{log.errorCode === 'AI_OK' ? log.message : describeAIError(log.errorCode, log.message, log.providerStatus)}</p><dl className="ai-log-meta"><div><dt>Модель</dt><dd>{log.model ?? '—'}</dd></div><div><dt>HTTP</dt><dd>{log.providerStatus ?? '—'}</dd></div><div><dt>Время</dt><dd>{log.durationMs === null ? '—' : `${log.durationMs} мс`}</dd></div><div><dt>Профиль</dt><dd>{log.profileId ?? '—'}</dd></div></dl>{log.errorCode !== 'AI_OK' && log.message !== log.errorCode && <details className="ai-log-details"><summary>Техническая информация</summary><code>{log.message}</code></details>}</article>)}
        </div>}
       </section>}
    </div>
  </div>;
}
