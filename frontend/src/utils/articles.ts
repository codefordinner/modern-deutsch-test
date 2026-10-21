import type { Word } from '../types';

export const ARTICLES = ['der', 'die', 'das'] as const;
export type Article = (typeof ARTICLES)[number];

const ARTICLE_NOUN = /^(der|die|das)\s+(\S.*)$/i;

/** "der Tisch" → { article: 'der', noun: 'Tisch' }; null when the entry has no leading article. */
export function splitArticle(de: string): { article: Article; noun: string } | null {
  const match = ARTICLE_NOUN.exec(de.trim());
  if (!match) return null;
  return { article: match[1].toLowerCase() as Article, noun: match[2].trim() };
}

/** Dictionary entries the articles trainer can ask about: nouns written with their article. */
export const isArticleNoun = (word: Word): boolean =>
  (word.partOfSpeech == null || word.partOfSpeech === 'noun') && splitArticle(word.de) !== null;

/** Leitner key of an articles card. Persisted in localStorage — don't change the format. */
export const articleSrsKey = (wordId: string): string => `${wordId}:article`;
