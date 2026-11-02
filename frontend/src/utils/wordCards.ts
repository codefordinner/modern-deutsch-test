import type { Word, WordDirection, WordFormType } from '../types';
import { srsKeys } from './srs';
import { wordInAnyCategory } from './wordCategories';

export type DirectionMode = WordDirection | 'mixed';

export interface WordCard {
  word: Word;
  direction: WordDirection;
  formType: WordFormType;
  /** Leitner key of this card. */
  key: string;
}

export interface WordCardFilters {
  directionMode: DirectionMode;
  /** Category ids, or `['all']`. */
  selectedCats: string[];
  enableBase: boolean;
  enablePlural: boolean;
  enableFeminine: boolean;
}

/**
 * The single place that decides which cards the words trainer has. The quiz
 * draws from this list and the SRS screen counts progress over the very same
 * list, so the two can't disagree.
 *
 * Cards are built per WORD (not per category): a word that is in several of the selected
 * categories still yields one card per direction/form.
 */
export function buildWordCards(words: Word[], f: WordCardFilters): WordCard[] {
  if (f.selectedCats.length === 0) return [];
  const directions: WordDirection[] = f.directionMode === 'mixed' ? ['ru_to_de', 'de_to_ru'] : [f.directionMode];

  const cards: WordCard[] = [];
  for (const word of words) {
    if (!wordInAnyCategory(word, f.selectedCats)) continue;

    const forms: WordFormType[] = [];
    if (f.enableBase) forms.push('base');
    if (f.enablePlural && word.plural) forms.push('plural');
    if (f.enableFeminine && word.feminine) forms.push('feminine');
    // No fallback to 'base': a form the learner switched off is never asked, so the pool may be empty.

    for (const direction of directions) {
      for (const formType of forms) {
        cards.push({ word, direction, formType, key: srsKeys.word(word.id, direction, formType) });
      }
    }
  }
  return cards;
}
