// German Numbers Generator & Validator

const ONES: Record<number, string> = {
  0: 'null',
  1: 'eins',
  2: 'zwei',
  3: 'drei',
  4: 'vier',
  5: 'fünf',
  6: 'sechs',
  7: 'sieben',
  8: 'acht',
  9: 'neun',
  10: 'zehn',
  11: 'elf',
  12: 'zwölf',
  13: 'dreizehn',
  14: 'vierzehn',
  15: 'fünfzehn',
  16: 'sechzehn',
  17: 'siebzehn',
  18: 'achtzehn',
  19: 'neunzehn',
};

const TENS: Record<number, string> = {
  2: 'zwanzig',
  3: 'dreißig',
  4: 'vierzig',
  5: 'fünfzig',
  6: 'sechzig',
  7: 'siebzig',
  8: 'achtzig',
  9: 'neunzig',
};

// Converts numbers under 100 to German.
// `isPartOfLarger`: the number is followed by a multiplier ("…tausend"), so a final 1 is "ein", not "eins".
export function twoDigitToGerman(n: number, isPartOfLarger = false): string {
  if (n < 0 || n > 99) return '';
  if (n === 0) return isPartOfLarger ? '' : 'null';
  if (n === 1) return isPartOfLarger ? 'ein' : 'eins';
  if (n < 20) return ONES[n];

  const ten = Math.floor(n / 10);
  const unit = n % 10;

  if (unit === 0) return TENS[ten];
  const unitStr = unit === 1 ? 'ein' : ONES[unit];
  return `${unitStr}und${TENS[ten]}`;
}

// Converts numbers under 1000 to German
export function threeDigitToGerman(n: number, isPartOfLarger = false): string {
  if (n < 0 || n > 999) return '';
  if (n < 100) return twoDigitToGerman(n, isPartOfLarger);

  const hundred = Math.floor(n / 100);
  const remainder = n % 100;
  const hundredStr = (hundred === 1 ? 'ein' : ONES[hundred]) + 'hundert';

  if (remainder === 0) return hundredStr;
  return hundredStr + twoDigitToGerman(remainder, isPartOfLarger);
}

// Full converter for 0 to 999 999 999
export function numberToGerman(n: number): string {
  if (n === 0) return 'null';
  if (n < 0 || !Number.isFinite(n) || n > 999999999) return String(n);

  let result = '';

  // Millions
  const millions = Math.floor(n / 1000000);
  const remainderAfterMillions = n % 1000000;

  if (millions > 0) {
    if (millions === 1) {
      result += 'eine Million';
    } else {
      result += `${threeDigitToGerman(millions, false)} Millionen`;
    }
    if (remainderAfterMillions > 0) {
      result += ' ';
    }
  }

  // Thousands: a final 1 of the group is "ein" ("einhunderteintausend"), only "eintausend" itself is special-cased.
  const thousands = Math.floor(remainderAfterMillions / 1000);
  const remainderAfterThousands = remainderAfterMillions % 1000;

  if (thousands > 0) {
    if (thousands === 1) {
      result += 'eintausend';
    } else {
      result += `${threeDigitToGerman(thousands, true)}tausend`;
    }
  }

  // Hundreds & units: nothing follows, so a final 1 is "eins" ("eintausendeins").
  if (remainderAfterThousands > 0) {
    result += threeDigitToGerman(remainderAfterThousands, false);
  }

  return result;
}

export const numberToGermanWords = numberToGerman;

/**
 * Every accepted spelling of `n`: the canonical one from `numberToGerman` plus
 * the common ones where the leading "ein" of "einhundert" / "eintausend" is
 * dropped ("hundert", "tausend", "tausendhundert", "eine Million hunderttausend").
 *
 * The "ein" is only optional when the word starts the number, starts a group
 * after a space ("Million eintausend"), or sits right after "tausend" — NOT
 * after "hundert": "hunderteintausend" is 101 000, but "einhunderttausend" is 100 000.
 */
export function germanNumberVariants(n: number): string[] {
  const canonical = numberToGerman(n);
  const optionalEin = /(?<=^|\s)ein(?=hundert|tausend)|(?<=tausend)ein(?=hundert)/g;
  const positions = Array.from(canonical.matchAll(optionalEin), (m) => m.index as number);

  const variants = new Set<string>([canonical]);
  for (let mask = 1; mask < 1 << positions.length; mask++) {
    let text = '';
    let last = 0;
    positions.forEach((position, i) => {
      if (mask & (1 << i)) {
        text += canonical.slice(last, position);
        last = position + 'ein'.length;
      }
    });
    variants.add(text + canonical.slice(last));
  }
  return Array.from(variants);
}

export function normalizeGermanAnswer(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/ß/g, 'ss'); // Allow forgiving ss / ß
}

export function isGermanNumberMatch(userInput: string, expectedWord: string): boolean {
  const normUser = normalizeGermanAnswer(userInput);
  const normExpected = normalizeGermanAnswer(expectedWord);

  // Exact or normalized match
  if (normUser === normExpected) return true;

  // Sometimes user puts spaces inside German compounds (e.g. "zwei hundert" or "drei und siebzig")
  const strippedUser = normUser.replace(/\s+/g, '');
  const strippedExpected = normExpected.replace(/\s+/g, '');

  return strippedUser === strippedExpected;
}
