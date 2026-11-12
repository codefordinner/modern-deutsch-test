/** Dispatched on `window` when the server rejects our admin session. */
export const UNAUTHORIZED_EVENT = 'api:unauthorized';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function getErrorMessage(error: unknown, fallback = 'Что-то пошло не так'): string {
  return error instanceof ApiError ? error.message : fallback;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  responseType?: 'json' | 'blob';
}

export async function request<T>(path: string, { method = 'GET', body, auth = false, responseType = 'json' }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Нет соединения с сервером', 0);
  }

  let data: unknown = null;
  try {
    data = !res.ok || responseType === 'json' ? await res.json() : await res.blob();
  } catch {
    // Reverse proxies can return an HTML 502/504 page instead of the JSON
    // error produced by our API. Never expose that page to the application.
    if (!res.ok && (res.status === 502 || res.status === 504)) {
      throw new ApiError('Сервер ИИ или прокси не дождался ответа. Проверьте очередь ИИ и попробуйте пакет меньшего размера.', res.status);
    }
  }

  if (!res.ok) {
    if (res.status === 401 && auth) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    const serverMessage = (data as { error?: unknown } | null)?.error;
    throw new ApiError(
      typeof serverMessage === 'string' && serverMessage ? serverMessage : `Ошибка сервера (${res.status})`,
      res.status
    );
  }

  if (data === null) throw new ApiError('Сервер вернул некорректный ответ', res.status);
  return data as T;
}
