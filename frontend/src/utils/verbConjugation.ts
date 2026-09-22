import type { Word } from '../types';

export const PRAESENS_PRONOUNS = ['ich', 'du', 'er/sie/es', 'wir', 'ihr', 'sie/Sie'] as const;
export type PraesensPronoun = (typeof PRAESENS_PRONOUNS)[number];

// "sein" is fully irregular, but its forms never change — they're safe to
// hardcode rather than treat as "missing data".
const SEIN_PRAESENS: Record<PraesensPronoun, string> = {
  ich: 'bin',
  du: 'bist',
  'er/sie/es': 'ist',
  wir: 'sind',
  ihr: 'seid',
  'sie/Sie': 'sind',
};

const PRONOUN_FIELD: Record<PraesensPronoun, keyof Word> = {
  ich: 'praesensIch',
  du: 'praesensDu',
  'er/sie/es': 'praesensErSieEs',
  wir: 'praesensWir',
  ihr: 'praesensIhr',
  'sie/Sie': 'praesensSie',
};

/**
 * Returns the verified present-tense (Präsens) form of `verb` for `pronoun`,
 * or `null` if we don't have reliable data for it.
 *
 * Not every word in the dictionary has every conjugated form filled in by
 * the admin, and German has too many irregular (strong) verbs to safely
 * guess a missing form from a regex pattern — a guessed "fahrst" instead of
 * the real "fährst" would silently teach the wrong German. So this never
 * invents a form:
 *  - "sein" is hardcoded above (fully irregular, but the forms are fixed
 *    and known, not a guess).
 *  - Otherwise, the admin-entered form is used if present.
 *  - "wir" and "sie/Sie" are the one case that's a genuine grammar rule
 *    rather than a guess: in standard German they always equal the
 *    infinitive (no exceptions besides "sein", handled above), so it's
 *    safe to use even when the admin hasn't filled that field in.
 *  - Everything else with no explicit data returns null, meaning: don't
 *    quiz this pronoun for this verb — we simply don't know it yet.
 */
export function getKnownPraesensForm(verb: Word, pronoun: string): string | null {
  if (verb.de === 'sein') return SEIN_PRAESENS[pronoun as PraesensPronoun] ?? null;

  const field = PRONOUN_FIELD[pronoun as PraesensPronoun];
  const explicit = field ? (verb[field] as string | null | undefined) : null;
  if (explicit) return explicit;

  if (pronoun === 'wir' || pronoun === 'sie/Sie') return verb.de;

  return null;
}

export interface PraesensCard {
  verb: Word;
  pronoun: PraesensPronoun;
  form: string;
}

/** Every (verb, pronoun) pair across `verbs` for which we have a reliable Präsens form. */
export function buildKnownPraesensCards(verbs: Word[]): PraesensCard[] {
  const cards: PraesensCard[] = [];
  for (const verb of verbs) {
    for (const pronoun of PRAESENS_PRONOUNS) {
      const form = getKnownPraesensForm(verb, pronoun);
      if (form) cards.push({ verb, pronoun, form });
    }
  }
  return cards;
}

/** Whether `verb` has both Stammformen (Präteritum + Partizip II) filled in — required for the "3 Formen" quiz. */
export function hasStammformen(verb: Word): boolean {
  return Boolean(verb.praeteritum && verb.partizip2);
}

/** Whether `verb` has a known Präteritum — required for the "Präteritum → Infinitiv" reverse card. */
export function hasPraeteritum(verb: Word): boolean {
  return Boolean(verb.praeteritum);
}

/** Whether `verb` has a known Partizip II — required for the multiple-choice quiz. */
export function hasPartizip2(verb: Word): boolean {
  return Boolean(verb.partizip2);
}
