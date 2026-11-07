import { useEffect, useState } from 'react';
import { Bot, CheckCircle, RotateCcw, Save, ShieldCheck } from 'lucide-react';
import { checkAISettings, fetchAIModels, fetchAISettings, resetAIPrompt, saveAISettings, type AIModel, type AISettingsResponse } from '../../api/settings';
import { reportError, showToast } from '../../utils/toast';

const PICTURE_PROFILE = 'pictureDescription';
const CHECK_PROFILE = 'pictureAnswerCheck';

export function AISettingsTab() {
  const [settings, setSettings] = useState<AISettingsResponse | null>(null);
  const [model, setModel] = useState('');
  const [models, setModels] = useState<AIModel[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [prompt, setPrompt] = useState('');
  const [checkModel, setCheckModel] = useState('');
  const [checkPrompt, setCheckPrompt] = useState('');
  const [severity, setSeverity] = useState(3);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    try {
      const result = await fetchAISettings(); setSettings(result); setModel(result.profiles[PICTURE_PROFILE]?.model ?? ''); setPrompt(result.profiles[PICTURE_PROFILE]?.prompt ?? ''); setCheckModel(result.profiles[CHECK_PROFILE]?.model ?? ''); setCheckPrompt(result.profiles[CHECK_PROFILE]?.prompt ?? ''); setSeverity(result.profiles[CHECK_PROFILE]?.severity ?? 3);
      if (result.hasApiKey) { const catalog = await fetchAIModels(); setModels(catalog.models); if (!result.profiles[PICTURE_PROFILE]?.model && catalog.models[0]) setModel(catalog.models[0].name); }
    } catch (error) { reportError(error, 'Не удалось загрузить настройки ИИ'); }
  };
  useEffect(() => { void load(); }, []);
  const save = async () => {
    setBusy(true);
    try {
      const result = await saveAISettings(PICTURE_PROFILE, model, apiKey, prompt);
      setSettings(result);
      setPrompt(result.profiles[PICTURE_PROFILE]?.prompt ?? prompt);
      setApiKey('');
      const withCheckProfile = await saveAISettings(CHECK_PROFILE, checkModel, undefined, checkPrompt, severity);
      setSettings(withCheckProfile);
      // Loading the remote model catalog is a separate operation. A valid saved key
      // must remain visible even if Gemini temporarily cannot return its catalog.
      try {
        const catalog = await fetchAIModels();
        setModels(catalog.models);
        if (!result.profiles[PICTURE_PROFILE]?.model && catalog.models[0]) {
          const selected = await saveAISettings(PICTURE_PROFILE, catalog.models[0].name, undefined, result.profiles[PICTURE_PROFILE]?.prompt ?? prompt);
          setSettings(selected);
          setModel(selected.profiles[PICTURE_PROFILE]?.model ?? catalog.models[0].name);
        }
      } catch (error) {
        reportError(error, 'Ключ сохранён, но список моделей Gemini загрузить не удалось');
      }
      showToast('Настройки ИИ сохранены', 'success');
    } catch (error) { reportError(error, 'Не удалось сохранить настройки ИИ'); }
    finally { setBusy(false); }
  };
  const resetPrompt = async (profileId: string, label: string) => { if (!confirm(`Сбросить промпт «${label}» к исходному тексту?`)) return; setBusy(true); try { const result = await resetAIPrompt(profileId); setSettings(result); setPrompt(result.profiles[PICTURE_PROFILE]?.prompt ?? prompt); setCheckPrompt(result.profiles[CHECK_PROFILE]?.prompt ?? checkPrompt); showToast(`Промпт «${label}» сброшен`, 'success'); } catch (error) { reportError(error, 'Не удалось сбросить промпт'); } finally { setBusy(false); } };
  const check = async () => { setBusy(true); try { const result = await checkAISettings(); setModels(result.models); showToast(result.message, result.ok ? 'success' : 'error'); } catch (error) { reportError(error, 'Не удалось проверить настройки ИИ'); } finally { setBusy(false); } };
  return <div className="card ai-settings-card">
    <h3 className="card-title"><Bot size={20} /> Модуль ИИ</h3>
    <p className="card-note">Провайдер — Google Gemini. Для каждого профиля можно выбрать свою модель и инструкцию. Новые профили можно добавить без изменения AI API.</p>
    <div className="settings-divider">
      <h4 className="ai-profile-title">Профиль: описание картинок</h4>
      <label className="setting-toggle-title" htmlFor="ai-model">Модель для этого профиля</label>
      <select id="ai-model" className="text-input" value={model} onChange={(event) => setModel(event.target.value)} disabled={!models.length}><option value="">{models.length ? 'Выберите модель' : 'Сначала проверьте ключ'}</option>{models.map((item) => <option key={item.name} value={item.name}>{item.displayName} ({item.name})</option>)}</select>
      <label className="setting-toggle-title" htmlFor="ai-api-key">API-ключ Gemini</label>
      <input id="ai-api-key" className="text-input" type="password" autoComplete="new-password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={settings?.hasApiKey ? 'Ключ сохранён — введите новый для замены' : 'Введите API-ключ'} />
      <div className="ai-key-status"><ShieldCheck size={16} /> {settings?.hasApiKey ? 'Ключ сохранён на сервере' : 'Ключ не задан'}</div>
       <div className="ai-prompt-label"><label className="setting-toggle-title" htmlFor="ai-picture-prompt">Промпт для описания картинок</label><button type="button" className="btn-secondary ai-reset-prompt" disabled={busy} onClick={() => void resetPrompt(PICTURE_PROFILE, 'описание картинок')}><RotateCcw size={14} /> Сбросить промпт</button></div>
       <textarea id="ai-picture-prompt" className="text-input ai-prompt-input" value={prompt} maxLength={10000} rows={9} onChange={(event) => setPrompt(event.target.value)} placeholder="Инструкция для Gemini" />
       <div className="ai-profile-block"><h4 className="ai-profile-title">Профиль: проверка ответа пользователя</h4><label className="setting-toggle-title" htmlFor="ai-check-model">Модель для проверки</label><select id="ai-check-model" className="text-input" value={checkModel} onChange={(event) => setCheckModel(event.target.value)} disabled={!models.length}><option value="">Выберите модель</option>{models.map((item) => <option key={item.name} value={item.name}>{item.displayName} ({item.name})</option>)}</select><div className="ai-prompt-label"><label className="setting-toggle-title" htmlFor="ai-check-prompt">Промпт проверки</label><button type="button" className="btn-secondary ai-reset-prompt" disabled={busy} onClick={() => void resetPrompt(CHECK_PROFILE, 'проверка ответа')}><RotateCcw size={14} /> Сбросить промпт</button></div><textarea id="ai-check-prompt" className="text-input ai-prompt-input" value={checkPrompt} maxLength={10000} rows={9} onChange={(event) => setCheckPrompt(event.target.value)} placeholder="Инструкция проверки ответа" /><label className="setting-toggle-title" htmlFor="ai-severity">Жёсткость проверки: {severity} из 5</label><input id="ai-severity" type="range" min="1" max="5" step="1" value={severity} onChange={(event) => setSeverity(Number(event.target.value))} /></div>
       <div className="backup-actions"><button type="button" className="btn-primary" disabled={busy || (!apiKey && !settings?.hasApiKey)} onClick={() => void save()}><Save size={15} /> Сохранить</button><button type="button" className="btn-secondary" disabled={busy} onClick={() => void check()}><CheckCircle size={15} /> Проверить настройки</button></div>
    </div>
  </div>;
}
