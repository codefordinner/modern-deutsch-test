import { prisma } from '../db';

/** Central AI configuration module. Provider calls must be added here, not in routes or UI. */
export const AI_SETTINGS_KEY = 'aiSettings';
export type GeminiModel = string;
export interface GeminiModelInfo { name: string; displayName: string; supportedGenerationMethods: string[] }

export interface AISettingsPublic {
  provider: 'gemini';
  model: GeminiModel;
  hasApiKey: boolean;
  isDefault: boolean;
}

interface StoredAISettings { provider: 'gemini'; model: GeminiModel; apiKey: string }
const DEFAULT_MODEL = '';

export function isGeminiModel(value: unknown): value is GeminiModel {
  return typeof value === 'string' && /^gemini-[a-z0-9][a-z0-9.-]*$/i.test(value.trim()) && value.length <= 200;
}

function isValidApiKey(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length >= 10 && value.length <= 500;
}

function sanitizeStored(value: unknown): StoredAISettings | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (raw.provider !== 'gemini' || (raw.model !== '' && !isGeminiModel(raw.model)) || !isValidApiKey(raw.apiKey)) return null;
  return { provider: 'gemini', model: raw.model, apiKey: raw.apiKey.trim() };
}

async function readStored(): Promise<StoredAISettings | null> {
  const row = await prisma.setting.findUnique({ where: { key: AI_SETTINGS_KEY } });
  if (!row) return null;
  try { return sanitizeStored(JSON.parse(row.value)); } catch { return null; }
}

export async function readAISettings(): Promise<AISettingsPublic> {
  const stored = await readStored();
  return {
    provider: 'gemini',
    model: stored?.model ?? DEFAULT_MODEL,
    hasApiKey: Boolean(stored?.apiKey),
    isDefault: !stored,
  };
}

export async function writeAISettings(input: { model: unknown; apiKey: unknown }): Promise<AISettingsPublic> {
  if (input.model !== '' && !isGeminiModel(input.model)) throw new Error('INVALID_MODEL');
  const current = await readStored();
  const apiKey = input.apiKey === undefined || input.apiKey === '' ? current?.apiKey : input.apiKey;
  if (!isValidApiKey(apiKey)) throw new Error('INVALID_API_KEY');
  const value: StoredAISettings = { provider: 'gemini', model: input.model || current?.model || '', apiKey: apiKey.trim() };
  await prisma.setting.upsert({ where: { key: AI_SETTINGS_KEY }, create: { key: AI_SETTINGS_KEY, value: JSON.stringify(value) }, update: { value: JSON.stringify(value) } });
  return { provider: 'gemini', model: value.model, hasApiKey: true, isDefault: false };
}

export async function resetAISettings(): Promise<AISettingsPublic> {
  await prisma.setting.deleteMany({ where: { key: AI_SETTINGS_KEY } });
  return readAISettings();
}

async function readApiKey(): Promise<string | null> {
  const stored = await readStored();
  return stored?.apiKey ?? null;
}

/** Gets the current model catalog from Gemini. It never calls generateContent. */
export async function fetchGeminiModels(apiKey?: string): Promise<GeminiModelInfo[]> {
  const key = apiKey ?? await readApiKey();
  if (!key) throw new Error('MISSING_API_KEY');
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'INVALID_API_KEY' : 'GEMINI_UNAVAILABLE');
  const body = await response.json() as { models?: Array<{ name?: unknown; displayName?: unknown; supportedGenerationMethods?: unknown }> };
  return (body.models ?? []).flatMap((model) => {
    const fullName = typeof model.name === 'string' ? model.name : '';
    const name = fullName.startsWith('models/') ? fullName.slice('models/'.length) : fullName;
    const methods = Array.isArray(model.supportedGenerationMethods) ? model.supportedGenerationMethods.filter((item): item is string => typeof item === 'string') : [];
    if (!isGeminiModel(name) || !methods.includes('generateContent')) return [];
    return [{ name, displayName: typeof model.displayName === 'string' ? model.displayName : name, supportedGenerationMethods: methods }];
  });
}

export async function checkAISettings(): Promise<{ ok: boolean; message: string; settings: AISettingsPublic; models: GeminiModelInfo[] }> {
  const settings = await readAISettings();
  if (!settings.hasApiKey) return { ok: false, message: 'Ключ Gemini не задан', settings, models: [] };
  try {
    const models = await fetchGeminiModels();
    return { ok: true, message: `Подключение Gemini работает. Доступно моделей: ${models.length}.`, settings, models };
  } catch (error) {
    const message = error instanceof Error && error.message === 'INVALID_API_KEY' ? 'Ключ Gemini недействителен или не имеет доступа.' : 'Не удалось получить список моделей Gemini.';
    return { ok: false, message, settings, models: [] };
  }
}
