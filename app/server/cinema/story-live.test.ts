import { describe, expect, it } from 'vitest';
import { AssistantAnalysisSchema } from '../../domain/cinema/story-assistant';
import { StoryResultSchema, type StoryInput } from '../../features/story-development/contracts';
import { assistantQuote, liveAnalysis } from './story-assistant';
import { liveStory, storyQuote, validateStoryResult } from './story-development';

// Two real calls, no references/research/media, no retries. Setting the flag is
// not enough: feature gates and an explicit two-call estimate approval must pass.
// This is a production-schema smoke, not a creative-quality evaluation score.
const optedIn = process.env.CINESERYE_RUN_STORY_LIVE_SMOKE === '1';
function guard() {
  const analysis = assistantQuote('live'), story = storyQuote('live');
  const approved = Number(process.env.CINESERYE_STORY_SMOKE_APPROVED_USD ?? NaN);
  if (!analysis.ready || !story.ready || !Number.isFinite(approved) || approved <= 0 || analysis.cost + story.cost > approved) {
    throw Error('Live smoke requires enabled feature preflight and separate approval covering the two declared estimates.');
  }
}
const premise = 'Four friends play a cursed board game in one room. Horror and Mystery. Sixty seconds total, vertical 9:16. No dialogue. All four survive.';
describe.skipIf(!optedIn)('opt-in production story provider schemas — two paid calls', () => {
  it('returns bounded actual-model analysis and contextual question data', async () => {
    guard();
    const result = await liveAnalysis({ version: 1, projectId: 'story-schema-smoke', premiseNodeId: 'story', premise,
      goal: 'expand', anchorSceneId: null, context: [], references: [], explicit: [], referenceRevision: 0 }, process.env);
    expect(AssistantAnalysisSchema.safeParse(result).success).toBe(true);
    expect(result.questions?.length ?? 0).toBeLessThanOrEqual(3);
  }, 100_000);
  it('returns an actual-model outline satisfying the declared count, runtime and constraint ledger', async () => {
    guard();
    const input: StoryInput = { version: 1, projectId: 'story-schema-smoke', count: 3, context: [], references: [], anchorSceneId: null, revise: [],
      brief: { version: 1, mode: 'expand', sourceDigest: 'a'.repeat(64), premise, aspectRatio: '9:16', platform: 'other',
        durationSeconds: 60, durationScope: 'whole-story', tone: 'Suspense', genres: ['Horror', 'Mystery'], ending: 'All four survive',
        constraints: ['No dialogue', 'All four survive', 'One room'], assumptions: [], status: 'approved', answers: [] } };
    const result = validateStoryResult(await liveStory(input, AbortSignal.timeout(90_000)), input);
    expect(StoryResultSchema.safeParse(result).success).toBe(true);
    expect(result.proposals).toHaveLength(3);
  }, 100_000);
});
