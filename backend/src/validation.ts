import { z } from 'zod';

/** Shared zod schemas for request bodies (see middleware/validate.ts). */

const nullableString = z.string().trim().max(2000).nullable().optional();
const emptyableString = z.string().trim().max(2000).optional();
// `normalizeWordBody` (middleware) rewrites legacy 'ist'/'hat' to 'sein'/'haben'
// before validation, so only the canonical values (plus '' for "clear") are legal here.
const hilfsverbSchema = z.union([z.literal('haben'), z.literal('sein'), z.literal('')]).nullable().optional();

// A word's text fields are all optional strings; the API normalises '' to null.
export const wordFieldsSchema = {
  de: z.string().trim().min(1, 'немецкое слово не может быть пустым').max(500),
  ru: z.string().trim().min(1, 'перевод не может быть пустым').max(2000),
  hint: nullableString,
  plural: nullableString,
  feminine: nullableString,
  praeteritum: nullableString,
  partizip2: nullableString,
  hilfsverb: hilfsverbSchema,
  praesensIch: nullableString,
  praesensDu: nullableString,
  praesensErSieEs: nullableString,
  praesensWir: nullableString,
  praesensIhr: nullableString,
  praesensSie: nullableString,
};

// `partOfSpeech` accepts the five known values plus null/'' for "auto".
export const partOfSpeechSchema = z
  .union([z.enum(['noun', 'verb', 'adjective', 'adverb', 'other']), z.literal(''), z.null()])
  .optional();

const categoryIdsSchema = z.array(z.string().min(1)).min(1, 'нужна хотя бы одна категория').optional();
const categoryIdSchema = z.string().min(1).optional();

export const createWordSchema = z.object({
  de: wordFieldsSchema.de,
  ru: wordFieldsSchema.ru,
  hint: wordFieldsSchema.hint,
  partOfSpeech: partOfSpeechSchema,
  plural: wordFieldsSchema.plural,
  feminine: wordFieldsSchema.feminine,
  praeteritum: wordFieldsSchema.praeteritum,
  partizip2: wordFieldsSchema.partizip2,
  hilfsverb: wordFieldsSchema.hilfsverb,
  praesensIch: wordFieldsSchema.praesensIch,
  praesensDu: wordFieldsSchema.praesensDu,
  praesensErSieEs: wordFieldsSchema.praesensErSieEs,
  praesensWir: wordFieldsSchema.praesensWir,
  praesensIhr: wordFieldsSchema.praesensIhr,
  praesensSie: wordFieldsSchema.praesensSie,
  categoryIds: categoryIdsSchema,
  categoryId: categoryIdSchema,
});

// PUT may omit any field to leave it unchanged, so everything is optional.
// `ru` is a required DB column, so when present it must be a non-empty string.
export const updateWordSchema = z.object({
  de: z.string().trim().min(1, 'немецкое слово не может быть пустым').max(500).optional(),
  ru: z.string().trim().min(1, 'перевод не может быть пустым').max(2000).optional(),
  hint: nullableString,
  partOfSpeech: partOfSpeechSchema,
  plural: nullableString,
  feminine: nullableString,
  praeteritum: nullableString,
  partizip2: nullableString,
  hilfsverb: hilfsverbSchema,
  praesensIch: nullableString,
  praesensDu: nullableString,
  praesensErSieEs: nullableString,
  praesensWir: nullableString,
  praesensIhr: nullableString,
  praesensSie: nullableString,
  categoryIds: categoryIdsSchema,
  categoryId: categoryIdSchema,
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'название категории не может быть пустым').max(200),
  icon: z.string().max(20).optional(),
  color: z.string().max(30).optional(),
  isBuiltin: z.boolean().optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1, 'название категории не может быть пустым').max(200).optional(),
  icon: z.string().max(20).optional(),
  color: z.string().max(30).optional(),
});

export type CreateWordBody = z.infer<typeof createWordSchema>;
export type UpdateWordBody = z.infer<typeof updateWordSchema>;
export type CreateCategoryBody = z.infer<typeof createCategorySchema>;
export type UpdateCategoryBody = z.infer<typeof updateCategorySchema>;
