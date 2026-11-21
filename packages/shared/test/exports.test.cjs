const assert = require('node:assert/strict');
const { test } = require('node:test');

const commonjs = require('@sprachfunke/shared');

test('CommonJS entry exposes shared runtime API', () => {
  assert.deepEqual(commonjs.SRS_TRAINERS, ['words', 'verbs', 'articles']);
  assert.deepEqual(commonjs.sanitizeWeights([20, 20, 20, 20, 20]), [20, 20, 20, 20, 20]);
  assert.equal(commonjs.sanitizeWeights([0, 0, 0, 0, 0]), null);
});

test('ES module entry exposes the same runtime API', async () => {
  const esm = await import('@sprachfunke/shared');
  assert.deepEqual(esm.SRS_TRAINERS, commonjs.SRS_TRAINERS);
  assert.deepEqual(esm.emptySyncData(), commonjs.emptySyncData());
  assert.deepEqual(
    esm.mergeSyncData(esm.emptySyncData(), esm.emptySyncData()),
    commonjs.mergeSyncData(commonjs.emptySyncData(), commonjs.emptySyncData()),
  );
});
