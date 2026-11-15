import { describe, expect, it } from 'vitest';
import { splitTranslations } from './translations';

describe('splitTranslations', () => {
  it('keeps separators inside parentheses', () => {
    expect(splitTranslations('ключ (от двери, замка), ключи / кнопка')).toEqual([
      'ключ (от двери, замка)',
      'ключи',
      'кнопка',
    ]);
  });

  it('supports nested parentheses', () => {
    expect(splitTranslations('слово (общее (разговорное), редко), вариант')).toEqual([
      'слово (общее (разговорное), редко)',
      'вариант',
    ]);
  });
});
