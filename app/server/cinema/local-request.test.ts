import { describe, expect, it } from 'vitest';
import { assertLocalRequest } from './local-request';

describe('native local operation origin boundary', () => {
  it('permits same-origin JSON mutations and local read-only capability checks', () => {
    expect(assertLocalRequest(new Request('http://localhost:3040/api'))).toBeInstanceOf(URL);
    expect(assertLocalRequest(new Request('http://localhost:3040/api', { method: 'POST', headers: { origin: 'http://localhost:3040', 'content-type': 'application/json' } }), { mutation: true, json: true })).toBeInstanceOf(URL);
  });
  it('rejects hosted, proxied, cross-origin, missing-origin and simple-form mutations', () => {
    for (const request of [
      new Request('https://app.example/api', { method: 'POST' }),
      new Request('http://localhost/api', { method: 'POST', headers: { origin: 'http://localhost', 'x-forwarded-host': 'app.example', 'content-type': 'application/json' } }),
      new Request('http://localhost/api', { method: 'POST', headers: { origin: 'https://other.example', 'content-type': 'application/json' } }),
      new Request('http://localhost/api', { method: 'POST', headers: { 'content-type': 'application/json' } }),
      new Request('http://localhost/api', { method: 'POST', headers: { origin: 'http://localhost', 'content-type': 'text/plain' } }),
    ]) expect(() => assertLocalRequest(request, { mutation: true, json: true })).toThrow();
  });
});
