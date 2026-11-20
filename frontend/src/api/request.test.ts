import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, request } from './request';

describe('request gateway errors', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it.each([502, 504])('uses a general server message for HTTP %i responses', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>gateway error</html>', {
      status,
      headers: { 'Content-Type': 'text/html' },
    })));

    await expect(request('/words')).rejects.toMatchObject({
      name: 'ApiError',
      status,
      message: 'Сервер или прокси временно не отвечает. Попробуйте обновить страницу позже.',
    } satisfies Partial<ApiError>);
  });

  it('stops waiting when a request exceeds its configured timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    })));

    const pendingRequest = request('/learner-auth/telegram/challenge', { timeoutMs: 15_000 });
    const assertion = expect(pendingRequest).rejects.toMatchObject({
      name: 'ApiError',
      status: 408,
      message: 'Сервер долго не отвечает. Проверьте соединение и попробуйте запросить код ещё раз.',
    } satisfies Partial<ApiError>);
    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;
  });
});
