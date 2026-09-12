import { afterEach, expect, it, vi } from 'vitest';
import { GET, POST } from './route';
import { renderLocalSequence } from '../../../server/cinema/assembly';

// This unit isolates upload parsing. The browser export test exercises the real
// native renderer, validates every downloaded frame and verifies its metadata.
vi.mock('../../../server/cinema/assembly', () => ({
  localAssemblyCapability: async () => ({ available: true, reason: null }),
  renderLocalSequence: vi.fn(async () => ({ bytes: new Uint8Array([1]), metadata: { width: 1280, height: 720, durationSeconds: 1 } })),
}));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

for (const boundary of ['----lowercase123', '----WebKitFormBoundaryAaB7C9']) it(`preserves multipart boundary case: ${boundary}`, async () => {
  vi.stubEnv('CINESERYE_LOCAL_ASSEMBLY_ENABLED', 'true');
  const url = 'http://localhost:3000/api/cinema/assemble';
  const capability = await (await GET(new Request(url))).json() as { available: boolean; token: string };
  expect(capability.available).toBe(true);
  const manifest = { version: 1, aspectRatio: '16:9', resolution: '720p', fps: 24, audio: 'silent', confirmedLocalRender: true,
    clips: [{ shotId: 'shot-1', clipId: 'clip-1', blobHash: 'a'.repeat(64), startFrame: 0, durationFrames: 24 }] };
  const body = `--${boundary}\r\nContent-Disposition: form-data; name="manifest"\r\n\r\n${JSON.stringify(manifest)}\r\n`
    + `--${boundary}\r\nContent-Disposition: form-data; name="clip-0"; filename="clip.mp4"\r\nContent-Type: video/mp4\r\n\r\nsynthetic-bytes\r\n--${boundary}--\r\n`;
  const response = await POST(new Request(url, { method: 'POST', headers: { origin: 'http://localhost:3000',
    'x-cineserye-local-render': capability.token, 'content-type': `multipart/form-data; boundary=${boundary}` }, body }));
  expect(response.status).toBe(200);
  expect(renderLocalSequence).toHaveBeenCalledOnce();
  const [received, clips] = vi.mocked(renderLocalSequence).mock.calls[0];
  expect(received).toEqual(manifest); expect(clips).toHaveLength(1); expect(await clips[0].text()).toBe('synthetic-bytes');
});
