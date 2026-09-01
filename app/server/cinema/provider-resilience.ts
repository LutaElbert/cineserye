import { ProviderError } from './provider-errors';

export type ProviderAttemptOptions = {
  signal: AbortSignal;
  timeoutMs: number;
  maxAttempts?: number;
  shouldRetry?: (error: unknown) => boolean;
};

function cancelled(cause?: unknown) {
  return new ProviderError('CANCELLED', 'Planning was cancelled.', false, { cause });
}

export async function runProviderOperation<T>(
  operation: (signal: AbortSignal, attempt: number) => Promise<T>,
  options: ProviderAttemptOptions,
): Promise<T> {
  const attempts = Math.max(1, Math.min(3, options.maxAttempts ?? 2));
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (options.signal.aborted) throw cancelled(options.signal.reason);
    const controller = new AbortController();
    const abort = () => controller.abort(options.signal.reason);
    options.signal.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(() => controller.abort('timeout'), options.timeoutMs);
    try {
      return await operation(controller.signal, attempt);
    } catch (error) {
      if (options.signal.aborted) throw cancelled(error);
      if (controller.signal.aborted) {
        const timeoutError = new ProviderError('TIMEOUT', 'The provider took too long to respond.', true, { cause: error });
        if (attempt === attempts || options.shouldRetry?.(timeoutError) === false) throw timeoutError;
        continue;
      }
      const retryable = options.shouldRetry?.(error)
        ?? (error instanceof ProviderError && error.retryable);
      if (!retryable || attempt === attempts) throw error;
    } finally {
      clearTimeout(timeout);
      options.signal.removeEventListener('abort', abort);
    }
  }
  throw new ProviderError('PROVIDER_UNAVAILABLE', 'The provider did not complete the request.', true);
}
