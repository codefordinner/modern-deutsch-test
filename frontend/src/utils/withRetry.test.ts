import { describe, expect, it, vi } from 'vitest';
import { withRetry } from './withRetry';

describe('withRetry', () => {
  it('retries a failed operation and returns its result', async () => {
    vi.useFakeTimers();
    let calls = 0;
    const operation = vi.fn(async () => {
      calls += 1;
      if (calls < 3) throw new Error('temporary');
      return 'ok';
    });

    const result = withRetry(operation, { delayMs: 10 });
    await vi.advanceTimersByTimeAsync(30);
    await expect(result).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it('does not retry non-transient errors', async () => {
    const error = new Error('invalid');
    const operation = vi.fn(async () => { throw error; });
    await expect(withRetry(operation, { shouldRetry: () => false })).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
