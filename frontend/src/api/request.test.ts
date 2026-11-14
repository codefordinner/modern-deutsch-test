import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, request } from './request';

describe('request gateway errors', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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
});
