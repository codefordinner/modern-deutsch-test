import { useEffect, useState } from 'react';
import { Bot, CheckCircle, RotateCcw, Save, ShieldCheck } from 'lucide-react';
import { checkAISettings, fetchAIModels, fetchAISettings, resetAISettings, saveAISettings, type AIModel, type AISettingsResponse } from '../../api/settings';
import { reportError, showToast } from '../../utils/toast';

const PICTURE_PROFILE = 'pictureDescription';

export function AISettingsTab() {
  const [settings, setSettings] = useState<AISettingsResponse | null>(null);
  const [model, setModel] = useState('');
  const [models, setModels] = useState<AIModel[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => {
    try {
      const result = await fetchAISettings(); setSettings(result); setModel(result.profiles[PICTURE_PROFILE]?.model ?? ''); setPrompt(result.profiles[PICTURE_PROFILE]?.prompt ?? '');
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
  const reset = async () => { if (!confirm('Сбросить настройки Gemini и удалить сохранённый ключ?')) return; setBusy(true); try { const result = await resetAISettings(); setSettings(result); setModel(result.profiles[PICTURE_PROFILE]?.model ?? ''); setPrompt(result.profiles[PICTURE_PROFILE]?.prompt ?? ''); setApiKey(''); showToast('Настройки ИИ сброшены', 'success'); } catch (error) { reportError(error, 'Не удалось сбросить настройки ИИ'); } finally { setBusy(false); } };
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
      <label className="setting-toggle-title" htmlFor="ai-picture-prompt">Промпт для описания картинок</label>
      <textarea id="ai-picture-prompt" className="text-input ai-prompt-input" value={prompt} maxLength={10000} rows={9} onChange={(event) => setPrompt(event.target.value)} placeholder="Инструкция для Gemini" />
      <div className="backup-actions"><button type="button" className="btn-primary" disabled={busy || (!apiKey && !settings?.hasApiKey)} onClick={() => void save()}><Save size={15} /> Сохранить</button><button type="button" className="btn-secondary" disabled={busy} onClick={() => void check()}><CheckCircle size={15} /> Проверить настройки</button><button type="button" className="btn-secondary" disabled={busy || !settings?.hasApiKey} onClick={() => void reset()}><RotateCcw size={15} /> Сбросить</button></div>
    </div>
  </div>;
}
