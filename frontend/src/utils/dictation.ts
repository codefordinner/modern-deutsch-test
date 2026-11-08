/**
 * Helpers for the "describe the picture" dictation (Web Speech API).
 *
 * Firefox does not implement the Speech Recognition API at all, so the trainer
 * detects support and explains the reason instead of failing silently.
 *
 * Speech engines transcribe words only, so a spoken "Punkt" / "Komma" arrives
 * as literal text. `addDictationPunctuation` turns those words back into real
 * punctuation and capitalises after sentence ends, so the answer the AI checks
 * looks like the learner actually dictated it.
 */

/** Minimal structural type for the Web Speech API (not available in Firefox). */
export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  results: ArrayLike<ArrayLike<{ transcript: string; isFinal?: boolean }>>;
  onresult: ((event: SpeechRecognitionLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export const getSpeechRecognition = (): (new () => SpeechRecognitionLike) | null => {
  const speechWindow = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
};

/** Spoken German punctuation words and the character they represent. */
const PUNCTUATION_WORDS = new Map<string, string>([
  ['komma', ','],
  ['kommer', ','],
  ['punkt', '.'],
  ['punct', '.'],
  ['punkte', '.'],
  ['doppelpunkt', ':'],
  ['fragezeichen', '?'],
  ['fragzeichen', '?'],
  ['ausrufezeichen', '!'],
  ['ausrufungszeichen', '!'],
  ['rufezeichen', '!'],
  ['semikolon', ';'],
  ['strichpunkt', ';'],
  ['bindestrich', '-'],
  ['gedankenstrich', '–'],
]);

const SENTENCE_END = new Set(['.', '!', '?']);

/**
 * Rewrites a raw speech transcript: spoken punctuation words become real
 * punctuation and words after sentence ends are capitalised. `capitalizeFirst`
 * controls whether the very first word is capitalised (a fresh answer or one
 * ending in a sentence mark) or left as-is (continuing an already typed
 * sentence).
 */
export function addDictationPunctuation(text: string, capitalizeFirst = true): string {
  let out = '';
  let capitalizeNext = capitalizeFirst;

  for (const raw of text.split(/\s+/)) {
    // Strip any engine artifacts (commas/periods the engine glued to a word).
    const cleaned = raw.replace(/[^\p{L}\p{N}'-]/gu, '');
    if (!cleaned) continue;

    const punctuation = PUNCTUATION_WORDS.get(cleaned.toLowerCase().replace(/'/g, ''));
    if (punctuation) {
      out = `${out.replace(/\s+$/, '')}${punctuation} `;
      if (SENTENCE_END.has(punctuation)) capitalizeNext = true;
      continue;
    }

    const word = capitalizeNext ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : cleaned;
    out += `${word} `;
    capitalizeNext = false;
  }

  return out.trim();
}
