import type { AnalyticsStats, Category, PartOfSpeech, Word, WordsPage } from '../types';

/** Dispatched on `window` when the server rejects our admin session (expired / invalid). */
export const UNAUTHORIZED_EVENT = 'api:unauthorized';

const getToken = (): string | null => {
  try {
    return localStorage.getItem('admin_token');
  } catch {
    return null;
  }
};

const setToken = (token: string | null) => {
  try {
    if (token) localStorage.setItem('admin_token', token);
    else localStorage.removeItem('admin_token');
  } catch {
    // Storage unavailable
  }
};

// ---- Errors ----

export class ApiError extends Error {
  /** HTTP status, or 0 when the server could not be reached at all. */
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** A user-presentable message for anything thrown by the API layer. */
export function getErrorMessage(error: unknown, fallback = 'Что-то пошло не так'): string {
  return error instanceof ApiError ? error.message : fallback;
}

// ---- Core request helper ----

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  /** An admin call: a 401 then means the session is gone and logs the admin out. */
  auth?: boolean;
}

async function request<T>(path: string, { method = 'GET', body, auth = false }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      credentials: 'same-origin', // sends the session cookie
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Нет соединения с сервером', 0);
  }

  // Error payloads look like { error: '…' }; tolerate non-JSON bodies (proxy error pages etc.).
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // leave null
  }

  if (!res.ok) {
    if (res.status === 401 && auth) {
      setToken(null);
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    const serverMessage = (data as { error?: unknown } | null)?.error;
    throw new ApiError(
      typeof serverMessage === 'string' && serverMessage ? serverMessage : `Ошибка сервера (${res.status})`,
      res.status
    );
  }

  if (data === null) throw new ApiError('Сервер вернул некорректный ответ', res.status);
  return data as T;
}

// ---- Public endpoints ----

export interface WordsQuery {
  categoryId?: string;
  search?: string;
  limit?: number;
}

export function getWords({ categoryId, search, limit }: WordsQuery = {}): Promise<WordsPage> {
  const params = new URLSearchParams();
  if (categoryId) params.set('categoryId', categoryId);
  if (search) params.set('search', search);
  if (limit) params.set('limit', String(limit));
  const query = params.toString();
  return request<WordsPage>(`/words${query ? `?${query}` : ''}`);
}

export function getCategories(): Promise<Category[]> {
  return request<Category[]>('/categories');
}

/**
 * Fire-and-forget usage tracking. Analytics must never bother the learner, so
 * failures are deliberately swallowed here (the one place where that is right).
 */
export function trackEvent(eventType: string, trainerType?: string, isCorrect?: boolean): void {
  request('/analytics/event', { method: 'POST', body: { eventType, trainerType, isCorrect } }).catch(() => {});
}

// ---- Admin endpoints ----

/** Signs in; on success the server sets the session cookie. */
export async function login(password: string): Promise<{ success: boolean; token?: string }> {
  const result = await request<{ success: boolean; token?: string }>('/admin/login', { method: 'POST', body: { password } });
  if (result.token) setToken(result.token);
  return result;
}

/** Asks the server to drop the session cookie. */
export const logout = async () => {
  setToken(null);
  return request<unknown>('/admin/logout', { method: 'POST' });
};

/** Whether the browser currently holds a valid admin session (the cookie itself is invisible to scripts). */
export async function checkSession(): Promise<boolean> {
  const data = await request<{ authenticated?: boolean }>('/admin/check');
  return data.authenticated === true;
}

export type WordInput = Partial<Word>;
export type CategoryInput = Partial<Category>;

export const createWord = (word: WordInput) => request<Word>('/words', { method: 'POST', body: word, auth: true });
export const updateWord = (id: string, word: WordInput) =>
  request<Word>(`/words/${id}`, { method: 'PUT', body: word, auth: true });
export const deleteWord = (id: string) => request<unknown>(`/words/${id}`, { method: 'DELETE', auth: true });

export const createCategory = (category: CategoryInput) =>
  request<Category>('/categories', { method: 'POST', body: category, auth: true });
export const updateCategory = (id: string, category: CategoryInput) =>
  request<Category>(`/categories/${id}`, { method: 'PUT', body: category, auth: true });
export const deleteCategory = (id: string) => request<unknown>(`/categories/${id}`, { method: 'DELETE', auth: true });

export const importWords = (data: string, defaultCategoryId: string, partOfSpeech?: PartOfSpeech) =>
  request<{ importedCount: number }>('/words/import', {
    method: 'POST',
    body: { data, defaultCategoryId, partOfSpeech },
    auth: true,
  });

export const exportWords = () => request<Word[]>('/words/export', { auth: true });

export async function getStats(): Promise<AnalyticsStats> {
  const data = await request<Partial<AnalyticsStats>>('/analytics/stats', { auth: true });
  // Defend against an old/mismatched backend build that doesn't return the expected shape.
  if (!Array.isArray(data.last7Days) || !Array.isArray(data.topTabs)) {
    throw new ApiError('Сервер вернул статистику в неожиданном формате', 200);
  }
  return data as AnalyticsStats;
}
