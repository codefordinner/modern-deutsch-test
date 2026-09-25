import type { PartOfSpeech, Word } from '../types';

export const PART_OF_SPEECH_OPTIONS: { value: PartOfSpeech; label: string }[] = [
  { value: 'noun', label: 'Существительное' },
  { value: 'verb', label: 'Глагол' },
  { value: 'adjective', label: 'Прилагательное' },
  { value: 'adverb', label: 'Наречие' },
  { value: 'other', label: 'Другое' },
];

/** Whether a dictionary entry belongs to the verbs trainer. */
export const isVerb = (word: Word): boolean => word.partOfSpeech === 'verb';
