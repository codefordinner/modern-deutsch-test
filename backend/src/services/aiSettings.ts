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
export interface PictureCheckResult { segments: Array<{ text: string; severity: PictureCheckSeverity; note?: string }>; report: string; score: number; maxScore: 100 }
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
export const DEFAULT_PICTURE_CHECK_PROMPT = 'Ты проверяешь описание изображения, которое пользователь написал НА НЕМЕЦКОМ ЯЗЫКЕ. Эталонное описание и итоговая обратная связь могут быть на русском, но пользовательский текст нужно анализировать именно как немецкий. Сравни ответ с эталонным описанием и видимыми фактами на изображении. Проверь немецкую грамматику, артикли der/die/das, падежи, окончания, порядок слов, формы глаголов, лексику, орфографию и естественность формулировок. Отдельно укажи фактические ошибки или откровенную ложь относительно изображения. Не наказывай за допустимые немецкие синонимы, альтернативный порядок слов, другой естественный способ описания и отсутствие несущественных деталей. Все notes и report пиши на русском языке, но фрагменты segments.text должны в точности совпадать с исходным немецким текстом пользователя. Верни JSON: segments — исходный текст пользователя непрерывными фрагментами с severity neutral|good|style|error|lie и короткой русской note для проблемных фрагментов; report — итоговый отчёт на русском; score — целое число 0–100. Не переводи, не исправляй и не изменяй текст пользователя. Не добавляй фрагменты, которых в нём нет.';

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
  return { provider: 'gemini', apiKey: raw.apiKey.trim(), profiles: {
    [AI_PROFILE_PICTURE_DESCRIPTION]: {
      model: pictureProfile?.model || (typeof raw.model === 'string' ? raw.model : ''),
      prompt: pictureProfile?.prompt || legacyPrompt,
    },
    [AI_PROFILE_PICTURE_CHECK]: {
      model: profiles[AI_PROFILE_PICTURE_CHECK]?.model || (typeof raw.model === 'string' ? raw.model : ''),
      prompt: profiles[AI_PROFILE_PICTURE_CHECK]?.prompt || DEFAULT_PICTURE_CHECK_PROMPT,
      severity: Math.max(1, Math.min(5, Math.round(Number(profiles[AI_PROFILE_PICTURE_CHECK]?.severity) || 3))),
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
    profiles: stored?.profiles ?? { [AI_PROFILE_PICTURE_DESCRIPTION]: { model: DEFAULT_MODEL, prompt: DEFAULT_PICTURE_PROMPT } },
  };
}

export async function writeAISettings(input: { profileId: string; model: unknown; apiKey: unknown; prompt?: unknown; severity?: unknown }): Promise<AISettingsPublic> {
  if (!input.profileId || input.profileId.length > 100) throw new Error('INVALID_PROFILE');
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

export async function checkPictureAnswer(input: { imageDataUrl: string; reference: string; answer: string; severity: number }): Promise<PictureCheckResult> {
  const stored = await readStored();
  const profile = stored?.profiles[AI_PROFILE_PICTURE_CHECK];
  if (!stored?.apiKey) throw new Error('MISSING_API_KEY');
  if (!profile?.model) throw new Error('MISSING_MODEL');
  if (!input.answer.trim()) throw new Error('EMPTY_ANSWER');
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
  if (!Array.isArray(result.segments) || typeof result.report !== 'string' || typeof result.score !== 'number') throw new Error('INVALID_AI_RESPONSE');
  const segments = result.segments.flatMap((segment) => { if (typeof segment !== 'object' || segment === null) return []; const item = segment as Record<string, unknown>; const severity = item.severity; if (typeof item.text !== 'string' || !['neutral', 'good', 'style', 'error', 'lie'].includes(String(severity))) return []; return [{ text: item.text, severity: severity as PictureCheckSeverity, ...(typeof item.note === 'string' ? { note: item.note.slice(0, 500) } : {}) }]; });
  return { segments, report: result.report.slice(0, 5000), score: Math.max(0, Math.min(100, Math.round(result.score))), maxScore: 100 };
}
