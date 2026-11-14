import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveWordCheckDuplicates } from './wordCheckDuplicates';
import type { WordCheckResult } from './aiSettings';

const result = (id: string, corrections: WordCheckResult['corrections'] = []): WordCheckResult => ({ id, issues: [], corrections });

test('blocks duplicate corrections and keeps unrelated safe corrections', () => {
  const checked = resolveWordCheckDuplicates(
    [
      result('one', [{ field: 'de', value: 'Der Tisch' }, { field: 'ru', value: 'стол' }]),
      result('two', [{ field: 'de', value: ' der   tisch ' }]),
      result('three', [{ field: 'ru', value: 'идти' }]),
    ],
    [{ id: 'one', de: 'Tisch' }, { id: 'two', de: 'Schrank' }, { id: 'three', de: 'gehen' }],
  );

  assert.deepEqual(checked[0].corrections.map(({ field }) => field), ['ru']);
  assert.deepEqual(checked[1].corrections, []);
  assert.match(checked[0].issues[0].message, /создаёт дубликат/);
  assert.match(checked[1].issues[0].message, /создаёт дубликат/);
  assert.deepEqual(checked[2].issues, []);
});

test('finds legacy duplicates and reports only those still present after corrections', () => {
  const checked = resolveWordCheckDuplicates(
    [result('legacy-a'), result('legacy-b'), result('moving', [{ field: 'de', value: 'Neu' }])],
    [{ id: 'legacy-a', de: 'Haus' }, { id: 'legacy-b', de: ' haus ' }, { id: 'moving', de: 'Alt' }],
  );

  assert.equal(checked[0].issues.length, 1);
  assert.equal(checked[1].issues.length, 1);
  assert.deepEqual(checked[2].issues, []);
  assert.deepEqual(checked[2].corrections, [{ field: 'de', value: 'Neu' }]);
});

test('blocks a correction that collides with an unselected legacy word', () => {
  const checked = resolveWordCheckDuplicates(
    [result('selected', [{ field: 'de', value: 'der Baum' }])],
    [{ id: 'selected', de: 'Baumchen' }, { id: 'legacy', de: ' der   baum ' }],
  );

  assert.deepEqual(checked[0].corrections, []);
  assert.match(checked[0].issues[0].message, /«der Baum»/);
});

test('allows a selected legacy duplicate to move away while another takes its form', () => {
  const checked = resolveWordCheckDuplicates(
    [result('move', [{ field: 'de', value: 'Neu' }]), result('replace', [{ field: 'de', value: 'Haus' }])],
    [{ id: 'move', de: 'Haus' }, { id: 'replace', de: 'Alt' }],
  );

  assert.ok(checked.every((item) => item.corrections.length === 1));
  assert.ok(checked.every((item) => item.issues.length === 0));
});

test('rechecks conflicts after blocking corrections that collide with legacy duplicates', () => {
  const checked = resolveWordCheckDuplicates(
    [result('a', [{ field: 'de', value: 'X' }]), result('b', [{ field: 'de', value: 'X' }]), result('c', [{ field: 'de', value: 'B' }])],
    [{ id: 'a', de: 'A' }, { id: 'b', de: 'B' }, { id: 'c', de: 'C' }, { id: 'legacy', de: 'X' }],
  );

  assert.deepEqual(checked.map((item) => item.corrections.length), [0, 0, 0]);
  assert.match(checked[0].issues[0].message, /дубликат/);
  assert.match(checked[1].issues[0].message, /дубликат/);
  assert.match(checked[2].issues[0].message, /дубликат/);
});
