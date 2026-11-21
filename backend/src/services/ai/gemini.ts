import { AIServiceError, normalizeAIError } from '../aiErrorLog';
import { enqueueAI } from '../aiQueue';

export interface GeminiProfile {
  model: string;
  prompt: string;
}

export type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };

export async function callGemini(input: {
  profile: GeminiProfile;
  apiKey: string;
  parts: GeminiPart[];
  schema?: Record<string, unknown>;
  json?: boolean;
  timeout: number;
  operation: string;
  profileId: string;
  prompt: string;
}): Promise<Response> {
  const { profile, apiKey, parts, schema, json, timeout, operation, profileId, prompt } = input;
  let response: Response;
  try {
    response = await enqueueAI(
      operation,
      profileId,
      () =>
        fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(profile.model)}:generateContent`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify({
              contents: [{ parts }],
              ...(schema || json
                ? {
                    generationConfig: {
                      responseMimeType: 'application/json',
                      ...(schema ? { responseSchema: schema } : {}),
                    },
                  }
                : {}),
            }),
            signal: AbortSignal.timeout(timeout),
          },
        ),
      profile.model,
      { prompt },
    );
  } catch (error) {
    throw normalizeAIError(error, { model: profile.model, prompt });
  }

  if (!response.ok) {
    throw new AIServiceError('GEMINI_UNAVAILABLE', {
      providerStatus: response.status,
      model: profile.model,
      prompt,
      response: await response
        .clone()
        .text()
        .catch(() => undefined),
    });
  }
  return response;
}

export async function readGeminiText(response: Response): Promise<string> {
  const body = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>;
  };
  const text = body.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === 'string')?.text;
  if (typeof text !== 'string') throw new Error('INVALID_AI_RESPONSE');
  return text;
}
