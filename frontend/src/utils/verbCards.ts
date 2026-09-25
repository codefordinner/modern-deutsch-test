import type { Word } from '../types';
import { srsKeys } from './srs';
import { buildKnownPraesensCards, hasPartizip2, hasPraeteritum, hasStammformen } from './verbConjugation';
import type { PraesensPronoun } from './verbConjugation';

// The single place that decides which flash cards the verbs trainer has. The
// quiz engine draws its questions from these cards and the SRS screen counts
// its Leitner boxes over the very same list, so the two can never disagree.
//
// Not every verb has every form filled in and Präsens forms are never guessed
// (see verbConjugation.ts), so a verb only yields the cards it can really answer.

export type VerbQuizMode = 'praesens' | 'stammformen' | 'multiple_choice';

// Within the "Спряжение / Форма → Инфинитив" mode:
//  - 'praesens'           only the forward direction: infinitive + pronoun → Präsens form;
//  - 'form_to_infinitive' only the reverse directions: a form → the infinitive
//                         (a Präsens form per pronoun, Präteritum or Partizip II);
//  - 'both'               either direction, drawn at random per question.
export type PraesensSubMode = 'praesens' | 'form_to_infinitive' | 'both';

export type VerbCardKind =
  | 'praesens' //                    infinitive + pronoun → Präsens form
  | 'stammformen' //                 infinitive → Präteritum + Partizip II + Hilfsverb
  | 'multiple_choice' //             infinitive → the right Partizip II out of several
  | 'infinitive_from_praesens' //    Präsens form (+ pronoun) → infinitive
  | 'infinitive_from_praeteritum' // Präteritum → infinitive
  | 'infinitive_from_partizip2'; //  Partizip II → infinitive

export interface VerbCard {
  kind: VerbCardKind;
  verb: Word;
  /** Leitner key of this card; each card has its own independent box. */
  key: string;
  /** Präsens cards only. */
  pronoun?: PraesensPronoun;
  /** The Präsens form to produce ('praesens') or the form shown to the learner ('infinitive_from_*'). */
  form?: string;
}

/** A multiple-choice question needs at least one wrong option, i.e. a second Partizip II form. */
export const MIN_DISTINCT_PARTIZIP2_FOR_TEST = 2;

/** Every card the given verbs can be quizzed on, across all modes. */
export function buildVerbCards(verbs: Word[]): VerbCard[] {
  const cards: VerbCard[] = [];

  const praesens = buildKnownPraesensCards(verbs);
  for (const { verb, pronoun, form } of praesens) {
    cards.push({ kind: 'praesens', verb, pronoun, form, key: srsKeys.verb.praesens(verb.id, pronoun) });
  }
  for (const { verb, pronoun, form } of praesens) {
    cards.push({
      kind: 'infinitive_from_praesens',
      verb,
      pronoun,
      form,
      key: srsKeys.verb.formToInfinitive(verb.id, 'praesens', pronoun),
    });
  }

  for (const verb of verbs) {
    if (hasStammformen(verb)) cards.push({ kind: 'stammformen', verb, key: srsKeys.verb.stammformen(verb.id) });
  }
  // The options are other verbs' Partizip II forms, so the question only makes
  // sense once there are at least two different forms in the dictionary.
  const distinctPartizip2 = new Set(verbs.filter(hasPartizip2).map((v) => (v.partizip2 as string).trim().toLowerCase()));
  if (distinctPartizip2.size >= MIN_DISTINCT_PARTIZIP2_FOR_TEST) {
    for (const verb of verbs) {
      if (hasPartizip2(verb)) cards.push({ kind: 'multiple_choice', verb, key: srsKeys.verb.multipleChoice(verb.id) });
    }
  }
  for (const verb of verbs) {
    if (hasPraeteritum(verb)) {
      cards.push({
        kind: 'infinitive_from_praeteritum',
        verb,
        form: verb.praeteritum as string,
        key: srsKeys.verb.formToInfinitive(verb.id, 'praeteritum'),
      });
    }
  }
  for (const verb of verbs) {
    if (hasPartizip2(verb)) {
      cards.push({
        kind: 'infinitive_from_partizip2',
        verb,
        form: verb.partizip2 as string,
        key: srsKeys.verb.formToInfinitive(verb.id, 'partizip2'),
      });
    }
  }

  return cards;
}

const REVERSE_KINDS: ReadonlySet<VerbCardKind> = new Set([
  'infinitive_from_praesens',
  'infinitive_from_praeteritum',
  'infinitive_from_partizip2',
]);

export const isReverseCard = (kind: VerbCardKind): boolean => REVERSE_KINDS.has(kind);

/** Whether a card of this kind may be asked in the given quiz mode (and Präsens sub-mode). */
export function isCardInSelection(kind: VerbCardKind, mode: VerbQuizMode, subMode: PraesensSubMode): boolean {
  if (mode === 'stammformen') return kind === 'stammformen';
  if (mode === 'multiple_choice') return kind === 'multiple_choice';
  if (kind === 'praesens') return subMode === 'praesens' || subMode === 'both';
  return isReverseCard(kind) && (subMode === 'form_to_infinitive' || subMode === 'both');
}

/** The cards the trainer draws from for the given mode. An empty result means "nothing to ask yet". */
export function selectVerbCards(cards: VerbCard[], mode: VerbQuizMode, subMode: PraesensSubMode): VerbCard[] {
  return cards.filter((card) => isCardInSelection(card.kind, mode, subMode));
}
