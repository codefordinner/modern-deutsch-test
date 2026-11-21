import { prisma } from '../db';
import { AIServiceError, normalizeAIError, recordAIError } from './aiErrorLog';
import { configureAIRequestRateLimit, enqueueAI } from './aiQueue';

/** Central AI settings and model-catalog module; prompt-based operations live under ./ai. */
export const AI_SETTINGS_KEY = 'aiSettings';
export type GeminiModel = string;
export interface GeminiModelInfo {
  name: string;
  displayName: string;
  supportedGenerationMethods: string[];
}
export interface PictureMetadata {
  title: string;
  description: string;
}

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
export const AI_PROFILE_WORD_CHECK = 'wordCheck';
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
export interface WordCheckIssue {
  field: string;
  severity: 'error' | 'warning';
  message: string;
  suggestion?: string;
}
export type WordCheckField =
  | 'de'
  | 'ru'
  | 'hint'
  | 'partOfSpeech'
  | 'plural'
  | 'feminine'
  | 'praeteritum'
  | 'partizip2'
  | 'hilfsverb'
  | 'praesensIch'
  | 'praesensDu'
  | 'praesensErSieEs'
  | 'praesensWir'
  | 'praesensIhr'
  | 'praesensSie'
  | 'requiredCase';
export interface WordCheckCorrection {
  field: WordCheckField;
  value: string | null;
}
export interface WordCheckResult {
  id: string;
  issues: WordCheckIssue[];
  corrections: WordCheckCorrection[];
}
interface StoredAISettings {
  provider: 'gemini';
  apiKey: string;
  requestsPerMinute: number;
  profiles: Record<string, { model: GeminiModel; prompt: string; severity?: number; batchSize?: number }>;
}
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
export const DEFAULT_PICTURE_FORMAT_PROMPT =
  'Ты обрабатываешь распознанный голосом текст на немецком языке. Верни тот же текст без исправления слов, орфографии, грамматики или порядка слов. Разрешается только расставить пробелы, запятые и точки по смыслу. Не добавляй и не удаляй слова. Верни только готовый текст, без кавычек, пояснений и Markdown.';
export const DEFAULT_PICTURE_CHECK_PROMPT =
  'Ты проверяешь описание изображения, которое пользователь написал НА НЕМЕЦКОМ ЯЗЫКЕ. Эталонное описание и обратная связь на русском, пользовательский текст анализируй как немецкий. Проверь грамматику, артикли der/die/das, падежи, окончания, порядок слов, глаголы, лексику, орфографию и естественность. Отдельно отмечай фактическую ошибку или ложь. Проверяй факты по самому изображению, а не только по эталону (эталон может быть неполным). Не штрафуй за синонимы, другой естественный порядок слов и отсутствие деталей, которых пользователь не упомянул. Возвращай JSON. segments должны покрывать исходный текст непрерывно и дословно; для каждого сегмента с severity error|style|lie укажи поле correction — правильный немецкий вариант этого фрагмента (для нейтральных/хороших сегментов correction опускай); severity: neutral|good|style|error|lie. note на русском: называй правило и/или давай правильный пример (например, «здесь Dativ, верно: dem Mann»), а не общие слова. Одну и ту же ошибку, повторённую несколько раз (например, неверный артикль в каждой фразе), штрафуй один раз и отметь в report, что она повторяется. report на русском, доброжелательно и конкретно: сначала что удалось, затем что исправить с примерами, без общих фраз. correctedText — полный исправленный немецкий текст, если нужны исправления; если в ответе нет знаков препинания (пользователь диктовал голосом), расставь в correctedText запятые и точки по смыслу, не меняя при этом слова и их порядок без необходимости. categories — четыре целых оценки 0–25: content, grammar, vocabulary, fluency. Оценивай по эталону уровня B1: баллы должны отражать полноту, сложность и длину ответа, а не только отсутствие ошибок. Не давай баллы «впустую» — если пользователь написал 2–3 коротких простых предложения без ошибок, это всё равно низкий балл за content и fluency (ответ не раскрывает картинку), поэтому суммарный балл должен быть заметно ниже 60. Если описание настолько общее, что подходит к любой картинке и не называет ни одной конкретной детали, — снизь content и укажи это в report. level — примерный CEFR A1–C1; согласуй level с оценками и сложностью ответа: короткий простой безошибочный текст — не выше A2, развёрнутый ответ с разнообразной лексикой и сложными конструкциями — B1 и выше. usefulExpressions — массив до 5 строк, каждая строка вида «немецкое выражение — русский перевод» (тире-разделитель); подбирай выражения под эту картинку и уровень ученика, которые реально улучшили бы именно этот ответ. score — сумма категорий. Не добавляй в segments текст, которого нет в ответе.';
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
export const DEFAULT_CATEGORY_REDISTRIBUTION_PROMPT =
  'Ты распределяешь слова немецкого учебного словаря по существующим категориям. Верни только JSON-массив объектов {"id":"...","categories":["точное название категории"]}. Для каждого слова выбери одну или несколько наиболее подходящих категорий только из переданного списка. Не придумывай категории, не меняй id, не пропускай слова.';
export const DEFAULT_REQUIRED_CASE_PROMPT =
  'Ты определяешь управление немецких глаголов. Верни только JSON-массив объектов {"id":"...","requiredCase":"nominativ|akkusativ|dativ|genitiv|null"}. Выбери падеж, который требует глагол в типичном значении; если глагол не требует объекта или уверенности нет, верни null. Не угадывай, не меняй id и не пропускай слова.';
export const DEFAULT_WORD_CHECK_PROMPT =
  'Ты проверяешь и аккуратно исправляешь записи немецкого учебного словаря. Проверь именно переданные данные, не выдумывай отсутствующие формы. Для глаголов проверь Infinitiv, Präteritum, Partizip II, Hilfsverb, все Präsens-формы и управление (падеж). Проверь перевод и часть речи. Верни только JSON-массив объектов {"id":"...","issues":[{"field":"...","severity":"error|warning","message":"...","suggestion":"..."}],"corrections":[{"field":"...","value":"..."}]}. В corrections добавляй только исправления, в которых уверен: value — готовое новое значение поля; null разрешён только для необязательного поля, которое действительно нужно очистить. Никогда не исправляй наугад и не добавляй отсутствующие немецкие формы. Допустимые поля corrections: de, ru, hint, partOfSpeech, plural, feminine, praeteritum, partizip2, hilfsverb, praesensIch, praesensDu, praesensErSieEs, praesensWir, praesensIhr, praesensSie, requiredCase. Для partOfSpeech используй noun|verb|adjective|adverb|other|null, для hilfsverb — haben|sein|null, для requiredCase — nominativ|akkusativ|dativ|genitiv|null. Если проблем нет, issues=[] и corrections=[]; не меняй id и не пропускай записи. Сообщения на русском, немецкие формы — только если уверен.';
export const MAX_PICTURE_ANSWER_LENGTH = 10_000;
export const MAX_WORD_FILL_CHARS = 50_000;
export const MAX_WORD_FILL_WORDS = 1000;
export const MAX_AI_BATCH_WORDS = 5000;
export const DEFAULT_AI_BATCH_SIZE = 100;

export const PROFILES = {
  [AI_PROFILE_PICTURE_DESCRIPTION]: {
    defaultPrompt: DEFAULT_PICTURE_PROMPT,
    hasSeverity: false,
    hasBatch: false,
  },
  [AI_PROFILE_PICTURE_FORMAT]: {
    defaultPrompt: DEFAULT_PICTURE_FORMAT_PROMPT,
    hasSeverity: false,
    hasBatch: false,
  },
  [AI_PROFILE_PICTURE_CHECK]: {
    defaultPrompt: DEFAULT_PICTURE_CHECK_PROMPT,
    hasSeverity: true,
    hasBatch: false,
  },
  [AI_PROFILE_WORD_FILL]: { defaultPrompt: DEFAULT_WORD_FILL_PROMPT, hasSeverity: false, hasBatch: false },
  [AI_PROFILE_CATEGORY_REDISTRIBUTION]: {
    defaultPrompt: DEFAULT_CATEGORY_REDISTRIBUTION_PROMPT,
    hasSeverity: false,
    hasBatch: true,
  },
  [AI_PROFILE_REQUIRED_CASE]: {
    defaultPrompt: DEFAULT_REQUIRED_CASE_PROMPT,
    hasSeverity: false,
    hasBatch: true,
  },
  [AI_PROFILE_WORD_CHECK]: { defaultPrompt: DEFAULT_WORD_CHECK_PROMPT, hasSeverity: false, hasBatch: true },
} as const;
export type AIProfileId = keyof typeof PROFILES;

export function isGeminiModel(value: unknown): value is GeminiModel {
  return (
    typeof value === 'string' && /^gemini-[a-z0-9][a-z0-9.-]*$/i.test(value.trim()) && value.length <= 200
  );
}

function isValidApiKey(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length >= 10 && value.length <= 500;
}

function defaultProfiles(): StoredAISettings['profiles'] {
  return Object.fromEntries(
    Object.entries(PROFILES).map(([id, config]) => [
      id,
      {
        model: DEFAULT_MODEL,
        prompt: config.defaultPrompt,
        ...(config.hasSeverity ? { severity: 3 } : {}),
        ...(config.hasBatch ? { batchSize: DEFAULT_AI_BATCH_SIZE } : {}),
      },
    ]),
  ) as StoredAISettings['profiles'];
}

function sanitizeStored(value: unknown): StoredAISettings | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (
    raw.provider !== 'gemini' ||
    (raw.model !== undefined && raw.model !== '' && !isGeminiModel(raw.model)) ||
    !isValidApiKey(raw.apiKey)
  )
    return null;
  const legacyPrompt =
    typeof raw.prompt === 'string' && raw.prompt.trim()
      ? raw.prompt.trim().slice(0, 10_000)
      : DEFAULT_PICTURE_PROMPT;
  const profiles =
    typeof raw.profiles === 'object' && raw.profiles !== null
      ? (raw.profiles as Record<string, Record<string, unknown>>)
      : {};
  const legacyModel = typeof raw.model === 'string' && isGeminiModel(raw.model) ? raw.model.trim() : '';
  const batchSizeOf = (profile: { batchSize?: number } | undefined) =>
    Math.max(
      10,
      Math.min(MAX_AI_BATCH_WORDS, Math.round(Number(profile?.batchSize) || DEFAULT_AI_BATCH_SIZE)),
    );
  const requestsPerMinute = Math.max(
    1,
    Math.min(60, Math.round(Number(raw.requestsPerMinute) || DEFAULT_AI_REQUESTS_PER_MINUTE)),
  );
  const cleanProfiles = Object.fromEntries(
    Object.entries(PROFILES).map(([id, config]) => {
      const profile = profiles[id];
      const model =
        typeof profile?.model === 'string' && isGeminiModel(profile.model)
          ? profile.model.trim()
          : legacyModel;
      const prompt =
        typeof profile?.prompt === 'string' && profile.prompt.trim()
          ? profile.prompt.trim().slice(0, 10_000)
          : id === AI_PROFILE_PICTURE_DESCRIPTION
            ? legacyPrompt
            : config.defaultPrompt;
      return [
        id,
        {
          model,
          prompt,
          ...(config.hasSeverity
            ? { severity: Math.max(1, Math.min(5, Math.round(Number(profile?.severity) || 3))) }
            : {}),
          ...(config.hasBatch ? { batchSize: batchSizeOf(profile) } : {}),
        },
      ];
    }),
  );
  return {
    provider: 'gemini',
    apiKey: raw.apiKey.trim(),
    requestsPerMinute,
    profiles: cleanProfiles as StoredAISettings['profiles'],
  };
}

export async function readStored(): Promise<StoredAISettings | null> {
  const row = await prisma.setting.findUnique({ where: { key: AI_SETTINGS_KEY } });
  if (!row) return null;
  try {
    return sanitizeStored(JSON.parse(row.value));
  } catch {
    return null;
  }
}

async function readConfigured(): Promise<StoredAISettings | null> {
  const value = await readStored();
  configureAIRequestRateLimit(value?.requestsPerMinute ?? DEFAULT_AI_REQUESTS_PER_MINUTE);
  return value;
}

export async function readAISettings(): Promise<AISettingsPublic> {
  const stored = await readConfigured();
  return {
    provider: 'gemini',
    hasApiKey: Boolean(stored?.apiKey),
    isDefault: !stored,
    requestsPerMinute: stored?.requestsPerMinute ?? DEFAULT_AI_REQUESTS_PER_MINUTE,
    profiles: stored?.profiles ?? defaultProfiles(),
  };
}

export async function writeAISettings(input: {
  apiKey?: unknown;
  profiles: Record<string, { model?: unknown; prompt?: unknown; severity?: unknown; batchSize?: unknown }>;
  requestsPerMinute?: unknown;
}): Promise<AISettingsPublic> {
  const current = await readStored();
  const apiKey = input.apiKey === undefined || input.apiKey === '' ? current?.apiKey : input.apiKey;
  if (!isValidApiKey(apiKey)) throw new Error('INVALID_API_KEY');
  const profiles = Object.fromEntries(
    Object.entries(PROFILES).map(([id, config]) => {
      const supplied = input.profiles[id];
      const old = current?.profiles[id];
      const model = supplied?.model === undefined ? (old?.model ?? '') : supplied.model;
      if (model !== '' && !isGeminiModel(model)) throw new Error('INVALID_MODEL');
      const prompt = supplied?.prompt === undefined ? (old?.prompt ?? config.defaultPrompt) : supplied.prompt;
      if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 10_000)
        throw new Error('INVALID_PROMPT');
      return [
        id,
        {
          model,
          prompt: prompt.trim(),
          ...(config.hasSeverity
            ? {
                severity: Math.max(
                  1,
                  Math.min(5, Math.round(Number(supplied?.severity ?? old?.severity) || 3)),
                ),
              }
            : {}),
          ...(config.hasBatch
            ? {
                batchSize: Math.max(
                  10,
                  Math.min(
                    MAX_AI_BATCH_WORDS,
                    Math.round(Number(supplied?.batchSize ?? old?.batchSize) || DEFAULT_AI_BATCH_SIZE),
                  ),
                ),
              }
            : {}),
        },
      ];
    }),
  );
  const requestsPerMinute = Math.max(
    1,
    Math.min(
      60,
      Math.round(
        Number(input.requestsPerMinute ?? current?.requestsPerMinute) || DEFAULT_AI_REQUESTS_PER_MINUTE,
      ),
    ),
  );
  const value: StoredAISettings = {
    provider: 'gemini',
    apiKey: apiKey.trim(),
    requestsPerMinute,
    profiles: profiles as StoredAISettings['profiles'],
  };
  configureAIRequestRateLimit(requestsPerMinute);
  await prisma.setting.upsert({
    where: { key: AI_SETTINGS_KEY },
    create: { key: AI_SETTINGS_KEY, value: JSON.stringify(value) },
    update: { value: JSON.stringify(value) },
  });
  return {
    provider: 'gemini',
    hasApiKey: true,
    isDefault: false,
    requestsPerMinute,
    profiles: value.profiles,
  };
}

export async function resetAIProfile(profileId: string): Promise<AISettingsPublic> {
  if (!(profileId in PROFILES)) throw new Error('INVALID_PROFILE');
  const current = await readStored();
  if (!current) return readAISettings();
  const currentProfile = current.profiles[profileId];
  const config = PROFILES[profileId as AIProfileId];
  const profile = {
    model: currentProfile?.model ?? '',
    prompt: config.defaultPrompt,
    ...(config.hasSeverity ? { severity: currentProfile?.severity ?? 3 } : {}),
    ...(config.hasBatch ? { batchSize: currentProfile?.batchSize ?? DEFAULT_AI_BATCH_SIZE } : {}),
  };
  const value: StoredAISettings = { ...current, profiles: { ...current.profiles, [profileId]: profile } };
  await prisma.setting.upsert({
    where: { key: AI_SETTINGS_KEY },
    create: { key: AI_SETTINGS_KEY, value: JSON.stringify(value) },
    update: { value: JSON.stringify(value) },
  });
  return {
    provider: 'gemini',
    hasApiKey: true,
    isDefault: false,
    requestsPerMinute: value.requestsPerMinute,
    profiles: value.profiles,
  };
}

async function readApiKey(): Promise<string | null> {
  const stored = await readConfigured();
  return stored?.apiKey ?? null;
}

/** Gets the current model catalog from Gemini. It never calls generateContent. */
export async function fetchGeminiModels(apiKey?: string): Promise<GeminiModelInfo[]> {
  const key = apiKey ?? (await readApiKey());
  if (!key) throw new Error('MISSING_API_KEY');
  try {
    const response = await enqueueAI('models', undefined, () =>
      fetch('https://generativelanguage.googleapis.com/v1beta/models', {
        headers: { 'x-goog-api-key': key },
        signal: AbortSignal.timeout(15_000),
      }),
    );
    if (!response.ok)
      throw new AIServiceError(
        response.status === 401 || response.status === 403 ? 'INVALID_API_KEY' : 'GEMINI_UNAVAILABLE',
        {
          providerStatus: response.status,
          response: await response
            .clone()
            .text()
            .catch(() => undefined),
        },
      );
    const body = (await response.json()) as {
      models?: Array<{ name?: unknown; displayName?: unknown; supportedGenerationMethods?: unknown }>;
    };
    return (body.models ?? []).flatMap((model) => {
      const fullName = typeof model.name === 'string' ? model.name : '';
      const name = fullName.startsWith('models/') ? fullName.slice('models/'.length) : fullName;
      const methods = Array.isArray(model.supportedGenerationMethods)
        ? model.supportedGenerationMethods.filter((item): item is string => typeof item === 'string')
        : [];
      if (!isGeminiModel(name) || !methods.includes('generateContent')) return [];
      return [
        {
          name,
          displayName: typeof model.displayName === 'string' ? model.displayName : name,
          supportedGenerationMethods: methods,
        },
      ];
    });
  } catch (error) {
    const normalized = normalizeAIError(error);
    await recordAIError({ operation: 'models', error: normalized });
    throw normalized;
  }
}

export async function checkAISettings(): Promise<{
  ok: boolean;
  message: string;
  settings: AISettingsPublic;
  models: GeminiModelInfo[];
}> {
  const settings = await readAISettings();
  if (!settings.hasApiKey) return { ok: false, message: 'Ключ Gemini не задан', settings, models: [] };
  try {
    const models = await fetchGeminiModels();
    return {
      ok: true,
      message: `Подключение Gemini работает. Доступно моделей: ${models.length}.`,
      settings,
      models,
    };
  } catch (error) {
    // Checking the catalog is a connectivity probe, not a prompt-based AI call.
    const message =
      error instanceof Error && error.message === 'INVALID_API_KEY'
        ? 'Ключ Gemini недействителен или не имеет доступа.'
        : 'Не удалось получить список моделей Gemini.';
    return { ok: false, message, settings, models: [] };
  }
}

export { generatePictureMetadata, formatPictureAnswer, checkPictureAnswer } from './ai/picture';
export { generateWordFill, redistributeCategories, detectRequiredCases, checkWordsWithAI } from './ai/words';
