import type { Category, PartOfSpeech, Word } from '../types';
import { request } from './request';

export type WordInput = Partial<Word>;
export type CategoryInput = Partial<Category>;
export interface BulkResult { success: boolean; count: number }
export const createWord = (word: WordInput) => request<Word>('/words', { method: 'POST', body: word, auth: true });
export const updateWord = (id: string, word: WordInput) => request<Word>(`/words/${id}`, { method: 'PUT', body: word, auth: true });
export const deleteWord = (id: string) => request<unknown>(`/words/${id}`, { method: 'DELETE', auth: true });
export const createCategory = (category: CategoryInput) => request<Category>('/categories', { method: 'POST', body: category, auth: true });
export const updateCategory = (id: string, category: CategoryInput) => request<Category>(`/categories/${id}`, { method: 'PUT', body: category, auth: true });
export const deleteCategory = (id: string) => request<unknown>(`/categories/${id}`, { method: 'DELETE', auth: true });
export const bulkSetCategory = (ids: string[], categoryId: string) => request<BulkResult>('/words/bulk/category', { method: 'POST', body: { ids, categoryId }, auth: true });
export const bulkSetPartOfSpeech = (ids: string[], partOfSpeech: PartOfSpeech | null) => request<BulkResult>('/words/bulk/part-of-speech', { method: 'POST', body: { ids, partOfSpeech }, auth: true });
export const bulkDeleteWords = (ids: string[]) => request<BulkResult>('/words/bulk/delete', { method: 'POST', body: { ids }, auth: true });
export const redistributeCategoriesViaAI = (ids: string[]) => request<BulkResult>('/words/ai/redistribute-categories', { method: 'POST', body: { ids }, auth: true });
export const detectRequiredCasesViaAI = (ids: string[]) => request<BulkResult>('/words/ai/required-case', { method: 'POST', body: { ids }, auth: true });

export interface DuplicateGroup { key: string; words: Word[] }
export const getDuplicates = () => request<{ groups: DuplicateGroup[]; total: number }>('/words/duplicates', { auth: true });
export const mergeDuplicates = (keepId: string, removeIds: string[]) => request<{ success: boolean; removed: number; filledFields: string[] }>('/words/duplicates/merge', { method: 'POST', body: { keepId, removeIds }, auth: true });

export interface ImportOptions { data: string; defaultCategoryId?: string; partOfSpeech?: PartOfSpeech; skipDuplicates?: boolean; dryRun?: boolean }
export interface ImportRowError { row: number; de?: string; message: string }
export interface ImportResult { success: boolean; dryRun: boolean; total: number; importedCount: number; duplicates: string[]; errors: ImportRowError[]; newCategories: string[] }
export const importWords = (options: ImportOptions) => request<ImportResult>('/words/import', { method: 'POST', body: options, auth: true });
export interface ImportPreviewRow { index: number; de: string; ru: string; category: string; partOfSpeech: PartOfSpeech | null; fields: Record<string, string>; status: 'ok' | 'duplicate' }
export interface ImportPreview { rows: ImportPreviewRow[]; errors: ImportRowError[]; categories: { name: string; icon?: string; color?: string }[]; total: number }
export const previewImport = (options: { data: string; defaultCategoryId?: string; partOfSpeech?: PartOfSpeech }) => request<ImportPreview>('/words/import/preview', { method: 'POST', body: options, auth: true });
export interface WordsExport { version: number; exportedAt: string; categories: { name: string; icon?: string | null; color?: string | null }[]; words: Record<string, string>[] }
export const exportWords = () => request<WordsExport>('/words/export', { auth: true });
