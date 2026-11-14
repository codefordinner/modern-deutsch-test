import assert from 'node:assert/strict';
import test from 'node:test';
import { enqueueAI } from './aiQueue';

test('returns the Gemini model catalog response unchanged', async () => {
  const catalog = [{ name: 'models/gemini-test', supportedGenerationMethods: ['generateContent'] }];
  const result = await enqueueAI('models', undefined, async () => new Response(JSON.stringify({ models: catalog }), {
    headers: { 'Content-Type': 'application/json' },
  }));

  assert.ok(result instanceof Response);
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { models: catalog });
});

test('returns non-success model catalog responses for endpoint handling', async () => {
  const result = await enqueueAI('models', undefined, async () => new Response('Gemini unavailable', { status: 503 }));

  assert.ok(result instanceof Response);
  assert.equal(result.status, 503);
  assert.equal(await result.text(), 'Gemini unavailable');
});
