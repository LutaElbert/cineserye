import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';

afterEach(() => vi.unstubAllEnvs());

describe('local render boundary', () => {
  it('fails closed for hosted or proxied requests even when explicitly enabled', async () => {
    vi.stubEnv('CINESERYE_LOCAL_ASSEMBLY_ENABLED', 'true');
    expect(await (await GET(new Request('https://cineserye.example/api/cinema/assemble'))).json()).toMatchObject({ available: false });
    expect(await (await GET(new Request('http://localhost:3000/api/cinema/assemble', { headers: { 'x-forwarded-host': 'example.com' } }))).json()).toMatchObject({ available: false });
  });
  it('fails closed outside development without operator enablement', async () => {
    vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('CINESERYE_LOCAL_ASSEMBLY_ENABLED', 'false');
    expect(await (await GET(new Request('http://localhost:3000/api/cinema/assemble'))).json()).toMatchObject({ available: false });
  });
  it('rejects cross-origin, missing-token, and mismatched-host POSTs before parsing media', async () => {
    vi.stubEnv('CINESERYE_LOCAL_ASSEMBLY_ENABLED', 'true');
    const url = 'http://localhost:3000/api/cinema/assemble';
    expect((await POST(new Request(url, { method: 'POST', headers: { origin: 'https://evil.example' }, body: 'not media' }))).status).toBe(403);
    expect((await POST(new Request(url, { method: 'POST', headers: { origin: 'http://localhost:3000' }, body: 'not media' }))).status).toBe(403);
    expect((await POST(new Request(url, { method: 'POST', headers: { origin: 'http://localhost:3000', host: 'example.com' }, body: 'not media' }))).status).toBe(403);
  });
  it('uses one-time local capability tokens and rejects unexpected upload formats', async () => {
    vi.stubEnv('CINESERYE_LOCAL_ASSEMBLY_ENABLED', 'true');
    const url = 'http://127.0.0.1:3000/api/cinema/assemble';
    const capability = await (await GET(new Request(url))).json() as { available: boolean; token: string | null };
    if (!capability.available) return;
    const headers = { origin: 'http://127.0.0.1:3000', 'x-cineserye-local-render': capability.token! };
    expect((await POST(new Request(url, { method: 'POST', headers, body: 'not a multipart upload' }))).status).toBe(400);
    expect((await POST(new Request(url, { method: 'POST', headers, body: 'not a multipart upload' }))).status).toBe(403);
  });
});
