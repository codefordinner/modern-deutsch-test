import type { AnalyticsStats, Category, Word, WordsPage } from '../types';

const TOKEN_KEY = 'admin_token';

/** Dispatched on `window` when the server rejects our admin token (expired / invalid). */
export const UNAUTHORIZED_EVENT = 'api:unauthorized';

// ---- Admin token storage ----

export const authToken = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // Storage unavailable (private mode…): the session just won't survive a reload.
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore
    }
  },
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
  /** Send the admin token; a 401 then means the session is gone and logs the admin out. */
  auth?: boolean;
}

async function request<T>(path: string, { method = 'GET', body, auth = false }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (auth) {
    const token = authToken.get();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
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
      authToken.clear();
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

export function login(password: string): Promise<{ token: string }> {
  return request<{ token: string }>('/admin/login', { method: 'POST', body: { password } });
}

/** Asks the server to drop the auth cookie (sent automatically); the token itself is discarded by the caller. */
export const logout = () => request<unknown>('/admin/logout', { method: 'POST' });

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

export const importWords = (data: string, defaultCategoryId: string) =>
  request<{ importedCount: number }>('/words/import', { method: 'POST', body: { data, defaultCategoryId }, auth: true });

export const exportWords = () => request<Word[]>('/words/export', { auth: true });

export async function getStats(): Promise<AnalyticsStats> {
  const data = await request<Partial<AnalyticsStats>>('/analytics/stats', { auth: true });
  // Defend against an old/mismatched backend build that doesn't return the expected shape.
  if (!Array.isArray(data.last7Days) || !Array.isArray(data.topTabs)) {
    throw new ApiError('Сервер вернул статистику в неожиданном формате', 200);
  }
  return data as AnalyticsStats;
}
