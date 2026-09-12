import 'server-only';
import { ProviderError } from './provider-errors';
import { isNativeRuntime } from './native-runtime';

/** Local operator boundary, not multi-tenant authentication. Never trust proxy headers. */
export function assertLocalRequest(request: Request, options: { mutation?: boolean; json?: boolean } = {}): URL {
  const url = new URL(request.url);
  if (!isNativeRuntime()
    || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || !['http:', 'https:'].includes(url.protocol)
    || request.headers.has('x-forwarded-host') || request.headers.has('forwarded')
    || (request.headers.get('host') !== null && request.headers.get('host') !== url.host)) {
    throw new ProviderError('INVALID_REQUEST', 'This operation requires the native local operator server, without a proxy.');
  }
  const origin = request.headers.get('origin');
  if ((origin !== null && origin !== url.origin) || (options.mutation && origin !== url.origin)
    || ![null, 'same-origin', 'none'].includes(request.headers.get('sec-fetch-site'))) {
    throw new ProviderError('INVALID_REQUEST', 'Only the same-origin local Cineserye page can request this operation.');
  }
  if (options.json && request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new ProviderError('INVALID_REQUEST', 'This operation requires an application/json request.');
  }
  return url;
}
