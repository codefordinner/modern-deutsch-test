import { describe, expect, it } from 'vitest';
import { germanNumberVariants, numberToGerman } from './numbers-generator';

describe('German number edge cases', () => {
  it.each([
    [101, 'einhunderteins'],
    [1001, 'eintausendeins'],
    [100000, 'einhunderttausend'],
    [101000, 'einhunderteintausend'],
    [1000001, 'eine Million eins'],
  ])('formats %i without changing group boundaries', (value, expected) => {
    expect(numberToGerman(value)).toBe(expected);
  });

  it('allows dropped ein only at supported group boundaries', () => {
    expect(germanNumberVariants(101)).toContain('hunderteins');
    expect(germanNumberVariants(1001)).toContain('tausendeins');
    expect(germanNumberVariants(100000)).toContain('hunderttausend');
    expect(germanNumberVariants(101000)).not.toContain('einhunderttausend');
    expect(germanNumberVariants(1000001)).toEqual(['eine Million eins']);
  });
});
