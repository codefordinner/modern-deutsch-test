import { describe, expect, it } from 'vitest';
import { addDictationPunctuation } from './dictation';

describe('addDictationPunctuation', () => {
  it('turns spoken punctuation words into punctuation marks', () => {
    expect(addDictationPunctuation('ich sehe einen hund punkt')).toBe('Ich sehe einen hund.');
  });

  it('handles Komma', () => {
    expect(addDictationPunctuation('ein mann komma eine frau')).toBe('Ein mann, eine frau');
  });

  it('capitalises the first word and after a sentence end', () => {
    expect(addDictationPunctuation('das wetter ist schön punkt dann kommt regen')).toBe('Das wetter ist schön. Dann kommt regen');
  });

  it('keeps an already written prefix intact', () => {
    expect(addDictationPunctuation('Er läuft')).toBe('Er läuft');
  });

  it('does not capitalise when continuing a mid-sentence prefix', () => {
    expect(addDictationPunctuation('und eine katze', false)).toBe('und eine katze');
  });

  it('handles Fragezeichen and Ausrufezeichen', () => {
    expect(addDictationPunctuation('wo ist das fragezeichen')).toBe('Wo ist das?');
    expect(addDictationPunctuation('das ist toll ausrufezeichen')).toBe('Das ist toll!');
  });

  it('does not disturb a trailing punctuation mark', () => {
    expect(addDictationPunctuation('und dann gehen wir weg punkt')).toBe('Und dann gehen wir weg.');
  });

  it('returns empty for empty input', () => {
    expect(addDictationPunctuation('')).toBe('');
  });
});
