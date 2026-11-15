export interface RetryOptions {
  attempts?: number;
  delayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
}

/** Retries transient async operations with a linearly increasing delay. */
export async function withRetry<T>(operation: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = Math.max(1, Math.floor(options.attempts ?? 3));
  const delayMs = Math.max(0, options.delayMs ?? 1000);
  const shouldRetry = options.shouldRetry ?? (() => true);
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts || !shouldRetry(error)) throw error;
      await new Promise<void>((resolve) => globalThis.setTimeout(resolve, delayMs * attempt));
    }
  }

  throw lastError;
}
