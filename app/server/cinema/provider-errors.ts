import type { ProviderErrorCode } from '../../features/scene-planner/plan-scene-api';

export type { ProviderErrorCode } from '../../features/scene-planner/plan-scene-api';

export class ProviderError extends Error {
  constructor(
    readonly code: ProviderErrorCode,
    message: string,
    readonly retryable = false,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ProviderError';
  }
}

export function publicProviderError(error: unknown): {
  code: ProviderErrorCode;
  message: string;
  retryable: boolean;
} {
  if (error instanceof ProviderError) {
    return { code: error.code, message: error.message, retryable: error.retryable };
  }
  return {
    code: 'PROVIDER_UNAVAILABLE',
    message: 'The planning service could not complete this request.',
    retryable: true,
  };
}
