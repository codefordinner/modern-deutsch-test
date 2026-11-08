import { describe, expect, it } from 'vitest';
import { countDue, isDue } from './srsDue';
import { pickCardBySRS, sanitizeSRSMap, srsKeys, updateSRS } from './srs';

describe('Leitner SRS algorithm', () => {
  const day = 24 * 60 * 60 * 1000;
  const now = new Date('2026-03-10T12:00:00.000Z');

  it('promotes a correct card at most once per local day and caps it at box five', () => {
    const first = updateSRS({}, 'card', true, now);
    const second = updateSRS(first, 'card', true, new Date(now.getTime() + 60_000));
    const nextDay = updateSRS(second, 'card', true, new Date(now.getTime() + day));

    expect(first.card.box).toBe(2);
    expect(second.card.box).toBe(2);
    expect(nextDay.card.box).toBe(3);
    expect(first.card.nextReview).toBe(new Date(now.getTime() + 3 * day).toISOString());
  });

  it('resets a failed card to box one and increments mistakes without mutating the source', () => {
    const original = { card: { box: 4, streak: 3, mistakes: 1, lastReviewed: now.toISOString(), nextReview: now.toISOString() } };
    const failed = updateSRS(original, 'card', false, now);

    expect(failed.card).toMatchObject({ box: 1, streak: 0, mistakes: 2 });
    expect(original.card).toMatchObject({ box: 4, streak: 3, mistakes: 1 });
    expect(failed.card.nextReview).toBe(new Date(now.getTime() + day).toISOString());
  });

  it('marks new, failed, malformed-date and elapsed cards due, but respects future reviews', () => {
    const future = now.getTime() + day;
    const records = {
      failed: { box: 1, streak: 0, mistakes: 1, lastReviewed: now.toISOString(), nextReview: now.toISOString() },
      waiting: { box: 3, streak: 2, mistakes: 0, lastReviewed: now.toISOString(), nextReview: new Date(future).toISOString() },
      overdue: { box: 2, streak: 1, mistakes: 0, lastReviewed: now.toISOString(), nextReview: now.toISOString() },
      malformed: { box: 2, streak: 0, mistakes: 0, lastReviewed: now.toISOString(), nextReview: 'invalid' },
    };

    expect(isDue(undefined, now.getTime())).toBe(true);
    expect(isDue(records.failed, now.getTime())).toBe(true);
    expect(isDue(records.waiting, now.getTime())).toBe(false);
    expect(isDue(records.overdue, now.getTime())).toBe(true);
    expect(isDue(records.malformed, now.getTime())).toBe(true);
    expect(countDue(['failed', 'waiting', 'overdue', 'missing'], records, now.getTime())).toBe(3);
  });

  it('selects only cards from the weighted box and excludes the previous card when possible', () => {
    const items = ['new-a', 'new-b', 'learned'];
    const records = { learned: { box: 5, streak: 4, mistakes: 0, lastReviewed: now.toISOString(), nextReview: now.toISOString() } };
    const selectedNew = pickCardBySRS(items, records, (item) => item, {
      weights: [1, 0, 0, 0, 0], random: () => 0.5, excludeKey: 'new-a',
    });
    const selectedLearned = pickCardBySRS(items, records, (item) => item, {
      weights: [0, 0, 0, 0, 1], random: () => 0.5,
    });

    expect(selectedNew).toBe('new-b');
    expect(selectedLearned).toBe('learned');
    expect(pickCardBySRS([], records, (item) => item)).toBeUndefined();
  });

  it('sanitizes corrupt local maps and keeps card-key formats stable', () => {
    expect(sanitizeSRSMap(null)).toEqual({});
    expect(sanitizeSRSMap({ valid: { box: 2 }, broken: null })).toEqual({ valid: { box: 2 } });
    expect(srsKeys.word('42', 'ru_to_de', 'plural')).toBe('42:ru_to_de:plural');
    expect(srsKeys.verb.stammformen('laufen')).toBe('laufen:stammformen');
  });
});
