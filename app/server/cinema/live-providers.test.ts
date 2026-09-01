import { describe, expect, it, vi } from 'vitest';
import { validateCinemaProjectData } from '../../domain/cinema/project-data';
import type { ScenePlanningBrief } from '../../domain/cinema/scene-brief';
import { applyCanvasCommandProposal } from '../../editor/canvas-commands';
import { initialDocument } from '../../editor/initial-document';
import { ParallelResearchProvider } from './parallel-research-provider';
import { compileCinemaCanvasProposal } from './proposal-compiler';
import type { ResearchProviderResult, ShotPlannerProviderRequest } from './provider-contracts';
import { VertexAdkShotPlannerProvider } from './vertex-adk-shot-planner';

const sceneBrief: ScenePlanningBrief = {
  version: 1,
  sceneNodeId: 'scene-01',
  sceneText: 'A courier discovers a voice note recorded by her future self inside a rain-soaked jeepney.',
  tone: 'Intimate speculative suspense',
  locationPeriod: 'Contemporary Manila jeepney at night',
  budgetBand: 'micro',
  currency: 'PHP',
  budgetCeiling: 300,
  targetDurationSeconds: 42,
  availableEquipment: ['Phone camera', 'Small LED light'],
};

function research(): ResearchProviderResult {
  return {
    provider: 'parallel-search',
    sources: [{
      id: 'parallel-source-01',
      runId: 'run-1',
      title: 'Jeepney interiors',
      publisher: 'example.com',
      url: 'https://example.com/jeepney',
      finding: 'Chrome details and narrow bench seating provide repeatable spatial anchors.',
      queryPurpose: 'Location reference',
      status: 'pinned',
      isMock: false,
      retrievedAt: '2026-09-01T00:00:00.000Z',
    }],
    warnings: [],
  };
}

function generatedPlan() {
  const shared = {
    negativeConstraints: ['No logos', 'No extra people'],
    sourceIds: ['parallel-source-01'],
  };
  return {
    scene: {
      title: 'Scene 01 · The Future Voice Note',
      synopsis: sceneBrief.sceneText,
      dramaticPurpose: 'Reveal an impossible warning and force a choice.',
      continuityNotes: 'Keep rain direction, seat position, wardrobe, phone, and cabin geography stable.',
      directionPrompt: 'Vertical cinematic realism in a rain-soaked Manila jeepney at night.',
      ...shared,
    },
    characters: [{
      title: 'Ana',
      summary: 'A tired but observant independent courier.',
      appearanceReference: 'Filipina courier in her late twenties with tied-back dark hair.',
      voiceReference: 'Quiet, contained delivery.',
      wardrobeNotes: 'Navy rain jacket and canvas sling bag.',
      referencePrompt: 'Neutral character turnaround for Ana in consistent courier wardrobe.',
      ...shared,
    }],
    assets: [
      {
        title: 'Night Jeepney Interior',
        category: 'location' as const,
        summary: 'A reusable narrow chrome-and-vinyl passenger cabin.',
        continuityNotes: 'Wet chrome rails, blue vinyl benches, amber cabin lamp.',
        referencePrompt: 'Empty vertical location reference of a rain-soaked jeepney interior.',
        ...shared,
      },
      {
        title: 'Cracked Phone',
        category: 'prop' as const,
        summary: 'The hero prop carrying the future message.',
        continuityNotes: 'Black phone with one diagonal screen crack.',
        referencePrompt: 'Neutral hero prop reference of a black phone with a diagonal crack.',
        ...shared,
      },
    ],
    shots: [
      {
        title: 'Last Passenger', description: 'Ana sits alone while rain trails across the windows.',
        purpose: 'Establish isolation and geography.', framing: 'Wide vertical', cameraMovement: 'Slow push-in',
        lensMm: 24, durationSeconds: 10, audio: 'Rain and engine idle.', risk: 'low' as const,
        characterIndexes: [0], assetIndexes: [0], storyboardPrompt: 'One decisive frame of Ana alone.',
        videoPrompt: 'Ana sits alone as rain moves across the jeepney windows.', ...shared,
      },
      {
        title: 'Impossible Timestamp', description: 'The cracked phone lights with tomorrow’s date.',
        purpose: 'Reveal the impossible clue.', framing: 'Extreme close-up', cameraMovement: 'Locked',
        lensMm: 50, durationSeconds: 12, audio: 'Phone vibration and rain.', risk: 'medium' as const,
        characterIndexes: [0], assetIndexes: [0, 1], storyboardPrompt: 'Phone insert with future timestamp.',
        videoPrompt: 'The cracked phone wakes and shows tomorrow’s timestamp.', ...shared,
      },
      {
        title: 'Her Own Warning', description: 'Ana hears her future voice as the cabin light fails.',
        purpose: 'Deliver the warning and end on a decision.', framing: 'Medium close-up', cameraMovement: 'Handheld drift',
        lensMm: 35, durationSeconds: 14, audio: 'Future voice note under failing engine hum.', risk: 'high' as const,
        characterIndexes: [0], assetIndexes: [0, 1], storyboardPrompt: 'Ana hears her own warning in darkness.',
        videoPrompt: 'Ana listens as the cabin light fails, holding the same cracked phone.', ...shared,
      },
    ],
    costAssumptions: ['One location, one performer, and three generated video shots.'],
    warnings: [],
  };
}

describe('ParallelResearchProvider', () => {
  it('normalizes, bounds, and deduplicates supported research results', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      results: [
        { url: 'https://example.com/a', title: 'Source A', excerpts: ['Useful finding A.'] },
        { url: 'https://example.com/a', title: 'Duplicate', excerpts: ['Duplicate.'] },
        { url: 'ftp://example.com/b', title: 'Unsafe', excerpts: ['Unsafe.'] },
        { url: 'https://reference.test/b', title: 'Source B', excerpts: [{ text: 'Useful finding B.' }] },
      ],
    }))) as unknown as typeof fetch;
    const provider = new ParallelResearchProvider('server-secret', fetchMock);
    const result = await provider.research({
      runId: 'run-1',
      brief: sceneBrief,
      signal: new AbortController().signal,
    });

    expect(result.sources).toHaveLength(2);
    expect(result.sources.map((source) => source.url)).toEqual([
      'https://example.com/a',
      'https://reference.test/b',
    ]);
    const [, init] = vi.mocked(fetchMock).mock.calls[0];
    expect(new Headers(init?.headers).get('x-api-key')).toBe('server-secret');
    const body = JSON.parse(String(init?.body));
    expect(body.search_queries).toHaveLength(4);
    expect(JSON.stringify(result)).not.toContain('server-secret');
  });

  it('returns a retryable typed error when rate limited', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 429 })) as unknown as typeof fetch;
    const provider = new ParallelResearchProvider('server-secret', fetchMock);
    await expect(provider.research({
      runId: 'run-1', brief: sceneBrief, signal: new AbortController().signal,
    })).rejects.toMatchObject({ code: 'RATE_LIMITED', retryable: true });
  });
});

describe('VertexAdkShotPlannerProvider', () => {
  const request: ShotPlannerProviderRequest = {
    runId: 'run-1',
    brief: sceneBrief,
    research: research(),
    signal: new AbortController().signal,
  };

  it('compiles injected ADK structured output into validated domain records', async () => {
    const provider = new VertexAdkShotPlannerProvider(
      'cineserye',
      'global',
      'gemini-3.7-flash',
      async () => generatedPlan(),
    );
    const result = await provider.plan(request);

    expect(Object.keys(result.cinema.shots)).toHaveLength(3);
    expect(Object.values(result.cinema.shots).reduce((sum, shot) => sum + shot.durationSeconds, 0)).toBe(42);
    expect(Object.values(result.cinema.prompts).filter((prompt) => prompt.purpose === 'storyboard')).toHaveLength(3);
    expect(Object.values(result.cinema.prompts).filter((prompt) => prompt.purpose === 'video')).toHaveLength(3);
    expect(result.cinema.agentRuns['run-1']).toMatchObject({
      researchProvider: 'parallel-search',
      planningProvider: 'vertex-adk',
      model: 'gemini-3.7-flash',
      status: 'ready',
    });
    expect(result.warnings).toContain('The expected generation estimate exceeds the confirmed ceiling.');
    const proposal = compileCinemaCanvasProposal('run-1', result.cinema);
    const applied = applyCanvasCommandProposal(initialDocument, proposal);
    expect(applied.document.nodes).toHaveLength(9);
    expect(() => validateCinemaProjectData(
      result.cinema,
      new Set(applied.document.nodes.map((node) => node.id)),
    )).not.toThrow();
  });

  it('rejects unresolved model continuity indexes before command compilation', async () => {
    const invalid = generatedPlan();
    invalid.shots[0].assetIndexes = [99];
    const provider = new VertexAdkShotPlannerProvider(
      'cineserye', 'global', 'gemini-3.7-flash', async () => invalid,
    );
    await expect(provider.plan(request)).rejects.toMatchObject({ code: 'UNEXPECTED_RESPONSE' });
  });
});
