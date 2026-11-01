// Step-by-step hint for the words trainer: the first press reveals the article
// (if the answer has one), every next press reveals one more letter.

const ARTICLE_NOUN = /^(der|die|das)\s+(\S[\s\S]*)$/i;
const isLetter = (ch: string): boolean => /[\p{L}\p{N}]/u.test(ch);

export interface WordHint {
  /** How many presses are applied (clamped to `maxLevel`). */
  level: number;
  /** Presses after which everything is revealed. */
  maxLevel: number;
  /** The article, once revealed (null before the first press or when the answer has none). */
  article: string | null;
  /** The rest of the answer: revealed letters, "_" for the hidden ones; spaces and punctuation always shown. */
  masked: string;
}

export function buildHint(target: string, level: number): WordHint {
  const text = target.trim();
  const match = ARTICLE_NOUN.exec(text);
  const hasArticle = match !== null;
  const rest = Array.from(match ? match[2] : text);

  const maxLevel = (hasArticle ? 1 : 0) + rest.filter(isLetter).length;
  const applied = Math.min(Math.max(0, Math.floor(level)), maxLevel);
  const revealedLetters = Math.max(0, applied - (hasArticle ? 1 : 0));

  let seen = 0;
  const masked = rest
    .map((ch) => {
      if (!isLetter(ch)) return ch;
      seen += 1;
      return seen <= revealedLetters ? ch : '_';
    })
    .join('');

  return { level: applied, maxLevel, article: match && applied >= 1 ? match[1] : null, masked };
}
