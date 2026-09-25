import type { Word } from '../types';
import { randomInt, shuffle } from './random';

const OPTION_COUNT = 4;

const shapeOf = (form: string) => ({
  ending: form.toLowerCase().endsWith('en') ? 'en' : form.toLowerCase().endsWith('t') ? 't' : 'other',
  hasGe: form.toLowerCase().startsWith('ge'),
});

/** How much `candidate` looks like `correct` — the more alike, the more convincing a wrong option it makes. */
function resemblance(correct: string, candidate: string): number {
  const a = shapeOf(correct);
  const b = shapeOf(candidate);
  let score = 0;
  if (a.ending === b.ending) score += 2; // a -t form next to -en forms would be eliminated at a glance
  if (a.hasGe === b.hasGe) score += 1;
  if (Math.abs(correct.length - candidate.length) <= 2) score += 0.5;
  return score;
}

/**
 * The answer options of the "Partizip II" multiple-choice question: the verb's
 * real Partizip II plus real Partizip II forms of *other* verbs from the
 * dictionary, in random order.
 *
 * Wrong options are taken from real verbs (invented ones like "gegehen" are
 * recognisable as fake at a glance). They are preferably alike in shape (same
 * ending, "ge-" prefix or not), with some randomness so the same verb doesn't
 * always come with the same three companions.
 *
 * With fewer than three other verbs available there are simply fewer options;
 * the caller decides how many verbs it needs for the quiz to make sense.
 */
export function buildPartizip2Options(verb: Word, pool: readonly Word[], count = OPTION_COUNT): string[] {
  const correct = (verb.partizip2 ?? '').trim();
  const seen = new Set([correct.toLowerCase()]);

  const candidates: { form: string; score: number }[] = [];
  for (const other of pool) {
    if (other.id === verb.id) continue;
    const form = (other.partizip2 ?? '').trim();
    const key = form.toLowerCase();
    if (!form || seen.has(key)) continue;
    seen.add(key);
    candidates.push({ form, score: resemblance(correct, form) + randomInt(150) / 100 });
  }

  const wrong = candidates
    .sort((x, y) => y.score - x.score)
    .slice(0, count - 1)
    .map((c) => c.form);

  return shuffle([correct, ...wrong]);
}
