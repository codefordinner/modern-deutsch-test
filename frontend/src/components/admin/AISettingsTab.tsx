import { useEffect, useState } from 'react';
import { Bot, CheckCircle, RotateCcw, Save, ShieldCheck } from 'lucide-react';
import { checkAISettings, fetchAIModels, fetchAISettings, resetAISettings, saveAISettings, type AIModel, type AISettingsResponse } from '../../api/settings';
import { reportError, showToast } from '../../utils/toast';

export function AISettingsTab() {
  const [settings, setSettings] = useState<AISettingsResponse | null>(null);
  const [model, setModel] = useState('');
  const [models, setModels] = useState<AIModel[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => {
    try {
      const result = await fetchAISettings(); setSettings(result); setModel(result.model);
      if (result.hasApiKey) { const catalog = await fetchAIModels(); setModels(catalog.models); if (!result.model && catalog.models[0]) setModel(catalog.models[0].name); }
    } catch (error) { reportError(error, 'Не удалось загрузить настройки ИИ'); }
  };
  useEffect(() => { void load(); }, []);
  const save = async () => { setBusy(true); try { const result = await saveAISettings(model, apiKey); setSettings(result); setApiKey(''); const catalog = await fetchAIModels(); setModels(catalog.models); if (!result.model && catalog.models[0]) { setModel(catalog.models[0].name); await saveAISettings(catalog.models[0].name); } showToast('Настройки ИИ сохранены', 'success'); } catch (error) { reportError(error, 'Не удалось сохранить настройки ИИ'); } finally { setBusy(false); } };
  const reset = async () => { if (!confirm('Сбросить настройки Gemini и удалить сохранённый ключ?')) return; setBusy(true); try { const result = await resetAISettings(); setSettings(result); setModel(result.model); setApiKey(''); showToast('Настройки ИИ сброшены', 'success'); } catch (error) { reportError(error, 'Не удалось сбросить настройки ИИ'); } finally { setBusy(false); } };
  const check = async () => { setBusy(true); try { const result = await checkAISettings(); setModels(result.models); showToast(result.message, result.ok ? 'success' : 'error'); } catch (error) { reportError(error, 'Не удалось проверить настройки ИИ'); } finally { setBusy(false); } };
  return <div className="card ai-settings-card">
    <h3 className="card-title"><Bot size={20} /> Модуль ИИ</h3>
    <p className="card-note">Единая настройка для будущих операций ИИ. Сейчас запросы к Gemini ещё не выполняются.</p>
    <div className="settings-divider">
      <label className="setting-toggle-title" htmlFor="ai-provider">Провайдер</label><input id="ai-provider" className="text-input" value="Google Gemini" disabled />
      <label className="setting-toggle-title" htmlFor="ai-model">Модель Gemini</label>
      <select id="ai-model" className="text-input" value={model} onChange={(event) => setModel(event.target.value)} disabled={!models.length}><option value="">{models.length ? 'Выберите модель' : 'Сначала проверьте ключ'}</option>{models.map((item) => <option key={item.name} value={item.name}>{item.displayName} ({item.name})</option>)}</select>
      <label className="setting-toggle-title" htmlFor="ai-api-key">API-ключ Gemini</label>
      <input id="ai-api-key" className="text-input" type="password" autoComplete="new-password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={settings?.hasApiKey ? 'Ключ сохранён — введите новый для замены' : 'Введите API-ключ'} />
      <div className="ai-key-status"><ShieldCheck size={16} /> {settings?.hasApiKey ? 'Ключ сохранён на сервере' : 'Ключ не задан'}</div>
      <div className="backup-actions"><button type="button" className="btn-primary" disabled={busy || (!apiKey && !settings?.hasApiKey)} onClick={() => void save()}><Save size={15} /> Сохранить</button><button type="button" className="btn-secondary" disabled={busy} onClick={() => void check()}><CheckCircle size={15} /> Проверить настройки</button><button type="button" className="btn-secondary" disabled={busy || !settings?.hasApiKey} onClick={() => void reset()}><RotateCcw size={15} /> Сбросить</button></div>
    </div>
  </div>;
}
