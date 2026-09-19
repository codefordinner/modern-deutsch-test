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

// Converts numbers under 100 to German
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
  return hundredStr + twoDigitToGerman(remainder, false);
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

  // Thousands
  const thousands = Math.floor(remainderAfterMillions / 1000);
  const remainderAfterThousands = remainderAfterMillions % 1000;

  if (thousands > 0) {
    if (thousands === 1) {
      result += 'eintausend';
    } else {
      result += `${threeDigitToGerman(thousands, false)}tausend`;
    }
  }

  // Hundreds & units
  if (remainderAfterThousands > 0) {
    result += threeDigitToGerman(remainderAfterThousands, n >= 1000);
  }

  return result;
}

export const numberToGermanWords = numberToGerman;

export type NumberRangeKey = 'units' | 'teens' | 'tens' | 'hundreds' | 'thousands' | 'millions';

export const NUMBER_RANGES: { key: NumberRangeKey; label: string; min: number; max: number }[] = [
  { key: 'units', label: 'Единицы (0–12)', min: 0, max: 12 },
  { key: 'teens', label: '13–19 (dreizehn...)', min: 13, max: 19 },
  { key: 'tens', label: 'Десятки 20–99 (und-правило)', min: 20, max: 99 },
  { key: 'hundreds', label: 'Сотни (100–999)', min: 100, max: 999 },
  { key: 'thousands', label: 'Тысячи (1 000–999 999)', min: 1000, max: 999999 },
  { key: 'millions', label: 'Миллионы (1 000 000+)', min: 1000000, max: 20000000 },
];

export function getRandomNumberByRanges(selectedRanges: NumberRangeKey[]): number {
  if (!selectedRanges || selectedRanges.length === 0) {
    selectedRanges = ['units', 'teens', 'tens'];
  }
  const chosenKey = selectedRanges[Math.floor(Math.random() * selectedRanges.length)];
  const range = NUMBER_RANGES.find((r) => r.key === chosenKey) || NUMBER_RANGES[0];

  return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
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
