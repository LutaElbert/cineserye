import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.resetModules(); vi.unstubAllGlobals(); });

it('recognizes the native test process without executing a probe', async () => {
  const { isNativeRuntime } = await import('./native-runtime');
  expect(isNativeRuntime()).toBe(true);
});

it('fails closed without native process APIs', async () => {
  const { isNativeRuntime } = await import('./native-runtime');
  vi.stubGlobal('process', undefined);
  expect(isNativeRuntime()).toBe(false);
});

it('Worker bootstrap overrides Node compatibility for discovery, requests and rendering', async () => {
  const { disableNativeRuntime, isNativeRuntime } = await import('./native-runtime');
  disableNativeRuntime();
  disableNativeRuntime();
  expect(isNativeRuntime()).toBe(false);
  const { workflowCapabilities } = await import('./workflow-capabilities');
  const value = workflowCapabilities({ CINESERYE_E2E_FIXTURE: 'true', CINESERYE_LOCAL_ASSEMBLY_ENABLED: 'true' });
  expect(value.runtime).toBe('unsupported');
  for (const stage of ['research', 'analysis', 'story', 'shots', 'images', 'video', 'assembly'] as const) {
    expect(value.stages[stage].ready).toBe(false);
    expect(value.stages[stage].status).toBe('blocked');
  }
  expect(value.stages.assembly.configured).toBe(false);
  expect(value.stages.uploads.status).toBe('local-only');
  expect(value.legacyPlanning.livePreflight.ready).toBe(false);
  const { assertLocalRequest } = await import('./local-request');
  expect(() => assertLocalRequest(new Request('http://localhost/api'))).toThrow('native local operator');
  const { localAssemblyCapability } = await import('./assembly');
  expect(await localAssemblyCapability()).toMatchObject({ available: false, reason: 'Local MP4 assembly requires a native Node server.' });
  const { createStoryHandler } = await import('./story-development');
  const { createAssistantHandlers } = await import('./story-assistant');
  const { POST: storyboard } = await import('../../api/cinema/generate-storyboard/route');
  for (const handler of [createStoryHandler(), createAssistantHandlers().POST, storyboard]) {
    const request = new Request('http://localhost/api', { method: 'POST', body: 'not JSON' });
    const read = vi.spyOn(request, 'text');
    const response = await handler(request);
    expect(response.status).toBe(400);
    expect(await response.text()).toContain('native local operator');
    expect(read).not.toHaveBeenCalled();
  }
});
