// German time generator (flash cards): colloquial / official phrases, 'kurz' variants, any minute
import { twoDigitToGerman } from './numbers-generator';

const HOUR_WORDS_12: Record<number, string> = {
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
};

export interface GermanTimeOutput {
  hours: number;
  minutes: number;
  timeString24: string;
  timeString12: string;
  official: string;
  colloquial: string;
  kurzVariant?: string;
}

export function formatTime24(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatTime12(h: number, m: number): string {
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function getGermanTime(hours: number, minutes: number): GermanTimeOutput {
  // Official format: 24h
  let officialHour = hours === 1 ? 'ein' : twoDigitToGerman(hours);
  let official = `${officialHour} Uhr`;
  if (minutes > 0) {
    official += ` ${twoDigitToGerman(minutes)}`;
  }

  // Colloquial format: 12h
  const current12 = hours % 12 === 0 ? 12 : hours % 12;
  const next12 = (current12 % 12) + 1;

  const curWord = current12 === 1 ? 'eins' : HOUR_WORDS_12[current12];
  const curHourPrefix = current12 === 1 ? 'ein' : curWord;
  const nextWord = next12 === 1 ? 'eins' : HOUR_WORDS_12[next12];

  let colloquial = '';
  let kurzVariant: string | undefined;

  // Exact milestones
  if (minutes === 0) {
    colloquial = `${curHourPrefix} Uhr`;
  } else if (minutes >= 1 && minutes <= 4) {
    colloquial = `kurz nach ${curWord}`;
    kurzVariant = `kurz nach ${curWord}`;
  } else if (minutes === 5) {
    colloquial = `fünf nach ${curWord}`;
  } else if (minutes >= 6 && minutes <= 9) {
    colloquial = `${twoDigitToGerman(minutes)} nach ${curWord}`;
  } else if (minutes === 10) {
    colloquial = `zehn nach ${curWord}`;
  } else if (minutes >= 11 && minutes <= 14) {
    colloquial = `kurz vor Viertel nach ${curWord}`;
    kurzVariant = `kurz vor Viertel nach ${curWord}`;
  } else if (minutes === 15) {
    colloquial = `Viertel nach ${curWord}`;
  } else if (minutes >= 16 && minutes <= 19) {
    colloquial = `kurz nach Viertel nach ${curWord}`;
    kurzVariant = `kurz nach Viertel nach ${curWord}`;
  } else if (minutes === 20) {
    colloquial = `zwanzig nach ${curWord}`;
  } else if (minutes >= 21 && minutes <= 24) {
    // Same pattern as 20 ("zwanzig nach") and 6–9: a plain "N nach"; "N vor halb" only starts at 25.
    colloquial = `${twoDigitToGerman(minutes)} nach ${curWord}`;
  } else if (minutes === 25) {
    colloquial = `fünf vor halb ${nextWord}`;
  } else if (minutes >= 26 && minutes <= 29) {
    colloquial = `kurz vor halb ${nextWord}`;
    kurzVariant = `kurz vor halb ${nextWord}`;
  } else if (minutes === 30) {
    colloquial = `halb ${nextWord}`;
  } else if (minutes >= 31 && minutes <= 34) {
    colloquial = `kurz nach halb ${nextWord}`;
    kurzVariant = `kurz nach halb ${nextWord}`;
  } else if (minutes === 35) {
    colloquial = `fünf nach halb ${nextWord}`;
  } else if (minutes >= 36 && minutes <= 39) {
    const diff = minutes - 30;
    colloquial = `${twoDigitToGerman(diff)} nach halb ${nextWord}`;
  } else if (minutes === 40) {
    colloquial = `zwanzig vor ${nextWord}`;
  } else if (minutes >= 41 && minutes <= 44) {
    colloquial = `kurz vor Viertel vor ${nextWord}`;
    kurzVariant = `kurz vor Viertel vor ${nextWord}`;
  } else if (minutes === 45) {
    colloquial = `Viertel vor ${nextWord}`;
  } else if (minutes >= 46 && minutes <= 49) {
    colloquial = `kurz nach Viertel vor ${nextWord}`;
    kurzVariant = `kurz nach Viertel vor ${nextWord}`;
  } else if (minutes === 50) {
    colloquial = `zehn vor ${nextWord}`;
  } else if (minutes >= 51 && minutes <= 54) {
    colloquial = `${twoDigitToGerman(60 - minutes)} vor ${nextWord}`;
  } else if (minutes === 55) {
    colloquial = `fünf vor ${nextWord}`;
  } else if (minutes >= 56 && minutes <= 59) {
    colloquial = `kurz vor ${nextWord}`;
    kurzVariant = `kurz vor ${nextWord}`;
  }

  return {
    hours,
    minutes,
    timeString24: formatTime24(hours, minutes),
    timeString12: formatTime12(hours, minutes),
    official,
    colloquial,
    kurzVariant,
  };
}

export function generateRandomTime(stepMode: 'any' | '5min' = 'any'): { hours: number; minutes: number } {
  const hours = Math.floor(Math.random() * 24);
  let minutes: number;

  if (stepMode === '5min') {
    const multiples = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
    minutes = multiples[Math.floor(Math.random() * multiples.length)];
  } else {
    // 'any' minute: bias slightly towards interesting "kurz" and specific minutes
    const pool = [
      ...Array.from({ length: 60 }, (_, i) => i),
      1, 2, 3, 4, 28, 29, 31, 32, 57, 58, 59, // extra weight on kurz
    ];
    minutes = pool[Math.floor(Math.random() * pool.length)];
  }

  return { hours, minutes };
}
