import { prisma } from '../db';

/** Central AI configuration module. Provider calls must be added here, not in routes or UI. */
export const AI_SETTINGS_KEY = 'aiSettings';
export type GeminiModel = string;
export interface GeminiModelInfo { name: string; displayName: string; supportedGenerationMethods: string[] }
export interface PictureMetadata { title: string; description: string }

export interface AISettingsPublic {
  provider: 'gemini';
  hasApiKey: boolean;
  isDefault: boolean;
  profiles: Record<string, { model: GeminiModel; prompt: string; severity?: number }>;
}

export const AI_PROFILE_PICTURE_DESCRIPTION = 'pictureDescription';
export const AI_PROFILE_PICTURE_CHECK = 'pictureAnswerCheck';
export type PictureCheckSeverity = 'neutral' | 'good' | 'style' | 'error' | 'lie';
export interface PictureCheckResult {
  segments: Array<{ text: string; severity: PictureCheckSeverity; note?: string }>;
  report: string;
  score: number;
  maxScore: 100;
  categories: { content: number; grammar: number; vocabulary: number; fluency: number };
  correctedText: string;
  level: string;
  usefulExpressions: string[];
}
interface StoredAISettings { provider: 'gemini'; apiKey: string; profiles: Record<string, { model: GeminiModel; prompt: string; severity?: number }> }
const DEFAULT_MODEL = '';
export const DEFAULT_PICTURE_PROMPT = [
  'Ты готовишь эталонные данные для тренажёра описания картинки.',
  'Ответь только на русском языке.',
  'Опиши только то, что непосредственно видно на изображении. Не угадывай личности, намерения, возраст, профессию, точное место, время или события, если это нельзя уверенно определить.',
  'Название должно быть кратким и нейтральным: 3–8 слов.',
  'Описание должно быть подробным, но фактическим: укажи общую сцену и место (только если видно), затем людей или животных, их видимые действия и положение, заметные предметы, цвета, фон и другие важные детали.',
  'Не добавляй приветствие, оценку, советы, вопросы, объяснение своей работы и Markdown.',
  'Верни объект с ровно двумя строковыми полями: title и description.',
].join(' ');
export const DEFAULT_PICTURE_CHECK_PROMPT = 'Ты проверяешь описание изображения, которое пользователь написал НА НЕМЕЦКОМ ЯЗЫКЕ. Эталонное описание и обратная связь на русском, пользовательский текст анализируй как немецкий. Проверь грамматику, артикли der/die/das, падежи, окончания, порядок слов, глаголы, лексику, орфографию и естественность. Отдельно отмечай фактическую ошибку или ложь. Не штрафуй за синонимы, другой естественный порядок слов и отсутствие деталей, которых пользователь не упомянул. Возвращай JSON. segments должны покрывать исходный текст непрерывно и дословно; severity: neutral|good|style|error|lie; note на русском. report на русском. correctedText — полный исправленный немецкий текст, если нужны исправления. categories — четыре целых оценки 0–25: content, grammar, vocabulary, fluency. level — примерный CEFR A1–C1. usefulExpressions — до 5 коротких немецких выражений с русским переводом. score — сумма категорий. Не добавляй в segments текст, которого нет в ответе.';
export const MAX_PICTURE_ANSWER_LENGTH = 10_000;

export function isGeminiModel(value: unknown): value is GeminiModel {
  return typeof value === 'string' && /^gemini-[a-z0-9][a-z0-9.-]*$/i.test(value.trim()) && value.length <= 200;
}

function isValidApiKey(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length >= 10 && value.length <= 500;
}

function sanitizeStored(value: unknown): StoredAISettings | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (raw.provider !== 'gemini' || (raw.model !== undefined && raw.model !== '' && !isGeminiModel(raw.model)) || !isValidApiKey(raw.apiKey)) return null;
  const legacyPrompt = typeof raw.prompt === 'string' && raw.prompt.trim() ? raw.prompt.trim().slice(0, 10_000) : DEFAULT_PICTURE_PROMPT;
  const profiles = typeof raw.profiles === 'object' && raw.profiles !== null ? raw.profiles as Record<string, { model: string; prompt: string; severity?: number }> : {};
  const pictureProfile = profiles[AI_PROFILE_PICTURE_DESCRIPTION];
  const pictureModel = typeof pictureProfile?.model === 'string' && isGeminiModel(pictureProfile.model) ? pictureProfile.model.trim() : typeof raw.model === 'string' && isGeminiModel(raw.model) ? raw.model.trim() : '';
  const picturePrompt = typeof pictureProfile?.prompt === 'string' && pictureProfile.prompt.trim() ? pictureProfile.prompt.trim().slice(0, 10_000) : legacyPrompt;
  const checkProfile = profiles[AI_PROFILE_PICTURE_CHECK];
  const checkModel = typeof checkProfile?.model === 'string' && isGeminiModel(checkProfile.model) ? checkProfile.model.trim() : typeof raw.model === 'string' && isGeminiModel(raw.model) ? raw.model.trim() : '';
  const checkPrompt = typeof checkProfile?.prompt === 'string' && checkProfile.prompt.trim() ? checkProfile.prompt.trim().slice(0, 10_000) : DEFAULT_PICTURE_CHECK_PROMPT;
  return { provider: 'gemini', apiKey: raw.apiKey.trim(), profiles: {
    [AI_PROFILE_PICTURE_DESCRIPTION]: {
      model: pictureModel,
      prompt: picturePrompt,
    },
    [AI_PROFILE_PICTURE_CHECK]: {
      model: checkModel,
      prompt: checkPrompt,
      severity: Math.max(1, Math.min(5, Math.round(Number(checkProfile?.severity) || 3))),
    },
  } };
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
    hasApiKey: Boolean(stored?.apiKey),
    isDefault: !stored,
    profiles: stored?.profiles ?? {
      [AI_PROFILE_PICTURE_DESCRIPTION]: { model: DEFAULT_MODEL, prompt: DEFAULT_PICTURE_PROMPT },
      [AI_PROFILE_PICTURE_CHECK]: { model: DEFAULT_MODEL, prompt: DEFAULT_PICTURE_CHECK_PROMPT, severity: 3 },
    },
  };
}

export async function writeAISettings(input: { profileId: string; model: unknown; apiKey: unknown; prompt?: unknown; severity?: unknown }): Promise<AISettingsPublic> {
  if (input.profileId !== AI_PROFILE_PICTURE_DESCRIPTION && input.profileId !== AI_PROFILE_PICTURE_CHECK) throw new Error('INVALID_PROFILE');
  if (input.model !== '' && !isGeminiModel(input.model)) throw new Error('INVALID_MODEL');
  const current = await readStored();
  const apiKey = input.apiKey === undefined || input.apiKey === '' ? current?.apiKey : input.apiKey;
  if (!isValidApiKey(apiKey)) throw new Error('INVALID_API_KEY');
  const currentProfile = current?.profiles[input.profileId];
  const prompt = input.prompt === undefined ? currentProfile?.prompt ?? DEFAULT_PICTURE_PROMPT : input.prompt;
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 10_000) throw new Error('INVALID_PROMPT');
  const profile = { model: input.model || currentProfile?.model || '', prompt: prompt.trim(), ...(input.severity !== undefined ? { severity: Math.max(1, Math.min(5, Math.round(Number(input.severity) || 3))) } : currentProfile?.severity !== undefined ? { severity: currentProfile.severity } : {}) };
  const value: StoredAISettings = { provider: 'gemini', apiKey: apiKey.trim(), profiles: { ...(current?.profiles ?? {}), [input.profileId]: profile } };
  await prisma.setting.upsert({ where: { key: AI_SETTINGS_KEY }, create: { key: AI_SETTINGS_KEY, value: JSON.stringify(value) }, update: { value: JSON.stringify(value) } });
  return { provider: 'gemini', hasApiKey: true, isDefault: false, profiles: value.profiles };
}

export async function resetAIProfile(profileId: string): Promise<AISettingsPublic> {
  if (profileId !== AI_PROFILE_PICTURE_DESCRIPTION && profileId !== AI_PROFILE_PICTURE_CHECK) throw new Error('INVALID_PROFILE');
  const current = await readStored();
  if (!current) return readAISettings();
  const currentProfile = current.profiles[profileId];
  const defaultPrompt = profileId === AI_PROFILE_PICTURE_DESCRIPTION ? DEFAULT_PICTURE_PROMPT : DEFAULT_PICTURE_CHECK_PROMPT;
  const profile = {
    model: currentProfile?.model ?? '',
    prompt: defaultPrompt,
    ...(profileId === AI_PROFILE_PICTURE_CHECK ? { severity: currentProfile?.severity ?? 3 } : {}),
  };
  const value: StoredAISettings = { ...current, profiles: { ...current.profiles, [profileId]: profile } };
  await prisma.setting.upsert({ where: { key: AI_SETTINGS_KEY }, create: { key: AI_SETTINGS_KEY, value: JSON.stringify(value) }, update: { value: JSON.stringify(value) } });
  return { provider: 'gemini', hasApiKey: true, isDefault: false, profiles: value.profiles };
}

async function readApiKey(): Promise<string | null> {
  const stored = await readStored();
  return stored?.apiKey ?? null;
}

/** Gets the current model catalog from Gemini. It never calls generateContent. */
export async function fetchGeminiModels(apiKey?: string): Promise<GeminiModelInfo[]> {
  const key = apiKey ?? await readApiKey();
  if (!key) throw new Error('MISSING_API_KEY');
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
    headers: { 'x-goog-api-key': key },
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

/** Generates editable Russian metadata for one picture. All Gemini calls stay in this module. */
export async function generatePictureMetadata(dataUrl: string): Promise<PictureMetadata> {
  const stored = await readStored();
  if (!stored?.apiKey) throw new Error('MISSING_API_KEY');
  const profile = stored.profiles[AI_PROFILE_PICTURE_DESCRIPTION];
  if (!profile?.model) throw new Error('MISSING_MODEL');
  const match = /^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error('INVALID_IMAGE');
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(profile.model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': stored.apiKey },
    body: JSON.stringify({
      contents: [{ parts: [
        { text: [
          profile.prompt,
        ].join(' ') },
        { inline_data: { mime_type: match[1], data: match[2] } },
      ] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING' },
            description: { type: 'STRING' },
          },
          required: ['title', 'description'],
        },
      },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'INVALID_API_KEY' : 'GEMINI_UNAVAILABLE');
  const body = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> };
  const text = body.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === 'string')?.text;
  if (typeof text !== 'string') throw new Error('INVALID_AI_RESPONSE');
  const jsonText = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
  let parsed: unknown;
  try { parsed = JSON.parse(jsonText); } catch { throw new Error('INVALID_AI_RESPONSE'); }
  if (typeof parsed !== 'object' || parsed === null) throw new Error('INVALID_AI_RESPONSE');
  const result = parsed as Record<string, unknown>;
  if (typeof result.title !== 'string' || typeof result.description !== 'string' || !result.title.trim() || !result.description.trim()) throw new Error('INVALID_AI_RESPONSE');
  return { title: result.title.trim().slice(0, 200), description: result.description.trim().slice(0, 5000) };
}

export async function checkPictureAnswer(input: { imageDataUrl: string; reference: string; answer: string; severity?: number }): Promise<PictureCheckResult> {
  const stored = await readStored();
  const profile = stored?.profiles[AI_PROFILE_PICTURE_CHECK];
  if (!stored?.apiKey) throw new Error('MISSING_API_KEY');
  if (!profile?.model) throw new Error('MISSING_MODEL');
  if (typeof input.answer !== 'string' || !input.answer.trim()) throw new Error('EMPTY_ANSWER');
  if (input.answer.length > MAX_PICTURE_ANSWER_LENGTH) throw new Error('ANSWER_TOO_LONG');
  const match = /^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,(.+)$/.exec(input.imageDataUrl);
  if (!match) throw new Error('INVALID_IMAGE');
  const prompt = `${profile.prompt}\n\nЖёсткость проверки: ${Math.max(1, Math.min(5, Math.round(input.severity || profile.severity || 3)))} из 5. Эталонное описание:\n${input.reference}\n\nОтвет пользователя:\n${input.answer}`;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(profile.model)}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': stored.apiKey }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: match[1], data: match[2] } }] }], generationConfig: { responseMimeType: 'application/json' } }), signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'INVALID_API_KEY' : 'GEMINI_UNAVAILABLE');
  const body = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> };
  const text = body.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === 'string')?.text;
  if (typeof text !== 'string') throw new Error('INVALID_AI_RESPONSE');
  let parsed: unknown;
  try { parsed = JSON.parse(text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim()); } catch { throw new Error('INVALID_AI_RESPONSE'); }
  if (typeof parsed !== 'object' || parsed === null) throw new Error('INVALID_AI_RESPONSE');
  const result = parsed as Record<string, unknown>;
  if (!Array.isArray(result.segments) || typeof result.report !== 'string' || result.report.length > 5_000 || !Number.isInteger(result.score)) throw new Error('INVALID_AI_RESPONSE');
  const segments = result.segments.map((segment) => {
    if (typeof segment !== 'object' || segment === null) throw new Error('INVALID_AI_RESPONSE');
    const item = segment as Record<string, unknown>;
    const severity = item.severity;
    if (typeof item.text !== 'string' || !item.text || !['neutral', 'good', 'style', 'error', 'lie'].includes(String(severity))) throw new Error('INVALID_AI_RESPONSE');
    if (item.note !== undefined && (typeof item.note !== 'string' || item.note.length > 500)) throw new Error('INVALID_AI_RESPONSE');
    return { text: item.text, severity: severity as PictureCheckSeverity, ...(typeof item.note === 'string' ? { note: item.note } : {}) };
  });
  const covered = segments.map((segment) => segment.text).join('');
  if (covered !== input.answer) throw new Error('INVALID_AI_RESPONSE');
  if (typeof result.categories !== 'object' || result.categories === null) throw new Error('INVALID_AI_RESPONSE');
  const rawCategories = result.categories as Record<string, unknown>;
  const category = (key: string) => {
    const value = rawCategories[key];
    if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > 25) throw new Error('INVALID_AI_RESPONSE');
    return Number(value);
  };
  const categories = { content: category('content'), grammar: category('grammar'), vocabulary: category('vocabulary'), fluency: category('fluency') };
  const score = categories.content + categories.grammar + categories.vocabulary + categories.fluency;
  if (result.score !== score) throw new Error('INVALID_AI_RESPONSE');
  if (typeof result.correctedText !== 'string' || result.correctedText.length > MAX_PICTURE_ANSWER_LENGTH) throw new Error('INVALID_AI_RESPONSE');
  if (typeof result.level !== 'string' || !/^(?:A[12]|B[12]|C1)$/.test(result.level)) throw new Error('INVALID_AI_RESPONSE');
  if (!Array.isArray(result.usefulExpressions) || result.usefulExpressions.length > 5 || result.usefulExpressions.some((item) => typeof item !== 'string' || item.length > 300)) throw new Error('INVALID_AI_RESPONSE');
  return { segments, report: result.report, score, maxScore: 100, categories, correctedText: result.correctedText, level: result.level, usefulExpressions: result.usefulExpressions as string[] };
}
