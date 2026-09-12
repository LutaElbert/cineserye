import 'server-only';
import { ProviderError } from './provider-errors';

let workerRuntime = false;

/** One-way boundary set by the Worker entry point, never by request or env data. */
export function disableNativeRuntime(): void {
  workerRuntime = true;
}

/** Node-compatible APIs alone do not make a Worker a native operator server. */
export function isNativeRuntime(): boolean {
  return !workerRuntime && typeof process !== 'undefined'
    && process.release?.name === 'node' && typeof process.getBuiltinModule === 'function';
}

export function assertNativeRuntime(): void {
  if (!isNativeRuntime()) throw new ProviderError('INVALID_REQUEST', 'This operation requires the native local operator server.');
}
