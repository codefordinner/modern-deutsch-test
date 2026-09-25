import { getUISettings } from './uiSettings';

// How typed answers are compared with the expected ones. Everything here is
// about being forgiving with *typing*, never with *knowledge*: a missing letter
// or a wrong ending is still an error.
//
// Always ignored:
//  - capitalisation ("tisch" == "Tisch");
//  - leading/trailing, repeated and non-breaking spaces, zero-width characters;
//  - Unicode form: "ä" typed as "a" + combining diaeresis (macOS/iOS keyboards
//    and copy-paste do that) equals the precomposed "ä".
//
// Optional (see MatchOptions):
//  - ae/oe/ue/ss instead of ä/ö/ü/ß (a setting in "Общие настройки");
//  - "е" instead of "ё" in Russian answers.

export interface MatchOptions {
  /** Treat ae/oe/ue/ss as equal to ä/ö/ü/ß. */
  umlautSubstitutes?: boolean;
  /** Treat "е" as equal to "ё" (Russian). */
  foldYo?: boolean;
}

const INVISIBLE_CHARS = /[\u200B-\u200D\u2060\uFEFF]/g;
const UMLAUT_SUBSTITUTES: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };

/** Unicode-normalises and tidies whitespace; keeps the letters (and their case) as typed. */
export function cleanText(text: string): string {
  return text.normalize('NFC').replace(INVISIBLE_CHARS, '').replace(/\s+/g, ' ').trim();
}

/** The canonical form both sides of a comparison are reduced to. */
export function normalizeAnswer(text: string, options: MatchOptions = {}): string {
  let result = cleanText(text).toLowerCase();
  if (options.umlautSubstitutes) result = result.replace(/[äöüß]/g, (ch) => UMLAUT_SUBSTITUTES[ch]);
  if (options.foldYo) result = result.replace(/ё/g, 'е');
  return result;
}

/** Whether `user` equals `accepted` (or any of the accepted variants). An empty answer never matches. */
export function answersMatch(user: string, accepted: string | readonly string[], options: MatchOptions = {}): boolean {
  const typed = normalizeAnswer(user, options);
  if (!typed) return false;
  const variants = typeof accepted === 'string' ? [accepted] : accepted;
  return variants.some((variant) => normalizeAnswer(variant, options) === typed);
}

/** Matching options derived from the user's settings; call it when an answer is submitted. */
export function currentMatchOptions(extra: MatchOptions = {}): MatchOptions {
  return { umlautSubstitutes: getUISettings().acceptUmlautSubstitutes, ...extra };
}

/**
 * A whole number typed the way people write it: "1000", "1 000" or the German
 * "1.000" (thousands separators). Anything else — "42abc", "1.5", "" — is null.
 */
export function parseTypedInteger(text: string): number | null {
  const cleaned = cleanText(text).replace(/[’']/g, ' ');
  if (/^\d+$/.test(cleaned)) return Number(cleaned);
  if (/^\d{1,3}([. ]\d{3})+$/.test(cleaned)) return Number(cleaned.replace(/[. ]/g, ''));
  return null;
}
