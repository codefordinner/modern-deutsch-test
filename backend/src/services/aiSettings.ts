import { prisma } from '../db';

/** Central AI configuration module. Provider calls must be added here, not in routes or UI. */
export const AI_SETTINGS_KEY = 'aiSettings';
export const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
] as const;
export type GeminiModel = (typeof GEMINI_MODELS)[number];

export interface AISettingsPublic {
  provider: 'gemini';
  model: GeminiModel;
  hasApiKey: boolean;
  isDefault: boolean;
}

interface StoredAISettings { provider: 'gemini'; model: GeminiModel; apiKey: string }
const DEFAULT_MODEL: GeminiModel = 'gemini-2.5-flash';

export function isGeminiModel(value: unknown): value is GeminiModel {
  return typeof value === 'string' && (GEMINI_MODELS as readonly string[]).includes(value);
}

function isValidApiKey(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length >= 10 && value.length <= 500;
}

function sanitizeStored(value: unknown): StoredAISettings | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (raw.provider !== 'gemini' || !isGeminiModel(raw.model) || !isValidApiKey(raw.apiKey)) return null;
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
  if (!isGeminiModel(input.model)) throw new Error('UNKNOWN_MODEL');
  const current = await readStored();
  const apiKey = input.apiKey === undefined || input.apiKey === '' ? current?.apiKey : input.apiKey;
  if (!isValidApiKey(apiKey)) throw new Error('INVALID_API_KEY');
  const value: StoredAISettings = { provider: 'gemini', model: input.model, apiKey: apiKey.trim() };
  await prisma.setting.upsert({ where: { key: AI_SETTINGS_KEY }, create: { key: AI_SETTINGS_KEY, value: JSON.stringify(value) }, update: { value: JSON.stringify(value) } });
  return { provider: 'gemini', model: value.model, hasApiKey: true, isDefault: false };
}

export async function resetAISettings(): Promise<AISettingsPublic> {
  await prisma.setting.deleteMany({ where: { key: AI_SETTINGS_KEY } });
  return readAISettings();
}

/** Local readiness check. It deliberately makes no request to Gemini until AI features are enabled. */
export async function checkAISettings(): Promise<{ ok: boolean; message: string; settings: AISettingsPublic }> {
  const settings = await readAISettings();
  return {
    ok: settings.hasApiKey,
    message: settings.hasApiKey ? 'Настройки Gemini заполнены. Внешний запрос пока не выполняется.' : 'Ключ Gemini не задан',
    settings,
  };
}
