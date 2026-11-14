import assert from 'node:assert/strict';
import test from 'node:test';
import { AIServiceError, normalizeAIError } from './aiErrorLog';

test('normalizes AbortSignal timeout exceptions into a diagnostic AI error', () => {
  const timeout = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
  const normalized = normalizeAIError(timeout, { model: 'gemini-test', prompt: 'prompt sent' });

  assert.ok(normalized instanceof AIServiceError);
  assert.equal(normalized.code, 'AI_TIMEOUT');
  assert.equal(normalized.model, 'gemini-test');
  assert.equal(normalized.prompt, 'prompt sent');
});

test('preserves provider errors and leaves unrelated aborts unchanged', () => {
  const providerError = new AIServiceError('GEMINI_UNAVAILABLE', { providerStatus: 503 });
  assert.equal(normalizeAIError(providerError), providerError);

  const cancelled = new DOMException('The operation was aborted', 'AbortError');
  assert.equal(normalizeAIError(cancelled), cancelled);
});
