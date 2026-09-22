// Character-level comparison between what the user typed and the expected
// answer, used to show *where exactly* a mistake was made.
//
// The comparison is case-insensitive on purpose: every trainer in the app
// accepts answers regardless of capitalisation ("tisch" == "Tisch"), so a
// difference in case must never be highlighted as an error.

export interface DiffSegment {
  text: string;
  /** true = this run of characters is not part of the common (matching) text */
  changed: boolean;
}

export interface DiffOptions {
  /**
   * Ignore whitespace on both sides. Used where the trainer itself accepts
   * "zwei und vierzig" for "zweiundvierzig" — spaces are never an error there.
   */
  ignoreSpaces?: boolean;
}

export interface AnswerDiffResult {
  /** The user's text, with the characters that don't belong marked as changed. */
  user: DiffSegment[];
  /** The expected text, with the missing / different characters marked as changed. */
  expected: DiffSegment[];
  /** Number of matching characters (length of the longest common subsequence). */
  matchLength: number;
}

const isSpace = (ch: string) => /\s/.test(ch);
const sameChar = (a: string, b: string) => a === b || a.toLowerCase() === b.toLowerCase();

function toSegments(chars: string[], changed: boolean[]): DiffSegment[] {
  const segments: DiffSegment[] = [];
  chars.forEach((ch, i) => {
    const last = segments[segments.length - 1];
    if (last && last.changed === changed[i]) last.text += ch;
    else segments.push({ text: ch, changed: changed[i] });
  });
  return segments;
}

/**
 * Aligns `userRaw` against `expectedRaw` (longest common subsequence) and
 * reports which characters on each side fall outside the alignment.
 *
 *  - A wrong or missing letter shows up as `changed` in `expected`.
 *  - A wrong or superfluous letter shows up as `changed` in `user`.
 */
export function diffAnswers(userRaw: string, expectedRaw: string, options: DiffOptions = {}): AnswerDiffResult {
  const user = Array.from(userRaw.trim());
  const expected = Array.from(expectedRaw.trim());

  // Indices of the characters that take part in the comparison.
  const significant = (chars: string[]) =>
    chars.map((_, i) => i).filter((i) => !options.ignoreSpaces || !isSpace(chars[i]));
  const uIdx = significant(user);
  const eIdx = significant(expected);
  const n = uIdx.length;
  const m = eIdx.length;

  // dp[i][j] = LCS length of user[i..] and expected[j..]
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = sameChar(user[uIdx[i]], expected[eIdx[j]])
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  // Everything compared starts out as "changed"; matched characters are cleared.
  const userChanged = user.map((ch) => !(options.ignoreSpaces && isSpace(ch)));
  const expectedChanged = expected.map((ch) => !(options.ignoreSpaces && isSpace(ch)));

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (sameChar(user[uIdx[i]], expected[eIdx[j]])) {
      userChanged[uIdx[i]] = false;
      expectedChanged[eIdx[j]] = false;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }

  return {
    user: toSegments(user, userChanged),
    expected: toSegments(expected, expectedChanged),
    matchLength: dp[0][0],
  };
}

/**
 * From several acceptable answers, picks the one the user's input is closest
 * to — so that only one of them gets diffed and highlighted.
 */
export function pickClosestAnswer(userRaw: string, candidates: string[], options: DiffOptions = {}): string {
  if (candidates.length <= 1) return candidates[0] ?? '';
  const userLen = Array.from(userRaw.trim()).length;

  let best = candidates[0];
  let bestScore = -1;
  for (const candidate of candidates) {
    const { matchLength } = diffAnswers(userRaw, candidate, options);
    const total = userLen + Array.from(candidate.trim()).length;
    const score = total === 0 ? 0 : (2 * matchLength) / total;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}
