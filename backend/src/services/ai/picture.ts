import {
  AI_PROFILE_PICTURE_CHECK,
  AI_PROFILE_PICTURE_DESCRIPTION,
  AI_PROFILE_PICTURE_FORMAT,
  MAX_PICTURE_ANSWER_LENGTH,
  readStored,
} from '../aiSettings';
import type { PictureCheckResult, PictureCheckSeverity, PictureMetadata } from '../aiSettings';
import { callGemini, readGeminiText } from './gemini';

/** Generates editable Russian metadata for one picture. All Gemini calls stay in this module. */
export async function generatePictureMetadata(dataUrl: string): Promise<PictureMetadata> {
  const stored = await readStored();
  if (!stored?.apiKey) throw new Error('MISSING_API_KEY');
  const profile = stored.profiles[AI_PROFILE_PICTURE_DESCRIPTION];
  if (!profile?.model) throw new Error('MISSING_MODEL');
  const match = /^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error('INVALID_IMAGE');
  const response = await callGemini({
    profile,
    apiKey: stored.apiKey,
    profileId: AI_PROFILE_PICTURE_DESCRIPTION,
    operation: 'picture-description',
    prompt: profile.prompt,
    timeout: 60_000,
    parts: [{ text: profile.prompt }, { inline_data: { mime_type: match[1], data: match[2] } }],
    schema: {
      type: 'OBJECT',
      properties: { title: { type: 'STRING' }, description: { type: 'STRING' } },
      required: ['title', 'description'],
    },
  });
  const text = await readGeminiText(response);
  const jsonText = text
    .replace(/^```json\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('INVALID_AI_RESPONSE');
  }
  if (typeof parsed !== 'object' || parsed === null) throw new Error('INVALID_AI_RESPONSE');
  const result = parsed as Record<string, unknown>;
  if (
    typeof result.title !== 'string' ||
    typeof result.description !== 'string' ||
    !result.title.trim() ||
    !result.description.trim()
  )
    throw new Error('INVALID_AI_RESPONSE');
  return { title: result.title.trim().slice(0, 200), description: result.description.trim().slice(0, 5000) };
}

export async function formatPictureAnswer(answer: string): Promise<string> {
  const stored = await readStored();
  const profile = stored?.profiles[AI_PROFILE_PICTURE_FORMAT];
  if (!stored?.apiKey) throw new Error('MISSING_API_KEY');
  if (!profile?.model) throw new Error('MISSING_MODEL');
  if (!answer.trim()) throw new Error('EMPTY_ANSWER');
  if (answer.length > MAX_PICTURE_ANSWER_LENGTH) throw new Error('ANSWER_TOO_LONG');
  const prompt = `${profile.prompt}\n\nТекст пользователя:\n${answer}`;
  const response = await callGemini({
    profile,
    apiKey: stored.apiKey,
    profileId: AI_PROFILE_PICTURE_FORMAT,
    operation: 'picture-format',
    prompt,
    timeout: 120_000,
    parts: [{ text: prompt }],
  });
  const text = await readGeminiText(response);
  if (!text.trim()) throw new Error('INVALID_AI_RESPONSE');
  const formatted = text
    .replace(/^```(?:text)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  if (formatted.length > MAX_PICTURE_ANSWER_LENGTH) throw new Error('INVALID_AI_RESPONSE');
  const sourceWords = answer.match(/[\p{L}\p{N}]+/gu) ?? [];
  const formattedWords = formatted.match(/[\p{L}\p{N}]+/gu) ?? [];
  if (
    sourceWords.length !== formattedWords.length ||
    sourceWords.some((word, index) => word !== formattedWords[index])
  )
    throw new Error('INVALID_AI_RESPONSE');
  return formatted;
}

export async function checkPictureAnswer(input: {
  imageDataUrl: string;
  reference: string;
  answer: string;
  severity?: number;
}): Promise<PictureCheckResult> {
  const stored = await readStored();
  const profile = stored?.profiles[AI_PROFILE_PICTURE_CHECK];
  if (!stored?.apiKey) throw new Error('MISSING_API_KEY');
  if (!profile?.model) throw new Error('MISSING_MODEL');
  if (typeof input.answer !== 'string' || !input.answer.trim()) throw new Error('EMPTY_ANSWER');
  if (input.answer.length > MAX_PICTURE_ANSWER_LENGTH) throw new Error('ANSWER_TOO_LONG');
  const match = /^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,(.+)$/.exec(input.imageDataUrl);
  if (!match) throw new Error('INVALID_IMAGE');
  const prompt = `${profile.prompt}\n\nДля каждого сегмента с severity error|style|lie укажи поле correction — правильный немецкий вариант этого фрагмента (для остальных опускай).\n\nЖёсткость проверки: ${Math.max(1, Math.min(5, Math.round(input.severity || profile.severity || 3)))} из 5. Эталонное описание:\n${input.reference}\n\nОтвет пользователя:\n${input.answer}`;
  const response = await callGemini({
    profile,
    apiKey: stored.apiKey,
    profileId: AI_PROFILE_PICTURE_CHECK,
    operation: 'picture-check',
    prompt,
    timeout: 120_000,
    parts: [{ text: prompt }, { inline_data: { mime_type: match[1], data: match[2] } }],
    json: true,
  });
  const text = await readGeminiText(response);
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      text
        .replace(/^```json\s*/i, '')
        .replace(/\s*```$/, '')
        .trim(),
    );
  } catch {
    throw new Error('INVALID_AI_RESPONSE');
  }
  if (typeof parsed !== 'object' || parsed === null) throw new Error('INVALID_AI_RESPONSE');
  const result = parsed as Record<string, unknown>;
  if (
    !Array.isArray(result.segments) ||
    typeof result.report !== 'string' ||
    result.report.length > 5_000 ||
    !Number.isInteger(result.score)
  )
    throw new Error('INVALID_AI_RESPONSE');
  const segments = result.segments.map((segment) => {
    if (typeof segment !== 'object' || segment === null) throw new Error('INVALID_AI_RESPONSE');
    const item = segment as Record<string, unknown>;
    const severity = item.severity;
    if (
      typeof item.text !== 'string' ||
      !item.text ||
      !['neutral', 'good', 'style', 'error', 'lie'].includes(String(severity))
    )
      throw new Error('INVALID_AI_RESPONSE');
    if (item.note !== undefined && (typeof item.note !== 'string' || item.note.length > 500))
      throw new Error('INVALID_AI_RESPONSE');
    if (
      item.correction !== undefined &&
      (typeof item.correction !== 'string' || !item.correction.trim() || item.correction.length > 500)
    )
      throw new Error('INVALID_AI_RESPONSE');
    return {
      text: item.text,
      severity: severity as PictureCheckSeverity,
      ...(typeof item.note === 'string' ? { note: item.note } : {}),
      ...(typeof item.correction === 'string' ? { correction: item.correction.trim() } : {}),
    };
  });
  const covered = segments.map((segment) => segment.text).join('');
  if (covered !== input.answer) throw new Error('INVALID_AI_RESPONSE');
  if (typeof result.categories !== 'object' || result.categories === null)
    throw new Error('INVALID_AI_RESPONSE');
  const rawCategories = result.categories as Record<string, unknown>;
  const category = (key: string) => {
    const value = rawCategories[key];
    if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > 25)
      throw new Error('INVALID_AI_RESPONSE');
    return Number(value);
  };
  const categories = {
    content: category('content'),
    grammar: category('grammar'),
    vocabulary: category('vocabulary'),
    fluency: category('fluency'),
  };
  const score = categories.content + categories.grammar + categories.vocabulary + categories.fluency;
  if (result.score !== score) throw new Error('INVALID_AI_RESPONSE');
  if (typeof result.correctedText !== 'string' || result.correctedText.length > MAX_PICTURE_ANSWER_LENGTH)
    throw new Error('INVALID_AI_RESPONSE');
  if (typeof result.level !== 'string' || !/^(?:A[12]|B[12]|C1)$/.test(result.level))
    throw new Error('INVALID_AI_RESPONSE');
  if (
    !Array.isArray(result.usefulExpressions) ||
    result.usefulExpressions.length > 5 ||
    result.usefulExpressions.some(
      (item) => typeof item !== 'string' && (typeof item !== 'object' || item === null),
    )
  )
    throw new Error('INVALID_AI_RESPONSE');
  const usefulExpressions = result.usefulExpressions.map((item) => {
    if (typeof item === 'string') return item.trim().slice(0, 300);
    const object = item as Record<string, unknown>;
    const german = typeof object.german === 'string' ? object.german.trim() : '';
    const russian = typeof object.russian === 'string' ? object.russian.trim() : '';
    const value = german && russian ? `${german} — ${russian}` : german || russian;
    if (!value) throw new Error('INVALID_AI_RESPONSE');
    return value.slice(0, 300);
  });
  return {
    segments,
    report: result.report,
    score,
    maxScore: 100,
    categories,
    correctedText: result.correctedText,
    level: result.level,
    usefulExpressions,
  };
}
