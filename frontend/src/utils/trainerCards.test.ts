import { describe, expect, it } from 'vitest';
import type { Word } from '../types';
import { articleSrsKey, isArticleNoun } from './articles';
import { buildVerbCards, selectVerbCards } from './verbCards';
import { buildWordCards } from './wordCards';

const word = (values: Partial<Word> & Pick<Word, 'id' | 'de' | 'ru'>): Word => ({
  categoryId: 'daily',
  ...values,
});

describe('dictionary entries represented in trainer card pools', () => {
  it('creates every enabled word direction/form exactly once, including multi-category words', () => {
    const words = [
      word({ id: 'table', de: 'der Tisch', ru: 'стол', plural: 'die Tische', feminine: 'die Tischlerin', categoryIds: ['daily', 'work'] }),
      word({ id: 'water', de: 'das Wasser', ru: 'вода', categoryId: 'daily' }),
    ];
    const cards = buildWordCards(words, {
      directionMode: 'mixed', selectedCats: ['work'], enableBase: true, enablePlural: true, enableFeminine: true,
    });

    expect(cards).toHaveLength(6);
    expect(cards.map(({ key }) => key)).toHaveLength(new Set(cards.map(({ key }) => key)).size);
    expect(cards.every(({ word: entry }) => entry.id === 'table')).toBe(true);
    expect(buildWordCards(words, {
      directionMode: 'ru_to_de', selectedCats: ['all'], enableBase: true, enablePlural: true, enableFeminine: true,
    })).toHaveLength(4);
    expect(buildWordCards(words, {
      directionMode: 'ru_to_de', selectedCats: [], enableBase: true, enablePlural: true, enableFeminine: true,
    })).toEqual([]);
  });

  it('includes all available verb forms in their modes and does not fabricate missing conjugations', () => {
    const complete = word({
      id: 'lernen', de: 'lernen', ru: 'учить', partOfSpeech: 'verb',
      praesensIch: 'lerne', praesensDu: 'lernst', praesensErSieEs: 'lernt', praesensIhr: 'lernt',
      praeteritum: 'lernte', partizip2: 'gelernt', hilfsverb: 'haben',
    });
    const incomplete = word({ id: 'fahren', de: 'fahren', ru: 'ехать', partOfSpeech: 'verb' });
    const secondParticiple = word({ id: 'gehen', de: 'gehen', ru: 'идти', partOfSpeech: 'verb', partizip2: 'gegangen' });
    const cards = buildVerbCards([complete, incomplete, secondParticiple]);

    expect(cards.filter(({ verb, kind }) => verb.id === 'lernen' && kind === 'praesens')).toHaveLength(6);
    expect(cards.filter(({ verb, kind }) => verb.id === 'lernen' && kind === 'infinitive_from_praesens')).toHaveLength(4);
    expect(cards.filter(({ verb, kind }) => verb.id === 'lernen' && ['multiple_choice', 'infinitive_from_partizip2'].includes(kind))).toHaveLength(2);
    expect(cards.filter(({ verb, kind }) => verb.id === 'fahren' && kind === 'praesens')).toHaveLength(2);
    expect(cards.some(({ verb, kind }) => verb.id === 'fahren' && kind === 'infinitive_from_praesens')).toBe(false);
    expect(selectVerbCards(cards, 'multiple_choice', 'both').map(({ verb }) => verb.id).sort()).toEqual(['gehen', 'lernen']);
    expect(new Set(cards.map(({ key }) => key)).size).toBe(cards.length);
  });

  it('includes article cards only for noun entries with a German article', () => {
    const nouns = [
      word({ id: 'book', de: 'das Buch', ru: 'книга', partOfSpeech: 'noun' }),
      word({ id: 'old-book', de: 'Der alte Tisch', ru: 'старый стол' }),
      word({ id: 'verb', de: 'laufen', ru: 'бежать', partOfSpeech: 'verb' }),
      word({ id: 'no-article', de: 'Wasser', ru: 'вода', partOfSpeech: 'noun' }),
    ];
    const cards = nouns.filter(isArticleNoun).map(({ id }) => articleSrsKey(id));

    expect(cards).toEqual(['book:article', 'old-book:article']);
    expect(new Set(cards).size).toBe(cards.length);
  });
});
