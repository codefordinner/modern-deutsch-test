import { useCallback, useEffect, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  Bot,
  CheckCircle,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  checkAISettings,
  clearAIErrorLogs,
  fetchAIErrorLogs,
  fetchAIModels,
  fetchAISettings,
  resetAIPrompt,
  retryAIQueueItem,
  saveAISettings,
  type AIErrorLog,
  type AIModel,
  type AISettingsResponse,
  type AIQueueSnapshot,
} from "../../api/settings";
import { reportError, showToast } from "../../utils/toast";
import { useConfirm } from "../../hooks/useConfirm";
import { getAIBulkJobs, type AIBulkJob } from "../../api/adminWords";

const PICTURE_PROFILE = "pictureDescription";
const PICTURE_FORMAT_PROFILE = "pictureAnswerFormat";
const CHECK_PROFILE = "pictureAnswerCheck";
const WORD_FILL_PROFILE = "wordFill";
const CATEGORY_PROFILE = "categoryRedistribution";
const REQUIRED_CASE_PROFILE = "requiredCase";
const WORD_CHECK_PROFILE = "wordCheck";
const AI_OPERATION_LABELS: Record<string, string> = {
  models: "Список моделей",
  "settings-check": "Проверка настроек",
  "picture-description": "Описание картинки",
  "picture-format": "Форматирование диктовки",
  "picture-check": "Проверка ответа",
  "word-fill": "Заполнение слов",
  "category-redistribution": "Перераспределение категорий",
  "required-case": "Определение падежей глаголов",
  "word-check": "Проверка слов",
  "prompt-test": "Тест промпта",
};
const AI_ERROR_LABELS: Record<string, string> = {
  DUPLICATE_WORD:
    "ИИ предложил форму, которая создаёт дубликат. Конфликтующие исправления не применены.",
  INVALID_AI_RESPONSE: "Gemini вернул ответ в неожиданном формате.",
  MISSING_API_KEY: "Не задан API-ключ Gemini.",
  MISSING_MODEL: "Для профиля не выбрана модель Gemini.",
  AI_TIMEOUT: "Gemini не ответил вовремя.",
  GEMINI_UNAVAILABLE: "Gemini временно недоступен.",
};
const AI_QUEUE_STATUS_LABELS: Record<string, string> = {
  queued: "ожидает",
  running: "выполняется",
  completed: "завершено",
  failed: "ошибка",
};
const AI_JOB_ERROR_LABELS: Record<string, string> = {
  AI_JOB_INTERRUPTED:
    "Задача прервана перезапуском сервера. Запустите её повторно.",
};

interface AISettingsTabProps {
  view?: "settings" | "logs";
}

type LogSubtab = "active" | "completed" | "errors";

const describeAIError = (
  code: string,
  message: string,
  providerStatus: number | null,
): string => {
  if (code === "HTTP_404" || providerStatus === 404)
    return "Модель не найдена Gemini (HTTP 404). Проверьте, что она доступна для вашего API-ключа, и выберите модель из актуального списка.";
  if (code === "HTTP_401" || code === "INVALID_API_KEY")
    return "Ключ Gemini недействителен или не имеет доступа к этой модели.";
  if (code === "HTTP_403")
    return "Gemini запретил запрос. Проверьте API-ключ, проект и доступ к модели.";
  if (code === "HTTP_429")
    return "Gemini ограничил частоту запросов (HTTP 429). Уменьшите нагрузку или подождите.";
  if (providerStatus !== null && providerStatus >= 500)
    return `Gemini временно недоступен (HTTP ${providerStatus}). Попробуйте повторить запрос позже.`;
  if (code.startsWith("HTTP_5"))
    return `Gemini временно недоступен (${code}). Попробуйте повторить запрос.`;
  return AI_ERROR_LABELS[code] ?? message;
};

const mergeConfiguredModels = (
  catalog: AIModel[],
  profiles: AISettingsResponse["profiles"],
): AIModel[] => {
  const result = [...catalog];
  for (const profile of Object.values(profiles)) {
    if (!profile.model || result.some((model) => model.name === profile.model))
      continue;
    result.push({
      name: profile.model,
      displayName: `${profile.model} (сохранённая модель)`,
      supportedGenerationMethods: ["generateContent"],
    });
  }
  return result;
};

interface ProfileEditors {
  model: string;
  prompt: string;
  severity: number;
  batchSize?: number;
}

export function AISettingsTab({ view = "settings" }: AISettingsTabProps) {
  const confirm = useConfirm();
  const showSettings = view === "settings";
  const [settings, setSettings] = useState<AISettingsResponse | null>(null);
  const [models, setModels] = useState<AIModel[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [requestsPerMinute, setRequestsPerMinute] = useState(10);
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<AIErrorLog[]>([]);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [logsBusy, setLogsBusy] = useState(false);
  const [logCounts, setLogCounts] = useState({ completed: 0, errors: 0 });
  const [queue, setQueue] = useState<AIQueueSnapshot | null>(null);
  const [bulkJobs, setBulkJobs] = useState<AIBulkJob[]>([]);
  const [logFilter, setLogFilter] = useState("all");
  const [retrying, setRetrying] = useState<string | null>(null);
  const [logSubtab, setLogSubtab] = useState<LogSubtab>("errors");
  const [hasChosenLogTab, setHasChosenLogTab] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, ProfileEditors>>({
    [PICTURE_PROFILE]: { model: "", prompt: "", severity: 3 },
    [PICTURE_FORMAT_PROFILE]: { model: "", prompt: "", severity: 3 },
    [CHECK_PROFILE]: { model: "", prompt: "", severity: 3 },
    [WORD_FILL_PROFILE]: { model: "", prompt: "", severity: 3 },
    [CATEGORY_PROFILE]: { model: "", prompt: "", severity: 3, batchSize: 100 },
    [REQUIRED_CASE_PROFILE]: {
      model: "",
      prompt: "",
      severity: 3,
      batchSize: 100,
    },
    [WORD_CHECK_PROFILE]: {
      model: "",
      prompt: "",
      severity: 3,
      batchSize: 100,
    },
  });

  const setProfile = (id: string, patch: Partial<ProfileEditors>) =>
    setProfiles((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const load = async () => {
    try {
      const result = await fetchAISettings();
      setSettings(result);
      setRequestsPerMinute(result.requestsPerMinute ?? 10);
      const next: Record<string, ProfileEditors> = {};
      for (const id of [
        PICTURE_PROFILE,
        PICTURE_FORMAT_PROFILE,
        CHECK_PROFILE,
        WORD_FILL_PROFILE,
        CATEGORY_PROFILE,
        REQUIRED_CASE_PROFILE,
        WORD_CHECK_PROFILE,
      ]) {
        next[id] = {
          model: result.profiles[id]?.model ?? "",
          prompt: result.profiles[id]?.prompt ?? "",
          severity: result.profiles[id]?.severity ?? 3,
          batchSize: result.profiles[id]?.batchSize ?? 100,
        };
      }
      setProfiles(next);
      if (result.hasApiKey) {
        try {
          setModels(
            mergeConfiguredModels(
              (await fetchAIModels()).models,
              result.profiles,
            ),
          );
        } catch {
          setModels((current) =>
            mergeConfiguredModels(current, result.profiles),
          );
        }
      }
    } catch (error) {
      reportError(error, "Не удалось загрузить настройки ИИ");
    }
  };
  useEffect(() => {
    if (!showSettings) return;
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [showSettings]);

  const loadLogs = useCallback(async () => {
    setLogsBusy(true);
    try {
      // Load one consistent snapshot. Filtering by tab on the server can
      // cause overlapping requests to overwrite each other with stale data.
      const result = await fetchAIErrorLogs(200);
      setLogs(result.logs);
      setLogCounts(result.counts);
      setLogsLoaded(true);
    } catch (error) {
      reportError(error, "Не удалось загрузить журнал ошибок ИИ");
    } finally {
      setLogsBusy(false);
    }
  }, []);
  useEffect(() => {
    if (showSettings) return;
    const task = window.setTimeout(() => void loadLogs(), 0);
    return () => window.clearTimeout(task);
  }, [showSettings, loadLogs]);
  useEffect(() => {
    if (showSettings) return undefined;
    const source = new EventSource("/api/settings/ai/queue");
    source.onmessage = (event) => {
      try {
        setQueue(JSON.parse(event.data) as AIQueueSnapshot);
      } catch {
        /* ignore malformed event */
      }
    };
    const refresh = () => {
      void getAIBulkJobs()
        .then((result) => setBulkJobs(result.jobs))
        .catch(() => undefined);
    };
    refresh();
    const fallback = window.setInterval(refresh, 5000);
    return () => {
      source.close();
      window.clearInterval(fallback);
    };
  }, [showSettings]);

  const save = async () => {
    setBusy(true);
    try {
      const last = await saveAISettings(profiles, apiKey, requestsPerMinute);
      setApiKey("");
      setSettings(last);
      showToast("Настройки ИИ сохранены", "success");
    } catch (error) {
      reportError(error, "Не удалось сохранить настройки ИИ");
    } finally {
      setBusy(false);
    }
  };

  const resetPrompt = async (profileId: string, label: string) => {
    if (
      !(await confirm(`Сбросить промпт «${label}» к исходному тексту?`, {
        title: "Сбросить промпт",
        confirmLabel: "Сбросить",
      }))
    )
      return;
    setBusy(true);
    try {
      const result = await resetAIPrompt(profileId);
      setSettings(result);
      setProfile(profileId, {
        prompt: result.profiles[profileId]?.prompt ?? "",
      });
      showToast(`Промпт «${label}» сброшен`, "success");
    } catch (error) {
      reportError(error, "Не удалось сбросить промпт");
    } finally {
      setBusy(false);
    }
  };

  const check = async () => {
    setBusy(true);
    try {
      const result = await checkAISettings();
      if (result.ok)
        setModels(
          mergeConfiguredModels(result.models, result.settings.profiles),
        );
      showToast(result.message, result.ok ? "success" : "error");
    } catch (error) {
      reportError(error, "Не удалось проверить настройки ИИ");
    } finally {
      setBusy(false);
    }
  };

  const clearLogs = async () => {
    if (
      !(await confirm("Очистить журнал ошибок ИИ?", {
        title: "Очистить журнал",
        confirmLabel: "Очистить",
        danger: true,
      }))
    )
      return;
    setLogsBusy(true);
    try {
      await clearAIErrorLogs();
      setLogs([]);
      setLogCounts({ completed: 0, errors: 0 });
      showToast("Журнал ошибок ИИ очищен", "success");
    } catch (error) {
      reportError(error, "Не удалось очистить журнал ошибок ИИ");
    } finally {
      setLogsBusy(false);
    }
  };

  const retry = async (id: string) => {
    setRetrying(id);
    try {
      await retryAIQueueItem(id);
      showToast("Запрос снова поставлен в очередь", "success");
    } catch (error) {
      reportError(error, "Не удалось повторить запрос");
    } finally {
      setRetrying(null);
    }
  };

  const profileBlock = (
    id: string,
    title: string,
    label: string,
    showSeverity: boolean,
  ) => (
    <details className="ai-profile-block">
      <summary className="ai-profile-summary">
        <span className="ai-profile-title">{title}</span>
        <span className="ai-profile-open-hint">Открыть</span>
      </summary>
      <div className="ai-profile-content">
        <label className="setting-toggle-title" htmlFor={`ai-model-${id}`}>
          Модель для этого профиля
        </label>
        <select
          id={`ai-model-${id}`}
          className="text-input"
          value={profiles[id].model}
          onChange={(event) => setProfile(id, { model: event.target.value })}
          disabled={!models.length && !profiles[id].model}
        >
          <option value="">
            {models.length
              ? "Выберите модель"
              : profiles[id].model
                ? "Текущая модель сохранена"
                : "Сначала проверьте ключ"}
          </option>
          {profiles[id].model &&
            !models.some((item) => item.name === profiles[id].model) && (
              <option value={profiles[id].model}>
                {profiles[id].model} (сохранённая модель)
              </option>
            )}
          {models.map((item) => (
            <option key={item.name} value={item.name}>
              {item.displayName} ({item.name})
            </option>
          ))}
        </select>
        <div className="ai-prompt-label">
          <label className="setting-toggle-title" htmlFor={`ai-prompt-${id}`}>
            {label}
          </label>
          <button
            type="button"
            className="btn-secondary ai-reset-prompt"
            disabled={busy}
            onClick={() => void resetPrompt(id, label)}
          >
            <RotateCcw size={14} /> Сбросить промпт
          </button>
        </div>
        <textarea
          id={`ai-prompt-${id}`}
          className="text-input ai-prompt-input"
          value={profiles[id].prompt}
          maxLength={10000}
          rows={9}
          onChange={(event) => setProfile(id, { prompt: event.target.value })}
          placeholder="Инструкция для Gemini"
        />
        {showSeverity && (
          <label className="setting-toggle-title" htmlFor="ai-severity">
            Жёсткость проверки: {profiles[id].severity} из 5
          </label>
        )}
        {showSeverity && (
          <input
            id="ai-severity"
            type="range"
            min="1"
            max="5"
            step="1"
            value={profiles[id].severity}
            onChange={(event) =>
              setProfile(id, { severity: Number(event.target.value) })
            }
          />
        )}
        {(id === CATEGORY_PROFILE ||
          id === REQUIRED_CASE_PROFILE ||
          id === WORD_CHECK_PROFILE) && (
          <>
            <label
              className="setting-toggle-title"
              htmlFor={`ai-batch-size-${id}`}
            >
              Слов за один промпт: {profiles[id].batchSize}
            </label>
            <input
              id={`ai-batch-size-${id}`}
              type="range"
              min="10"
              max="1000"
              step="10"
              value={profiles[id].batchSize ?? 100}
              onChange={(event) =>
                setProfile(id, { batchSize: Number(event.target.value) })
              }
            />
          </>
        )}
      </div>
    </details>
  );

  const queueStatusOrder: Record<string, number> = {
    running: 0,
    queued: 1,
    failed: 2,
  };
  const visibleQueueItems = (
    queue?.items.filter((item) => item.status !== "completed") ?? []
  )
    .slice()
    .sort(
      (a, b) =>
        (queueStatusOrder[a.status] ?? 3) - (queueStatusOrder[b.status] ?? 3) ||
        b.createdAt.localeCompare(a.createdAt),
    );
  const completedLogs = logs.filter((log) => log.errorCode === "AI_OK");
  const errorLogs = logs.filter((log) => log.errorCode !== "AI_OK");
  const failedQueueItems = visibleQueueItems.filter(
    (item) => item.status === "failed",
  );
  const failedBulkJobs = bulkJobs.filter((job) => job.status === "failed");
  const effectiveLogSubtab =
    !hasChosenLogTab &&
    logSubtab === "errors" &&
    logCounts.errors === 0 &&
    logCounts.completed > 0
      ? "completed"
      : logSubtab;
  const activateLogTab = (nextTab: LogSubtab) => {
    setHasChosenLogTab(true);
    setLogSubtab(nextTab);
  };
  const handleLogTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const tabs: LogSubtab[] = ["active", "completed", "errors"];
    const currentIndex = tabs.indexOf(
      event.currentTarget.dataset.tab as LogSubtab,
    );
    let nextIndex: number;
    switch (event.key) {
      case "ArrowRight":
        nextIndex = (currentIndex + 1) % tabs.length;
        break;
      case "ArrowLeft":
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const nextTab = tabs[nextIndex];
    event.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`[data-tab="${nextTab}"]`)
      ?.focus();
    activateLogTab(nextTab);
  };
  const logOperations = [...new Set(logs.map((log) => log.operation))];
  const renderLogsPanel = (subtab: "completed" | "errors") => {
    const panelLogs = subtab === "completed" ? completedLogs : errorLogs;
    const panelFilteredLogs =
      logFilter === "all"
        ? panelLogs
        : panelLogs.filter((log) => log.operation === logFilter);
    const isErrors = subtab === "errors";

    return (
      <>
        <div className="stats-header">
          <h3 id={`ai-error-log-title-${subtab}`} className="card-title">
            <Bot size={18} /> {isErrors ? "Ошибки ИИ" : "Выполненные запросы"}
          </h3>
          <div className="backup-actions">
            <select
              className="text-input ai-log-filter"
              aria-label="Фильтр операций"
              value={logFilter}
              onChange={(event) => setLogFilter(event.target.value)}
            >
              <option value="all">Все операции</option>
              {logOperations.map((operation) => (
                <option key={operation} value={operation}>
                  {AI_OPERATION_LABELS[operation] ?? operation}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-secondary"
              disabled={logsBusy}
              onClick={() => void loadLogs()}
            >
              <RefreshCw size={14} /> Обновить
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={logsBusy || !logs.length}
              onClick={() => void clearLogs()}
            >
              <Trash2 size={14} /> Очистить
            </button>
          </div>
        </div>
        <p className="card-note">
          Сохраняются данные всех запросов: операция, модель, HTTP-статус,
          отправленный промпт и ответ Gemini. API-ключи и данные изображений
          перед сохранением удаляются.
        </p>
        {isErrors &&
          (failedQueueItems.length > 0 || failedBulkJobs.length > 0) && (
            <div className="ai-queue-list">
              {failedQueueItems.map((item) => (
                <div
                  key={item.id}
                  className="ai-queue-item ai-queue-item--failed"
                >
                  <div className="ai-queue-item-main">
                    <strong>
                      {AI_OPERATION_LABELS[item.operation] ?? item.operation}
                    </strong>
                    <span className="ai-status">ошибка</span>
                    <small>{item.model ?? "модель не указана"}</small>
                    <code className="ai-queue-id" title={item.id}>
                      ID: {item.id.slice(0, 8)}
                    </code>
                  </div>
                  {item.error && (
                    <div className="ai-queue-error">
                      {AI_JOB_ERROR_LABELS[item.error] ?? item.error}
                    </div>
                  )}
                  {item.error !== "AI_JOB_INTERRUPTED" && (
                    <button
                      type="button"
                      className="btn-secondary ai-retry-button"
                      disabled={retrying === item.id}
                      onClick={() => void retry(item.id)}
                    >
                      <RotateCcw size={14} />{" "}
                      {retrying === item.id ? "Ставим…" : "Повторить запрос"}
                    </button>
                  )}
                </div>
              ))}
              {failedBulkJobs.map((job) => (
                <div
                  key={job.id}
                  className="ai-queue-item ai-queue-item--failed"
                >
                  <div className="ai-queue-item-main">
                    <strong>Массовая задача слов</strong>
                    <span className="ai-status">ошибка</span>
                    <small>
                      {job.error === "AI_JOB_INTERRUPTED"
                        ? AI_JOB_ERROR_LABELS.AI_JOB_INTERRUPTED
                        : (job.error ?? "Задача не завершена")}
                    </small>
                    <code className="ai-queue-id" title={job.id}>
                      ID: {job.id.slice(0, 8)}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          )}
        {!logsLoaded ? (
          <div className="muted-note">Загрузка журнала…</div>
        ) : !panelFilteredLogs.length &&
          !(isErrors && (failedQueueItems.length || failedBulkJobs.length)) ? (
          <div className="muted-note">
            {isErrors
              ? "Ошибок ИИ пока нет."
              : "Выполненных запросов пока нет."}
          </div>
        ) : (
          <div className="ai-error-log-list">
            {panelFilteredLogs.map((log) => (
              <article key={log.id} className="ai-log-card">
                <div className="ai-log-card-head">
                  <div>
                    <strong>
                      {AI_OPERATION_LABELS[log.operation] ?? log.operation}
                    </strong>
                    <span
                      className="ai-log-code"
                      data-success={
                        log.errorCode === "AI_OK" ? "true" : "false"
                      }
                    >
                      {log.errorCode}
                    </span>
                  </div>
                  <time dateTime={log.createdAt}>
                    {new Date(log.createdAt).toLocaleString("ru-RU")}
                  </time>
                </div>
                <p className="ai-log-message">
                  {log.errorCode === "AI_OK"
                    ? log.message
                    : describeAIError(
                        log.errorCode,
                        log.message,
                        log.providerStatus,
                      )}
                </p>
                <dl className="ai-log-meta">
                  <div>
                    <dt>Модель</dt>
                    <dd>{log.model ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>HTTP</dt>
                    <dd>{log.providerStatus ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Время</dt>
                    <dd>
                      {log.durationMs === null ? "—" : `${log.durationMs} мс`}
                    </dd>
                  </div>
                  <div>
                    <dt>Профиль</dt>
                    <dd>{log.profileId ?? "—"}</dd>
                  </div>
                </dl>
                {log.prompt && (
                  <details className="ai-log-details">
                    <summary>Отправленный промпт</summary>
                    <pre>{log.prompt}</pre>
                  </details>
                )}
                {log.response && (
                  <details className="ai-log-details">
                    <summary>Ответ Gemini</summary>
                    <pre>{log.response}</pre>
                  </details>
                )}
                {log.errorCode !== "AI_OK" && log.message !== log.errorCode && (
                  <details className="ai-log-details">
                    <summary>Техническая информация</summary>
                    <code>{log.message}</code>
                  </details>
                )}
              </article>
            ))}
          </div>
        )}
      </>
    );
  };

  return (
    <div
      className={`card ai-settings-card ${showSettings ? "ai-settings-card--settings" : "ai-settings-card--logs"}`}
    >
      <h3 className="card-title">
        <Bot size={20} /> {showSettings ? "Настройки ИИ" : "Логи ИИ"}
      </h3>
      <p className="card-note">
        {showSettings
          ? "Провайдер — Google Gemini. Выберите нужный профиль ниже, чтобы открыть его подробности и изменить инструкцию."
          : "Здесь отображаются активные задачи и запросы AI-операций. Для диагностики доступны отправленный промпт и ответ Gemini; API-ключи и данные изображений не сохраняются."}
      </p>
      <div className="settings-divider">
        <label className="setting-toggle-title" htmlFor="ai-rate-limit">
          Запросов к Gemini в минуту: {requestsPerMinute}
        </label>
        <input
          id="ai-rate-limit"
          type="range"
          min="1"
          max="60"
          step="1"
          value={requestsPerMinute}
          onChange={(event) => setRequestsPerMinute(Number(event.target.value))}
        />
        <p className="card-note">
          Ограничение действует для всех операций ИИ. Если Gemini часто отвечает
          429, уменьшите значение.
        </p>
        <label className="setting-toggle-title" htmlFor="ai-api-key">
          API-ключ Gemini
        </label>
        <input
          id="ai-api-key"
          className="text-input"
          type="password"
          autoComplete="new-password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={
            settings?.hasApiKey
              ? "Ключ сохранён — введите новый для замены"
              : "Введите API-ключ"
          }
        />
        <div className="ai-key-status">
          <ShieldCheck size={16} />{" "}
          {settings?.hasApiKey ? "Ключ сохранён на сервере" : "Ключ не задан"}
        </div>

        {profileBlock(
          PICTURE_PROFILE,
          "Профиль: описание картинок",
          "Промпт для описания картинок",
          false,
        )}
        {profileBlock(
          PICTURE_FORMAT_PROFILE,
          "Профиль: обработка голосового ответа",
          "Промпт обработки голосового ответа",
          false,
        )}
        {profileBlock(
          CHECK_PROFILE,
          "Профиль: проверка ответа пользователя",
          "Промпт проверки ответа",
          true,
        )}
        {profileBlock(
          WORD_FILL_PROFILE,
          "Профиль: заполнение слов",
          "Промпт заполнения слов",
          false,
        )}
        {profileBlock(
          CATEGORY_PROFILE,
          "Профиль: перераспределение категорий",
          "Промпт перераспределения категорий",
          false,
        )}
        {profileBlock(
          REQUIRED_CASE_PROFILE,
          "Профиль: определение падежей глаголов",
          "Промпт определения падежей",
          false,
        )}
        {profileBlock(
          WORD_CHECK_PROFILE,
          "Профиль: полная проверка слов",
          "Промпт полной проверки слова",
          false,
        )}

        <div className="backup-actions">
          <button
            type="button"
            className="btn-primary"
            disabled={busy || (!apiKey && !settings?.hasApiKey)}
            onClick={() => void save()}
          >
            <Save size={15} /> Сохранить
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => void check()}
          >
            <CheckCircle size={15} /> Проверить настройки
          </button>
        </div>

        {!showSettings && (
          <div
            className="ai-log-subtabs"
            role="tablist"
            aria-label="Разделы логов ИИ"
          >
            <button
              id="ai-log-tab-active"
              type="button"
              className={`ai-log-subtab ${effectiveLogSubtab === "active" ? "is-active" : ""}`}
              role="tab"
              data-tab="active"
              tabIndex={effectiveLogSubtab === "active" ? 0 : -1}
              aria-selected={effectiveLogSubtab === "active"}
              onKeyDown={handleLogTabKeyDown}
              onClick={() => activateLogTab("active")}
            >
              Текущие / Ожидание{" "}
              <span>
                {visibleQueueItems.filter(
                  (item) =>
                    item.status === "running" || item.status === "queued",
                ).length +
                  bulkJobs.filter(
                    (job) =>
                      job.status === "running" || job.status === "queued",
                  ).length}
              </span>
            </button>
            <button
              id="ai-log-tab-completed"
              type="button"
              className={`ai-log-subtab ${effectiveLogSubtab === "completed" ? "is-active" : ""}`}
              role="tab"
              data-tab="completed"
              tabIndex={effectiveLogSubtab === "completed" ? 0 : -1}
              aria-selected={effectiveLogSubtab === "completed"}
              onKeyDown={handleLogTabKeyDown}
              onClick={() => activateLogTab("completed")}
            >
              Выполненные <span>{logCounts.completed}</span>
            </button>
            <button
              id="ai-log-tab-errors"
              type="button"
              className={`ai-log-subtab ${effectiveLogSubtab === "errors" ? "is-active" : ""}`}
              role="tab"
              data-tab="errors"
              tabIndex={effectiveLogSubtab === "errors" ? 0 : -1}
              aria-selected={effectiveLogSubtab === "errors"}
              onKeyDown={handleLogTabKeyDown}
              onClick={() => activateLogTab("errors")}
            >
              Ошибки{" "}
              <span>
                {logCounts.errors +
                  failedQueueItems.length +
                  failedBulkJobs.length}
              </span>
            </button>
          </div>
        )}

        {!showSettings &&
          (["active", "completed", "errors"] as const).map((subtab) => (
            <section
              key={subtab}
              id={`ai-logs-panel-${subtab}`}
              className={`ai-logs-content${subtab === "active" ? "" : " ai-error-log"}`}
              role="tabpanel"
              aria-labelledby={`ai-log-tab-${subtab}`}
              hidden={effectiveLogSubtab !== subtab}
              tabIndex={subtab === "active" ? 0 : undefined}
            >
              {subtab === "active" ? (
                <section
                  className="ai-error-log"
                  aria-labelledby="ai-queue-title"
                >
                  <h3 id="ai-queue-title" className="card-title">
                    <Bot size={18} /> Очередь ИИ
                  </h3>
                  <p className="card-note">
                    Выполняется: {queue?.active ?? 0} · ожидает:{" "}
                    {queue?.waiting ?? 0} · параллельно:{" "}
                    {queue?.concurrency ?? "—"}
                  </p>
                  {bulkJobs.some(
                    (job) =>
                      job.status === "running" || job.status === "queued",
                  ) && (
                    <div className="ai-queue-list">
                      {bulkJobs
                        .filter(
                          (job) =>
                            job.status === "running" || job.status === "queued",
                        )
                        .map((job) => (
                          <div
                            key={job.id}
                            className={`ai-queue-item ai-queue-item--${job.status}`}
                          >
                            <div className="ai-queue-item-main">
                              <strong>Массовая задача слов</strong>
                              <span className="ai-status">
                                {job.status === "running"
                                  ? "выполняется"
                                  : "ожидает"}
                              </span>
                              <small>
                                Обработано: {job.completed} из {job.total}
                              </small>
                              <code className="ai-queue-id" title={job.id}>
                                ID: {job.id.slice(0, 8)}
                              </code>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                  {!visibleQueueItems.some(
                    (item) =>
                      item.status === "running" || item.status === "queued",
                  ) &&
                  !bulkJobs.some(
                    (job) =>
                      job.status === "running" || job.status === "queued",
                  ) ? (
                    <div className="muted-note">
                      Нет текущих или ожидающих задач.
                    </div>
                  ) : (
                    <div className="ai-queue-list">
                      {visibleQueueItems
                        .filter(
                          (item) =>
                            item.status === "running" ||
                            item.status === "queued",
                        )
                        .map((item) => (
                          <div
                            key={item.id}
                            className={`ai-queue-item ai-queue-item--${item.status}`}
                          >
                            <div className="ai-queue-item-main">
                              <strong>
                                {AI_OPERATION_LABELS[item.operation] ??
                                  item.operation}
                              </strong>
                              <span className="ai-status">
                                {AI_QUEUE_STATUS_LABELS[item.status] ??
                                  item.status}
                              </span>
                              <small>
                                {item.model ??
                                  (item.operation === "models"
                                    ? "служебный запрос"
                                    : "модель не указана")}
                              </small>
                              <code className="ai-queue-id" title={item.id}>
                                ID: {item.id.slice(0, 8)}
                              </code>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </section>
              ) : (
                renderLogsPanel(subtab)
              )}
            </section>
          ))}
      </div>
    </div>
  );
}
