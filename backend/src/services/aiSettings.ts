import { prisma } from '../db';
import { AIServiceError, recordAIError } from './aiErrorLog';
import { configureAIRequestRateLimit, enqueueAI } from './aiQueue';

/** Central AI configuration module. Provider calls must be added here, not in routes or UI. */
export const AI_SETTINGS_KEY = 'aiSettings';
export type GeminiModel = string;
export interface GeminiModelInfo { name: string; displayName: string; supportedGenerationMethods: string[] }
export interface PictureMetadata { title: string; description: string }

export interface AISettingsPublic {
  provider: 'gemini';
  hasApiKey: boolean;
  isDefault: boolean;
  requestsPerMinute: number;
  profiles: Record<string, { model: GeminiModel; prompt: string; severity?: number; batchSize?: number }>;
}

export const AI_PROFILE_PICTURE_DESCRIPTION = 'pictureDescription';
export const AI_PROFILE_PICTURE_FORMAT = 'pictureAnswerFormat';
export const AI_PROFILE_PICTURE_CHECK = 'pictureAnswerCheck';
export const AI_PROFILE_WORD_FILL = 'wordFill';
export const AI_PROFILE_CATEGORY_REDISTRIBUTION = 'categoryRedistribution';
export const AI_PROFILE_REQUIRED_CASE = 'requiredCase';
export type PictureCheckSeverity = 'neutral' | 'good' | 'style' | 'error' | 'lie';
export interface PictureCheckResult {
  segments: Array<{ text: string; severity: PictureCheckSeverity; note?: string; correction?: string }>;
  report: string;
  score: number;
  maxScore: 100;
  categories: { content: number; grammar: number; vocabulary: number; fluency: number };
  correctedText: string;
  level: string;
  usefulExpressions: string[];
}
interface StoredAISettings { provider: 'gemini'; apiKey: string; requestsPerMinute: number; profiles: Record<string, { model: GeminiModel; prompt: string; severity?: number; batchSize?: number }> }
export const DEFAULT_AI_REQUESTS_PER_MINUTE = 10;
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
export const DEFAULT_PICTURE_FORMAT_PROMPT = 'Ты обрабатываешь распознанный голосом текст на немецком языке. Верни тот же текст без исправления слов, орфографии, грамматики или порядка слов. Разрешается только расставить пробелы, запятые и точки по смыслу. Не добавляй и не удаляй слова. Верни только готовый текст, без кавычек, пояснений и Markdown.';
export const DEFAULT_PICTURE_CHECK_PROMPT = 'Ты проверяешь описание изображения, которое пользователь написал НА НЕМЕЦКОМ ЯЗЫКЕ. Эталонное описание и обратная связь на русском, пользовательский текст анализируй как немецкий. Проверь грамматику, артикли der/die/das, падежи, окончания, порядок слов, глаголы, лексику, орфографию и естественность. Отдельно отмечай фактическую ошибку или ложь. Проверяй факты по самому изображению, а не только по эталону (эталон может быть неполным). Не штрафуй за синонимы, другой естественный порядок слов и отсутствие деталей, которых пользователь не упомянул. Возвращай JSON. segments должны покрывать исходный текст непрерывно и дословно; для каждого сегмента с severity error|style|lie укажи поле correction — правильный немецкий вариант этого фрагмента (для нейтральных/хороших сегментов correction опускай); severity: neutral|good|style|error|lie. note на русском: называй правило и/или давай правильный пример (например, «здесь Dativ, верно: dem Mann»), а не общие слова. Одну и ту же ошибку, повторённую несколько раз (например, неверный артикль в каждой фразе), штрафуй один раз и отметь в report, что она повторяется. report на русском, доброжелательно и конкретно: сначала что удалось, затем что исправить с примерами, без общих фраз. correctedText — полный исправленный немецкий текст, если нужны исправления; если в ответе нет знаков препинания (пользователь диктовал голосом), расставь в correctedText запятые и точки по смыслу, не меняя при этом слова и их порядок без необходимости. categories — четыре целых оценки 0–25: content, grammar, vocabulary, fluency. Оценивай по эталону уровня B1: баллы должны отражать полноту, сложность и длину ответа, а не только отсутствие ошибок. Не давай баллы «впустую» — если пользователь написал 2–3 коротких простых предложения без ошибок, это всё равно низкий балл за content и fluency (ответ не раскрывает картинку), поэтому суммарный балл должен быть заметно ниже 60. Если описание настолько общее, что подходит к любой картинке и не называет ни одной конкретной детали, — снизь content и укажи это в report. level — примерный CEFR A1–C1; согласуй level с оценками и сложностью ответа: короткий простой безошибочный текст — не выше A2, развёрнутый ответ с разнообразной лексикой и сложными конструкциями — B1 и выше. usefulExpressions — массив до 5 строк, каждая строка вида «немецкое выражение — русский перевод» (тире-разделитель); подбирай выражения под эту картинку и уровень ученика, которые реально улучшили бы именно этот ответ. score — сумма категорий. Не добавляй в segments текст, которого нет в ответе.';
export const DEFAULT_WORD_FILL_PROMPT = [
  'Ты наполняешь словарь тренажёра немецкого языка. Ниже — список слов (немецкие, русские или вперемешку).',
  'Преврати его в JSON и верни ТОЛЬКО JSON — одним блоком кода, без пояснений до и после.',
  'Формат: массив объектов, один объект на слово.',
  'Поля: "de" (обязательно) — немецкое слово, существительные всегда с артиклем ("der Tisch"); "ru" (обязательно) — перевод на русский;',
  '"category" — название категории (выбирай из предложенных; если ничего не подходит — короткое новое название; если подходит несколько — массив, первая основная);',
  '"partOfSpeech" — ровно одно из "noun", "verb", "adjective", "adverb", "other";',
  '"hint" — короткая подсказка для различения омонимов, только если нужно;',
  '"plural" — множественное число с артиклем ("die Tische"); "feminine" — женская форма ("die Ärztin"), только если существует;',
  'для глаголов: "praeteritum", "partizip2", "hilfsverb" (строго "haben" или "sein"), а также "praesensIch", "praesensDu", "praesensErSieEs", "praesensIhr" для сильных глаголов и глаголов с изменением корня.',
  'Правила: не добавляй других полей; не выдумывай формы — если не уверен, пропусти поле;',
  'не меняй написание слов из списка, кроме добавления артикля и исправления явных опечаток;',
  'не пиши одно слово дважды — если оно в нескольких категориях, это одна запись с массивом "category";',
  'ответ должен быть валидным JSON (двойные кавычки, без комментариев, без запятой после последнего элемента).',
  'Обязательно верни ответ строго в таком виде:',
  '```json',
  '[',
  '  {"de": "der Tisch", "ru": "стол", "category": "Повседневные слова", "partOfSpeech": "noun", "plural": "die Tische"},',
  '  {"de": "der Arzt", "ru": "врач", "category": ["Профессии", "Семья и люди"], "partOfSpeech": "noun", "plural": "die Ärzte", "feminine": "die Ärztin"},',
  '  {"de": "gehen", "ru": "идти, ходить", "category": "Глаголы", "partOfSpeech": "verb", "praeteritum": "ging", "partizip2": "gegangen", "hilfsverb": "sein", "praesensIch": "gehe", "praesensDu": "gehst", "praesensErSieEs": "geht", "praesensIhr": "geht"}',
  ']',
  '```',
].join(' ');
export const DEFAULT_CATEGORY_REDISTRIBUTION_PROMPT = 'Ты распределяешь слова немецкого учебного словаря по существующим категориям. Верни только JSON-массив объектов {"id":"...","categories":["точное название категории"]}. Для каждого слова выбери одну или несколько наиболее подходящих категорий только из переданного списка. Не придумывай категории, не меняй id, не пропускай слова.';
export const DEFAULT_REQUIRED_CASE_PROMPT = 'Ты определяешь управление немецких глаголов. Верни только JSON-массив объектов {"id":"...","requiredCase":"nominativ|akkusativ|dativ|genitiv|null"}. Выбери падеж, который требует глагол в типичном значении; если глагол не требует объекта или уверенности нет, верни null. Не угадывай, не меняй id и не пропускай слова.';
export const MAX_PICTURE_ANSWER_LENGTH = 10_000;
export const MAX_WORD_FILL_CHARS = 50_000;
export const MAX_WORD_FILL_WORDS = 1000;
export const MAX_AI_BATCH_WORDS = 5000;
export const DEFAULT_AI_BATCH_SIZE = 100;

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
  const profiles = typeof raw.profiles === 'object' && raw.profiles !== null ? raw.profiles as Record<string, { model: string; prompt: string; severity?: number; batchSize?: number }> : {};
  const pictureProfile = profiles[AI_PROFILE_PICTURE_DESCRIPTION];
  const pictureModel = typeof pictureProfile?.model === 'string' && isGeminiModel(pictureProfile.model) ? pictureProfile.model.trim() : typeof raw.model === 'string' && isGeminiModel(raw.model) ? raw.model.trim() : '';
  const picturePrompt = typeof pictureProfile?.prompt === 'string' && pictureProfile.prompt.trim() ? pictureProfile.prompt.trim().slice(0, 10_000) : legacyPrompt;
  const formatProfile = profiles[AI_PROFILE_PICTURE_FORMAT];
  const formatModel = typeof formatProfile?.model === 'string' && isGeminiModel(formatProfile.model) ? formatProfile.model.trim() : typeof raw.model === 'string' && isGeminiModel(raw.model) ? raw.model.trim() : '';
  const formatPrompt = typeof formatProfile?.prompt === 'string' && formatProfile.prompt.trim() ? formatProfile.prompt.trim().slice(0, 10_000) : DEFAULT_PICTURE_FORMAT_PROMPT;
  const checkProfile = profiles[AI_PROFILE_PICTURE_CHECK];
  const checkModel = typeof checkProfile?.model === 'string' && isGeminiModel(checkProfile.model) ? checkProfile.model.trim() : typeof raw.model === 'string' && isGeminiModel(raw.model) ? raw.model.trim() : '';
  const checkPrompt = typeof checkProfile?.prompt === 'string' && checkProfile.prompt.trim() ? checkProfile.prompt.trim().slice(0, 10_000) : DEFAULT_PICTURE_CHECK_PROMPT;
  const wordFillProfile = profiles[AI_PROFILE_WORD_FILL];
  const wordFillModel = typeof wordFillProfile?.model === 'string' && isGeminiModel(wordFillProfile.model) ? wordFillProfile.model.trim() : typeof raw.model === 'string' && isGeminiModel(raw.model) ? raw.model.trim() : '';
  const wordFillPrompt = typeof wordFillProfile?.prompt === 'string' && wordFillProfile.prompt.trim() ? wordFillProfile.prompt.trim().slice(0, 10_000) : DEFAULT_WORD_FILL_PROMPT;
  const categoryProfile = profiles[AI_PROFILE_CATEGORY_REDISTRIBUTION];
  const categoryModel = typeof categoryProfile?.model === 'string' && isGeminiModel(categoryProfile.model) ? categoryProfile.model.trim() : typeof raw.model === 'string' && isGeminiModel(raw.model) ? raw.model.trim() : '';
  const categoryPrompt = typeof categoryProfile?.prompt === 'string' && categoryProfile.prompt.trim() ? categoryProfile.prompt.trim().slice(0, 10_000) : DEFAULT_CATEGORY_REDISTRIBUTION_PROMPT;
  const caseProfile = profiles[AI_PROFILE_REQUIRED_CASE];
  const caseModel = typeof caseProfile?.model === 'string' && isGeminiModel(caseProfile.model) ? caseProfile.model.trim() : typeof raw.model === 'string' && isGeminiModel(raw.model) ? raw.model.trim() : '';
  const casePrompt = typeof caseProfile?.prompt === 'string' && caseProfile.prompt.trim() ? caseProfile.prompt.trim().slice(0, 10_000) : DEFAULT_REQUIRED_CASE_PROMPT;
  const batchSizeOf = (profile: { batchSize?: number } | undefined) => Math.max(10, Math.min(MAX_AI_BATCH_WORDS, Math.round(Number(profile?.batchSize) || DEFAULT_AI_BATCH_SIZE)));
  const requestsPerMinute = Math.max(1, Math.min(60, Math.round(Number(raw.requestsPerMinute) || DEFAULT_AI_REQUESTS_PER_MINUTE)));
  return { provider: 'gemini', apiKey: raw.apiKey.trim(), requestsPerMinute, profiles: {
    [AI_PROFILE_PICTURE_DESCRIPTION]: {
      model: pictureModel,
      prompt: picturePrompt,
    },
    [AI_PROFILE_PICTURE_FORMAT]: { model: formatModel, prompt: formatPrompt },
    [AI_PROFILE_PICTURE_CHECK]: {
      model: checkModel,
      prompt: checkPrompt,
      severity: Math.max(1, Math.min(5, Math.round(Number(checkProfile?.severity) || 3))),
    },
    [AI_PROFILE_WORD_FILL]: {
      model: wordFillModel,
      prompt: wordFillPrompt,
    },
    [AI_PROFILE_CATEGORY_REDISTRIBUTION]: { model: categoryModel, prompt: categoryPrompt, batchSize: batchSizeOf(categoryProfile) },
    [AI_PROFILE_REQUIRED_CASE]: { model: caseModel, prompt: casePrompt, batchSize: batchSizeOf(caseProfile) },
  } };
}

async function readStored(): Promise<StoredAISettings | null> {
  const row = await prisma.setting.findUnique({ where: { key: AI_SETTINGS_KEY } });
  if (!row) { configureAIRequestRateLimit(DEFAULT_AI_REQUESTS_PER_MINUTE); return null; }
  try { const value = sanitizeStored(JSON.parse(row.value)); configureAIRequestRateLimit(value?.requestsPerMinute ?? DEFAULT_AI_REQUESTS_PER_MINUTE); return value; } catch { configureAIRequestRateLimit(DEFAULT_AI_REQUESTS_PER_MINUTE); return null; }
}

export async function readAISettings(): Promise<AISettingsPublic> {
  const stored = await readStored();
  return {
    provider: 'gemini',
    hasApiKey: Boolean(stored?.apiKey),
    isDefault: !stored,
    requestsPerMinute: stored?.requestsPerMinute ?? DEFAULT_AI_REQUESTS_PER_MINUTE,
    profiles: stored?.profiles ?? {
      [AI_PROFILE_PICTURE_DESCRIPTION]: { model: DEFAULT_MODEL, prompt: DEFAULT_PICTURE_PROMPT },
      [AI_PROFILE_PICTURE_FORMAT]: { model: DEFAULT_MODEL, prompt: DEFAULT_PICTURE_FORMAT_PROMPT },
      [AI_PROFILE_PICTURE_CHECK]: { model: DEFAULT_MODEL, prompt: DEFAULT_PICTURE_CHECK_PROMPT, severity: 3 },
      [AI_PROFILE_WORD_FILL]: { model: DEFAULT_MODEL, prompt: DEFAULT_WORD_FILL_PROMPT },
      [AI_PROFILE_CATEGORY_REDISTRIBUTION]: { model: DEFAULT_MODEL, prompt: DEFAULT_CATEGORY_REDISTRIBUTION_PROMPT, batchSize: DEFAULT_AI_BATCH_SIZE },
      [AI_PROFILE_REQUIRED_CASE]: { model: DEFAULT_MODEL, prompt: DEFAULT_REQUIRED_CASE_PROMPT, batchSize: DEFAULT_AI_BATCH_SIZE },
    },
  };
}

export async function writeAISettings(input: { profileId: string; model: unknown; apiKey: unknown; prompt?: unknown; severity?: unknown; batchSize?: unknown; requestsPerMinute?: unknown }): Promise<AISettingsPublic> {
  if (![AI_PROFILE_PICTURE_DESCRIPTION, AI_PROFILE_PICTURE_FORMAT, AI_PROFILE_PICTURE_CHECK, AI_PROFILE_WORD_FILL, AI_PROFILE_CATEGORY_REDISTRIBUTION, AI_PROFILE_REQUIRED_CASE].includes(input.profileId)) throw new Error('INVALID_PROFILE');
  if (input.model !== '' && !isGeminiModel(input.model)) throw new Error('INVALID_MODEL');
  const current = await readStored();
  const apiKey = input.apiKey === undefined || input.apiKey === '' ? current?.apiKey : input.apiKey;
  if (!isValidApiKey(apiKey)) throw new Error('INVALID_API_KEY');
  const currentProfile = current?.profiles[input.profileId];
  const defaultPrompt = input.profileId === AI_PROFILE_PICTURE_CHECK ? DEFAULT_PICTURE_CHECK_PROMPT : input.profileId === AI_PROFILE_PICTURE_FORMAT ? DEFAULT_PICTURE_FORMAT_PROMPT : input.profileId === AI_PROFILE_WORD_FILL ? DEFAULT_WORD_FILL_PROMPT : input.profileId === AI_PROFILE_CATEGORY_REDISTRIBUTION ? DEFAULT_CATEGORY_REDISTRIBUTION_PROMPT : input.profileId === AI_PROFILE_REQUIRED_CASE ? DEFAULT_REQUIRED_CASE_PROMPT : DEFAULT_PICTURE_PROMPT;
  const prompt = input.prompt === undefined ? currentProfile?.prompt ?? defaultPrompt : input.prompt;
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 10_000) throw new Error('INVALID_PROMPT');
  const batchProfile = input.profileId === AI_PROFILE_CATEGORY_REDISTRIBUTION || input.profileId === AI_PROFILE_REQUIRED_CASE;
  const batchSize = Math.max(10, Math.min(MAX_AI_BATCH_WORDS, Math.round(Number(input.batchSize ?? currentProfile?.batchSize) || DEFAULT_AI_BATCH_SIZE)));
  const profile = { model: input.model || currentProfile?.model || '', prompt: prompt.trim(), ...(input.severity !== undefined ? { severity: Math.max(1, Math.min(5, Math.round(Number(input.severity) || 3))) } : currentProfile?.severity !== undefined ? { severity: currentProfile.severity } : {}), ...(batchProfile ? { batchSize } : {}) };
  const requestsPerMinute = Math.max(1, Math.min(60, Math.round(Number(input.requestsPerMinute ?? current?.requestsPerMinute) || DEFAULT_AI_REQUESTS_PER_MINUTE)));
  const value: StoredAISettings = { provider: 'gemini', apiKey: apiKey.trim(), requestsPerMinute, profiles: { ...(current?.profiles ?? {}), [input.profileId]: profile } };
  configureAIRequestRateLimit(requestsPerMinute);
  await prisma.setting.upsert({ where: { key: AI_SETTINGS_KEY }, create: { key: AI_SETTINGS_KEY, value: JSON.stringify(value) }, update: { value: JSON.stringify(value) } });
  return { provider: 'gemini', hasApiKey: true, isDefault: false, requestsPerMinute, profiles: value.profiles };
}

export async function resetAIProfile(profileId: string): Promise<AISettingsPublic> {
  if (![AI_PROFILE_PICTURE_DESCRIPTION, AI_PROFILE_PICTURE_FORMAT, AI_PROFILE_PICTURE_CHECK, AI_PROFILE_WORD_FILL, AI_PROFILE_CATEGORY_REDISTRIBUTION, AI_PROFILE_REQUIRED_CASE].includes(profileId)) throw new Error('INVALID_PROFILE');
  const current = await readStored();
  if (!current) return readAISettings();
  const currentProfile = current.profiles[profileId];
  const defaultPrompt = profileId === AI_PROFILE_PICTURE_CHECK ? DEFAULT_PICTURE_CHECK_PROMPT : profileId === AI_PROFILE_PICTURE_FORMAT ? DEFAULT_PICTURE_FORMAT_PROMPT : profileId === AI_PROFILE_WORD_FILL ? DEFAULT_WORD_FILL_PROMPT : profileId === AI_PROFILE_CATEGORY_REDISTRIBUTION ? DEFAULT_CATEGORY_REDISTRIBUTION_PROMPT : profileId === AI_PROFILE_REQUIRED_CASE ? DEFAULT_REQUIRED_CASE_PROMPT : DEFAULT_PICTURE_PROMPT;
  const profile = {
    model: currentProfile?.model ?? '',
    prompt: defaultPrompt,
    ...(profileId === AI_PROFILE_PICTURE_CHECK ? { severity: currentProfile?.severity ?? 3 } : {}),
    ...((profileId === AI_PROFILE_CATEGORY_REDISTRIBUTION || profileId === AI_PROFILE_REQUIRED_CASE) ? { batchSize: currentProfile?.batchSize ?? DEFAULT_AI_BATCH_SIZE } : {}),
  };
  const value: StoredAISettings = { ...current, profiles: { ...current.profiles, [profileId]: profile } };
  await prisma.setting.upsert({ where: { key: AI_SETTINGS_KEY }, create: { key: AI_SETTINGS_KEY, value: JSON.stringify(value) }, update: { value: JSON.stringify(value) } });
  return { provider: 'gemini', hasApiKey: true, isDefault: false, requestsPerMinute: value.requestsPerMinute, profiles: value.profiles };
}

async function readApiKey(): Promise<string | null> {
  const stored = await readStored();
  return stored?.apiKey ?? null;
}

/** Gets the current model catalog from Gemini. It never calls generateContent. */
export async function fetchGeminiModels(apiKey?: string): Promise<GeminiModelInfo[]> {
  const key = apiKey ?? await readApiKey();
  if (!key) throw new Error('MISSING_API_KEY');
  const response = await enqueueAI('models', undefined, () => fetch('https://generativelanguage.googleapis.com/v1beta/models', {
    headers: { 'x-goog-api-key': key },
    signal: AbortSignal.timeout(15_000),
  }));
  if (!response.ok) throw new AIServiceError(response.status === 401 || response.status === 403 ? 'INVALID_API_KEY' : 'GEMINI_UNAVAILABLE', { providerStatus: response.status });
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
    await recordAIError({ operation: 'settings-check', error }).catch(() => undefined);
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
  let response: Response;
  try {
    response = await enqueueAI('picture-description', AI_PROFILE_PICTURE_DESCRIPTION, () => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(profile.model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': stored.apiKey },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: [profile.prompt].join(' ') },
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
    }), profile.model);
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') throw Object.assign(new Error('AI_TIMEOUT'), { model: profile.model, durationMs: (error as Error & { durationMs?: number }).durationMs });
    throw error;
  }
  if (!response.ok) throw new AIServiceError(response.status === 401 || response.status === 403 ? 'INVALID_API_KEY' : 'GEMINI_UNAVAILABLE', { providerStatus: response.status, model: profile.model });
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

export async function formatPictureAnswer(answer: string): Promise<string> {
  const stored = await readStored();
  const profile = stored?.profiles[AI_PROFILE_PICTURE_FORMAT];
  if (!stored?.apiKey) throw new Error('MISSING_API_KEY');
  if (!profile?.model) throw new Error('MISSING_MODEL');
  if (!answer.trim()) throw new Error('EMPTY_ANSWER');
  if (answer.length > MAX_PICTURE_ANSWER_LENGTH) throw new Error('ANSWER_TOO_LONG');
  let response: Response;
  try {
    response = await enqueueAI('picture-format', AI_PROFILE_PICTURE_FORMAT, () => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(profile.model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': stored.apiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: `${profile.prompt}\n\nТекст пользователя:\n${answer}` }] }] }),
      signal: AbortSignal.timeout(120_000),
    }), profile.model);
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) throw Object.assign(new Error('AI_TIMEOUT'), { model: profile.model, durationMs: (error as Error & { durationMs?: number }).durationMs });
    throw error;
  }
  if (!response.ok) throw new AIServiceError(response.status === 401 || response.status === 403 ? 'INVALID_API_KEY' : 'GEMINI_UNAVAILABLE', { providerStatus: response.status, model: profile.model });
  const body = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> };
  const text = body.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === 'string')?.text;
  if (typeof text !== 'string' || !text.trim()) throw new Error('INVALID_AI_RESPONSE');
  const formatted = text.replace(/^```(?:text)?\s*/i, '').replace(/\s*```$/, '').trim();
  if (formatted.length > MAX_PICTURE_ANSWER_LENGTH) throw new Error('INVALID_AI_RESPONSE');
  const sourceWords = answer.match(/[\p{L}\p{N}]+/gu) ?? [];
  const formattedWords = formatted.match(/[\p{L}\p{N}]+/gu) ?? [];
  if (sourceWords.length !== formattedWords.length || sourceWords.some((word, index) => word !== formattedWords[index])) throw new Error('INVALID_AI_RESPONSE');
  return formatted;
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
  const prompt = `${profile.prompt}\n\nДля каждого сегмента с severity error|style|lie укажи поле correction — правильный немецкий вариант этого фрагмента (для остальных опускай).\n\nЖёсткость проверки: ${Math.max(1, Math.min(5, Math.round(input.severity || profile.severity || 3)))} из 5. Эталонное описание:\n${input.reference}\n\nОтвет пользователя:\n${input.answer}`;
  let response: Response;
  try {
      response = await enqueueAI('picture-check', AI_PROFILE_PICTURE_CHECK, () => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(profile.model)}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': stored.apiKey }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: match[1], data: match[2] } }] }], generationConfig: { responseMimeType: 'application/json' } }), signal: AbortSignal.timeout(120_000) }), profile.model);
  } catch (error) {
     if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) throw Object.assign(new Error('AI_TIMEOUT'), { model: profile.model, durationMs: (error as Error & { durationMs?: number }).durationMs });
    throw error;
  }
  if (!response.ok) throw new AIServiceError(response.status === 401 || response.status === 403 ? 'INVALID_API_KEY' : 'GEMINI_UNAVAILABLE', { providerStatus: response.status, model: profile.model });
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
    if (item.correction !== undefined && (typeof item.correction !== 'string' || !item.correction.trim() || item.correction.length > 500)) throw new Error('INVALID_AI_RESPONSE');
    return { text: item.text, severity: severity as PictureCheckSeverity, ...(typeof item.note === 'string' ? { note: item.note } : {}), ...(typeof item.correction === 'string' ? { correction: item.correction.trim() } : {}) };
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
  if (!Array.isArray(result.usefulExpressions) || result.usefulExpressions.length > 5 || result.usefulExpressions.some((item) => typeof item !== 'string' && (typeof item !== 'object' || item === null))) throw new Error('INVALID_AI_RESPONSE');
  const usefulExpressions = result.usefulExpressions.map((item) => {
    if (typeof item === 'string') return item.trim().slice(0, 300);
    const object = item as Record<string, unknown>;
    const german = typeof object.german === 'string' ? object.german.trim() : '';
    const russian = typeof object.russian === 'string' ? object.russian.trim() : '';
    const value = german && russian ? `${german} — ${russian}` : german || russian;
    if (!value) throw new Error('INVALID_AI_RESPONSE');
    return value.slice(0, 300);
  });
  return { segments, report: result.report, score, maxScore: 100, categories, correctedText: result.correctedText, level: result.level, usefulExpressions };
}

/**
 * Turns a raw word list into structured word entries via Gemini (the `wordFill`
 * profile). Returns the generated JSON text plus the word count, or an error code.
 */
export async function generateWordFill(input: { words: string; categories: string[]; defaultCategory?: string }): Promise<{ json: string; count: number }> {
  const stored = await readStored();
  if (!stored?.apiKey) throw new Error('MISSING_API_KEY');
  const profile = stored.profiles[AI_PROFILE_WORD_FILL];
  if (!profile?.model) throw new Error('MISSING_MODEL');

  const text = input.words.trim();
  if (!text) throw new Error('EMPTY_WORDS');
  if (text.length > MAX_WORD_FILL_CHARS) throw new Error('WORDS_TOO_LONG');

  const categoryLine = input.categories.length > 0
    ? input.categories.map((c) => `«${c}»`).join(', ')
    : input.defaultCategory
      ? `«${input.defaultCategory}»`
      : '(категорий пока нет — придумай короткие подходящие названия)';

  const prompt = `${profile.prompt}\n\nДоступные категории: ${categoryLine}.${input.defaultCategory ? ` Если в слове не указана категория — используй «${input.defaultCategory}».` : ''}\n\nСписок слов:\n${text}`;

  let response: Response | undefined;
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      response = await enqueueAI('word-fill', AI_PROFILE_WORD_FILL, () => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(profile.model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': stored.apiKey },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: AbortSignal.timeout(240_000),
      }), profile.model);
      const transient = response.status === 429 || response.status >= 500;
      if (!transient || attempt === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 2_000 * (attempt + 1)));
    }
  } catch (error) {
      if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) throw Object.assign(new Error('AI_TIMEOUT'), { model: profile.model, durationMs: (error as Error & { durationMs?: number }).durationMs });
    throw error;
  }
  if (!response) throw new Error('GEMINI_UNAVAILABLE');
  if (!response.ok) throw new AIServiceError(response.status === 401 || response.status === 403 ? 'INVALID_API_KEY' : 'GEMINI_UNAVAILABLE', { providerStatus: response.status, model: profile.model });

  const body = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> };
  const raw = body.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === 'string')?.text;
  if (typeof raw !== 'string') throw new Error('INVALID_AI_RESPONSE');

  const json = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { throw new Error('INVALID_AI_RESPONSE'); }
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('INVALID_AI_RESPONSE');
  if (parsed.length > MAX_WORD_FILL_WORDS) throw new Error('WORDS_TOO_MANY');

  return { json, count: parsed.length };
}

type AiWordInput = { id: string; de: string; ru: string };

async function generateBatchJson(profileId: string, words: AiWordInput[], context: string): Promise<unknown[]> {
  const stored = await readStored();
  if (!stored?.apiKey) throw new Error('MISSING_API_KEY');
  const profile = stored.profiles[profileId];
  if (!profile?.model) throw new Error('MISSING_MODEL');
  if (!words.length) throw new Error('EMPTY_WORDS');
  if (words.length > MAX_AI_BATCH_WORDS) throw new Error('WORDS_TOO_MANY');
  const batchSize = Math.max(10, Math.min(MAX_AI_BATCH_WORDS, Math.round(Number(profile.batchSize) || DEFAULT_AI_BATCH_SIZE)));
  const chunks: AiWordInput[][] = [];
  for (let i = 0; i < words.length; i += batchSize) chunks.push(words.slice(i, i + batchSize));
  const generate = async (chunk: AiWordInput[]) => {
    const prompt = `${profile.prompt}\n\n${context}\n\nСлова:\n${JSON.stringify(chunk)}`;
    return enqueueAI(profileId === AI_PROFILE_REQUIRED_CASE ? 'required-case' : 'category-redistribution', profileId, () => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(profile.model)}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': stored.apiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } }),
      signal: AbortSignal.timeout(240_000),
    }), profile.model);
  };
  const responses = await Promise.all(chunks.map(generate));
  const all: unknown[] = [];
  for (const response of responses) {
    if (!response.ok) throw new AIServiceError(response.status === 401 || response.status === 403 ? 'INVALID_API_KEY' : 'GEMINI_UNAVAILABLE', { providerStatus: response.status, model: profile.model });
    const body = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> };
    const raw = body.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === 'string')?.text;
    if (typeof raw !== 'string') throw new Error('INVALID_AI_RESPONSE');
    try {
      const parsed = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim());
      if (!Array.isArray(parsed)) throw new Error();
      all.push(...parsed);
    } catch { throw new Error('INVALID_AI_RESPONSE'); }
  }
  return all;
}

export async function redistributeCategories(words: AiWordInput[], categories: string[]): Promise<Array<{ id: string; categories: string[] }>> {
  const result = await generateBatchJson(AI_PROFILE_CATEGORY_REDISTRIBUTION, words, `Разрешённые категории: ${JSON.stringify(categories)}`);
  const normalizeCategoryName = (value: string): string => value.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
  const allowed = new Map(categories.map((category) => [normalizeCategoryName(category), category]));
  const expected = new Set(words.map((word) => word.id));
  if (result.length !== words.length) throw new Error('INVALID_AI_RESPONSE');
  const seen = new Set<string>();
  const normalized = result.map((item) => {
    if (typeof item !== 'object' || item === null) throw new Error('INVALID_AI_RESPONSE');
    const row = item as Record<string, unknown>;
    if (!Array.isArray(row.categories) || row.categories.length === 0 || row.categories.some((value) => typeof value !== 'string' || !allowed.has(normalizeCategoryName(value)))) {
      throw new Error('INVALID_AI_RESPONSE');
    }
    const names = row.categories.flatMap((value) => {
      const canonical = allowed.get(normalizeCategoryName(value as string));
      return canonical ? [canonical] : [];
    });
    if (typeof row.id !== 'string' || !expected.has(row.id) || seen.has(row.id) || names.length === 0) throw new Error('INVALID_AI_RESPONSE');
    seen.add(row.id);
    return { id: row.id, categories: [...new Set(names)] };
  });
  return normalized;
}

export async function detectRequiredCases(words: AiWordInput[]): Promise<Array<{ id: string; requiredCase: 'nominativ' | 'akkusativ' | 'dativ' | 'genitiv' | null }>> {
  const result = await generateBatchJson(AI_PROFILE_REQUIRED_CASE, words, 'Допустимые значения requiredCase: nominativ, akkusativ, dativ, genitiv или null.');
  const valid = new Set(['nominativ', 'akkusativ', 'dativ', 'genitiv']);
  const expected = new Set(words.map((word) => word.id));
  if (result.length !== words.length) throw new Error('INVALID_AI_RESPONSE');
  const seen = new Set<string>();
  const normalized = result.map((item) => {
    if (typeof item !== 'object' || item === null) throw new Error('INVALID_AI_RESPONSE');
    const row = item as Record<string, unknown>;
    if (typeof row.id !== 'string' || !expected.has(row.id) || seen.has(row.id) || (row.requiredCase !== null && typeof row.requiredCase !== 'string' || (typeof row.requiredCase === 'string' && !valid.has(row.requiredCase)))) throw new Error('INVALID_AI_RESPONSE');
    seen.add(row.id);
    return { id: row.id, requiredCase: row.requiredCase as 'nominativ' | 'akkusativ' | 'dativ' | 'genitiv' | null };
  });
  return normalized;
}
