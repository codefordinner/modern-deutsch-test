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

/** The server caps one page at this many words (see words.routes.ts). */
export const WORDS_PAGE_SIZE = 1000;
/** Safety net against a runaway loop: 50 pages = 50 000 words. */
const MAX_WORD_PAGES = 50;

/**
 * Loads EVERY word matching the query by following the server's pages, so the
 * dictionary never gets silently cut off at the page limit as it grows.
 * `total` is the server's count; `words.length < total` only if the safety cap was hit.
 */
export async function getAllWords({ categoryId, search }: Omit<WordsQuery, 'limit'> = {}): Promise<WordsPage> {
  const params = new URLSearchParams();
  if (categoryId) params.set('categoryId', categoryId);
  if (search) params.set('search', search);
  params.set('limit', String(WORDS_PAGE_SIZE));

  const words: Word[] = [];
  let total = 0;
  for (let page = 1; page <= MAX_WORD_PAGES; page++) {
    params.set('page', String(page));
    const result = await request<WordsPage>(`/words?${params.toString()}`);
    total = result.total;
    words.push(...result.words);
    if (result.words.length === 0 || words.length >= total) break;
  }
  return { words, total, page: 1, limit: words.length };
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

// ---- SRS box weights (server-wide setting) ----

export interface SrsWeightsResponse {
  /** Relative weights of Leitner boxes 1..5. */
  weights: number[];
  /** true = nothing saved yet, the built-in defaults are in use. */
  isDefault: boolean;
}

/** Public: every learner's browser reads the weights to pick the next card. */
export const fetchSrsWeights = () => request<SrsWeightsResponse>('/settings/srs-weights');

export const saveSrsWeights = (weights: number[]) =>
  request<SrsWeightsResponse>('/settings/srs-weights', { method: 'PUT', body: { weights }, auth: true });

/** Back to the built-in defaults. */
export const resetSrsWeights = () => request<SrsWeightsResponse>('/settings/srs-weights', { method: 'DELETE', auth: true });

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

// ---- Bulk operations ----

export interface BulkResult {
  success: boolean;
  count: number;
}

export const bulkSetCategory = (ids: string[], categoryId: string) =>
  request<BulkResult>('/words/bulk/category', { method: 'POST', body: { ids, categoryId }, auth: true });

export const bulkSetPartOfSpeech = (ids: string[], partOfSpeech: PartOfSpeech | null) =>
  request<BulkResult>('/words/bulk/part-of-speech', { method: 'POST', body: { ids, partOfSpeech }, auth: true });

export const bulkDeleteWords = (ids: string[]) =>
  request<BulkResult>('/words/bulk/delete', { method: 'POST', body: { ids }, auth: true });

// ---- Duplicates ----

export interface DuplicateGroup {
  /** Normalised German form shared by the words. */
  key: string;
  /** Oldest first. */
  words: Word[];
}

export const getDuplicates = () =>
  request<{ groups: DuplicateGroup[]; total: number }>('/words/duplicates', { auth: true });

export const mergeDuplicates = (keepId: string, removeIds: string[]) =>
  request<{ success: boolean; removed: number; filledFields: string[] }>('/words/duplicates/merge', {
    method: 'POST',
    body: { keepId, removeIds },
    auth: true,
  });

// ---- Bulk import / export ----

export interface ImportOptions {
  /** JSON (e.g. from an AI assistant) or plain text lines. */
  data: string;
  /** Used for rows that don't name a category themselves. */
  defaultCategoryId?: string;
  /** Applied to rows without their own `partOfSpeech`. */
  partOfSpeech?: PartOfSpeech;
  /** Skip words whose German form is already in the dictionary (default on the server: true). */
  skipDuplicates?: boolean;
  /** Only report what would happen; write nothing. */
  dryRun?: boolean;
}

export interface ImportRowError {
  /** 1-based position of the word in the pasted data. */
  row: number;
  de?: string;
  message: string;
}

export interface ImportResult {
  success: boolean;
  dryRun: boolean;
  /** Words found in the pasted data. */
  total: number;
  /** Words added (or, for a dry run, that would be added). */
  importedCount: number;
  /** German forms skipped because they already exist. */
  duplicates: string[];
  errors: ImportRowError[];
  /** Categories that were (or would be) created. */
  newCategories: string[];
}

export const importWords = (options: ImportOptions) =>
  request<ImportResult>('/words/import', { method: 'POST', body: options, auth: true });

export interface ImportPreviewRow {
  /** 1-based position in the pasted data. */
  index: number;
  de: string;
  ru: string;
  /** '' = no category given (and no default): the admin must pick one before importing. */
  category: string;
  partOfSpeech: PartOfSpeech | null;
  /** Remaining text fields (plural, hint, praeteritum, …). */
  fields: Record<string, string>;
  /** 'duplicate' = this German form is already in the dictionary or earlier in the pasted data. */
  status: 'ok' | 'duplicate';
}

export interface ImportPreview {
  rows: ImportPreviewRow[];
  /** Rows the server could not read at all. */
  errors: ImportRowError[];
  categories: { name: string; icon?: string; color?: string }[];
  total: number;
}

/** Parses and validates pasted data without writing anything. */
export const previewImport = (options: { data: string; defaultCategoryId?: string; partOfSpeech?: PartOfSpeech }) =>
  request<ImportPreview>('/words/import/preview', { method: 'POST', body: options, auth: true });

export interface WordsExport {
  version: number;
  exportedAt: string;
  categories: { name: string; icon?: string | null; color?: string | null }[];
  words: Record<string, string>[];
}

export const exportWords = () => request<WordsExport>('/words/export', { auth: true });

export async function getStats(): Promise<AnalyticsStats> {
  const data = await request<Partial<AnalyticsStats>>('/analytics/stats', { auth: true });
  // Defend against an old/mismatched backend build that doesn't return the expected shape.
  if (!Array.isArray(data.last7Days) || !Array.isArray(data.topTabs)) {
    throw new ApiError('Сервер вернул статистику в неожиданном формате', 200);
  }
  return data as AnalyticsStats;
}
