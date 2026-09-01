import type { CinemaProjectData, CinemaResearchSourceRecord } from '../../domain/cinema/project-data';
import type { ScenePlanningBrief } from '../../domain/cinema/scene-brief';

export type ProviderRequestContext = {
  runId: string;
  signal: AbortSignal;
};

export type ResearchProviderRequest = ProviderRequestContext & {
  brief: ScenePlanningBrief;
};

export type ResearchProviderResult = {
  provider: string;
  sources: CinemaResearchSourceRecord[];
  warnings: string[];
};

export interface ResearchProvider {
  readonly id: string;
  research(request: ResearchProviderRequest): Promise<ResearchProviderResult>;
}

export type ShotPlannerProviderRequest = ProviderRequestContext & {
  brief: ScenePlanningBrief;
  research: ResearchProviderResult;
};

export type ShotPlannerProviderResult = {
  provider: string;
  model: string;
  cinema: CinemaProjectData;
  warnings: string[];
};

export interface ShotPlannerProvider {
  readonly id: string;
  plan(request: ShotPlannerProviderRequest): Promise<ShotPlannerProviderResult>;
}
