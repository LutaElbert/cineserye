import { expect, it } from 'vitest';
import { workflowCapabilities } from './workflow-capabilities';
import { WorkflowCapabilitiesSchema } from '../../features/story-development/workflow-capabilities';
import { videoPolicy } from './video-policy';
const enabled = { CINESERYE_PROVIDER_MODE: 'live', CINESERYE_LIVE_ENABLED: 'true',
  CINESERYE_GCLOUD_ACTIVE_ACCOUNT: 'elbertluta@gmail.com', GOOGLE_CLOUD_PROJECT: 'cineserye', GOOGLE_CLOUD_QUOTA_PROJECT: 'cineserye',
  CINESERYE_LIVE_MAX_RUN_COST: '1', PARALLEL_API_KEY: 'test-only-not-used' };
it('reports feature-specific blocks even when the common live provider is configured', () => {
  const value = workflowCapabilities(enabled);
  expect(value.mode).toBe('live'); expect(value.analysis.ready).toBe(false); expect(value.story.ready).toBe(false);
  expect(value.stages.shots.ready).toBe(false); expect(value.stages.shots.blockers.join(' ')).toContain('per-scene');
  expect(value.stages.analysis.status).toBe('blocked'); expect(JSON.stringify(value)).not.toContain(enabled.PARALLEL_API_KEY);
});
it('derives fixture mode from explicit server configuration, never from a creative form default', () => {
  const value = workflowCapabilities({ CINESERYE_E2E_FIXTURE: 'true' });
  expect(value.analysis.mode).toBe('fixture'); expect(value.story.mode).toBe('fixture'); expect(value.stages.analysis.status).toBe('fixture');
  expect(value.proof).toBe('configuration-only');
});
it('marks configured live paths as unverified, not successful model proof', () => {
  const value = workflowCapabilities({ ...enabled, CINESERYE_STORY_LIVE_ENABLED: 'true', CINESERYE_STORY_MAX_ESTIMATED_USD: '.1', CINESERYE_SHOT_PLAN_ESTIMATED_USD: '.2' });
  expect(value.analysis.ready).toBe(true); expect(value.stages.analysis.status).toBe('configured-unverified');
  expect(value.stages.shots.ready).toBe(true); expect(value.stages.video.ready).toBe(false);
});

it('does not treat the default project name as configured Google access', () => {
  const value = workflowCapabilities({ CINESERYE_PROVIDER_MODE: 'live' });
  expect(value.version).toBe(2);
  for (const key of ['research', 'analysis', 'story', 'shots', 'images', 'video'] as const) {
    expect(value.stages[key]).toMatchObject({ configured: false, ready: false, status: 'blocked' });
    expect(value.stages[key].blockers.length).toBeGreaterThan(0);
  }
  expect(value.legacyPlanning.planning.configured).toBe(false);
  expect(value.stages.uploads).toMatchObject({ status: 'local-only', ready: true, preflightPath: null });
});

it('keeps missing research separate from configured Story access and legacy planning admission', () => {
  const value = workflowCapabilities({ ...enabled, PARALLEL_API_KEY: '', CINESERYE_STORY_LIVE_ENABLED: 'true', CINESERYE_STORY_MAX_ESTIMATED_USD: '.1' });
  expect(value.stages.story.status).toBe('configured-unverified');
  expect(value.stages.research.status).toBe('blocked');
  expect(value.stages.shots.status).toBe('blocked');
  expect(value.legacyPlanning.livePreflight.ready).toBe(false);
});

it('shares video policy without converting the operator verification flag into verified evidence', () => {
  for (const environment of [enabled, { ...enabled, CINESERYE_VIDEO_USD_PER_SECOND: '.1', CINESERYE_VIDEO_MAX_ESTIMATED_USD: '1', CINESERYE_VIDEO_LIVE_ENABLED: 'true', CINESERYE_VIDEO_LIVE_VERIFIED: 'true' }]) {
    const policy = videoPolicy(environment), value = workflowCapabilities(environment);
    expect(value.stages.video.model).toBe(policy.profile.model);
    for (const blocker of policy.blockers) expect(value.stages.video.blockers).toContain(blocker);
    expect(value.stages.video.status).toBe(policy.blockers.length ? 'blocked' : 'requires-preflight');
    expect(value.stages.video.ready).toBe(false);
    expect(value.proof).toBe('configuration-only');
  }
});

it('rejects older contracts, impossible readiness, mismatched modes and unsupported execution claims', () => {
  const valid = workflowCapabilities({ CINESERYE_E2E_FIXTURE: 'true' });
  const changes = [
    (value: typeof valid) => { Object.assign(value, { version: 1 }); },
    (value: typeof valid) => { value.stages.story.ready = false; },
    (value: typeof valid) => { value.stages.story.status = 'blocked'; },
    (value: typeof valid) => { value.stages.story.configured = false; },
    (value: typeof valid) => { value.stages.story.blockers.push('Blocked'); },
    (value: typeof valid) => { value.story.mode = 'live'; },
    (value: typeof valid) => { value.runtime = 'unsupported'; },
  ];
  for (const change of changes) { const value = structuredClone(valid); change(value); expect(WorkflowCapabilitiesSchema.safeParse(value).success).toBe(false); }
});
