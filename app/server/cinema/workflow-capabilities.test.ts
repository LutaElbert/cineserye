import { expect, it } from 'vitest';
import { workflowCapabilities } from './workflow-capabilities';
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
