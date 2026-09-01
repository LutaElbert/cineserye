import { REEL_KNOWS_TOMORROW, MOCK_CINEMA_PROJECT_DATA } from '../../domain/cinema/mock/reel-knows-tomorrow';
import type { CinemaProjectData } from '../../domain/cinema/project-data';
import type {
  ResearchProvider,
  ResearchProviderRequest,
  ResearchProviderResult,
  ShotPlannerProvider,
  ShotPlannerProviderRequest,
  ShotPlannerProviderResult,
} from './provider-contracts';

const BASE_DURATIONS = [6, 5, 7, 6, 5, 7];

function distributeDuration(target: number): number[] {
  const total = BASE_DURATIONS.reduce((sum, duration) => sum + duration, 0);
  const scaled = BASE_DURATIONS.map((duration) => Math.max(1, Math.floor((duration / total) * target)));
  let remainder = target - scaled.reduce((sum, duration) => sum + duration, 0);
  for (let index = 0; remainder > 0; index = (index + 1) % scaled.length) {
    scaled[index] += 1;
    remainder -= 1;
  }
  return scaled;
}

function fixtureCinema(request: ShotPlannerProviderRequest): CinemaProjectData {
  const cinema = structuredClone(MOCK_CINEMA_PROJECT_DATA);
  const baseRun = cinema.agentRuns['cine-agent-plan'];
  delete cinema.agentRuns['cine-agent-plan'];
  cinema.agentRuns[request.runId] = {
    ...baseRun,
    id: request.runId,
    status: 'ready',
    sourceIds: request.research.sources.map((source) => source.id),
    startedAt: new Date().toISOString(),
    completedAt: null,
  };
  cinema.scenes['scene-01'].synopsis = request.brief.sceneText;
  cinema.scenes['scene-01'].brief = {
    version: 2,
    creationMode: request.brief.creationMode,
    aspectRatio: request.brief.aspectRatio,
    targetPlatform: request.brief.targetPlatform,
    genreTone: request.brief.genreTone,
    locationPeriod: request.brief.locationPeriod,
    dialogueAudioIntent: request.brief.dialogueAudioIntent,
    targetDurationSeconds: request.brief.targetDurationSeconds,
    requiredBeats: [...request.brief.requiredBeats],
    mustInclude: [...request.brief.mustInclude],
    mustAvoid: [...request.brief.mustAvoid],
    generationBudget: structuredClone(request.brief.generationBudget),
    productionConstraints: structuredClone(request.brief.productionConstraints),
  };

  const durations = distributeDuration(request.brief.targetDurationSeconds);
  cinema.scenes['scene-01'].shotIds.forEach((shotId, index) => {
    cinema.shots[shotId].durationSeconds = durations[index];
  });
  for (const prompt of Object.values(cinema.prompts)) {
    prompt.runId = request.runId;
    prompt.generatedText = `${request.brief.genreTone}. ${request.brief.locationPeriod}. ${prompt.generatedText}`;
  }
  cinema.sources = Object.fromEntries(request.research.sources.map((source) => [source.id, {
    ...source,
    runId: request.runId,
  }]));
  for (const cost of Object.values(cinema.costs)) {
    cost.runId = request.runId;
    cost.pricingMode = request.brief.generationBudget.pricingMode;
    cost.currency = request.brief.generationBudget.currency;
    cost.ceiling = request.brief.generationBudget.ceiling;
    cost.retryAllowance = Math.max(0, request.brief.generationBudget.maxAttempts - 1);
    cost.resolution = request.brief.aspectRatio;
    if (cost.pricingMode === 'unpriced') {
      cost.minimum = null;
      cost.expected = null;
      cost.highRisk = null;
    }
  }
  const cost = cinema.costs['cost-scene-01'];
  if (cost.ceiling !== null && cost.expected !== null && cost.expected > cost.ceiling) {
    cinema.agentRuns[request.runId].warnings.push(
      'The expected generation estimate exceeds the confirmed ceiling.',
    );
  }
  return cinema;
}

export class FixtureResearchProvider implements ResearchProvider {
  readonly id = 'fixture-research';

  async research(request: ResearchProviderRequest): Promise<ResearchProviderResult> {
    if (request.signal.aborted) throw request.signal.reason;
    return {
      provider: this.id,
      sources: Object.values(REEL_KNOWS_TOMORROW.sources).map((source) => ({
        id: source.id,
        runId: request.runId,
        title: source.title,
        publisher: source.publisher,
        url: null,
        finding: source.finding,
        queryPurpose: 'Deterministic fixture for production reference planning',
        status: source.status,
        creatorPinned: false,
        isMock: true,
        retrievedAt: '2026-09-01T00:00:00.000Z',
      })),
      warnings: ['Research sources are deterministic local fixtures.'],
    };
  }
}

export class FixtureShotPlannerProvider implements ShotPlannerProvider {
  readonly id = 'fixture-shot-planner';

  async plan(request: ShotPlannerProviderRequest): Promise<ShotPlannerProviderResult> {
    if (request.signal.aborted) throw request.signal.reason;
    const cinema = fixtureCinema(request);
    return {
      provider: this.id,
      model: 'fixture-v1',
      cinema,
      warnings: [...request.research.warnings, ...cinema.agentRuns[request.runId].warnings],
    };
  }
}
