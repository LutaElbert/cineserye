export type PromptPurpose = 'scene-direction' | 'reference-sheet' | 'storyboard' | 'video';

export type PromptArtifact = {
  id: string;
  ownerNodeId: string;
  label: string;
  purpose: PromptPurpose;
  providerProfile: 'generic' | 'vertex-veo';
  generatedText: string;
  negativeConstraints: string[];
  continuitySourceIds: string[];
  researchSourceIds: string[];
  version: number;
  status: 'draft' | 'approved';
};

export type ResearchSource = {
  id: string;
  title: string;
  publisher: string;
  finding: string;
  status: 'supported' | 'needs-verification' | 'irrelevant';
  creatorPinned: boolean;
  isMock: boolean;
  url?: string | null;
  queryPurpose: string;
  retrievedAt: string;
  usageCount: number;
};

export type CostEstimate = {
  pricingMode: 'unpriced' | 'credits' | 'currency';
  currency: 'PHP' | 'USD' | null;
  minimum: number | null;
  expected: number | null;
  highRisk: number | null;
  ceiling: number | null;
  isIllustrative: true;
  assumptionProfileVersion: 1;
  provider: string;
  model: string;
  resolution: string;
  outputCount: number;
  retryAllowance: number;
  pricingSnapshotDate: string | null;
  assumptions: string[];
};

export type CinemaPresentationKind =
  | 'story'
  | 'scene'
  | 'shot'
  | 'character'
  | 'asset'
  | 'agent-run';

export type CinemaNodePresentation = {
  nodeId: string;
  kind: CinemaPresentationKind;
  title: string;
  summary: string;
  statusLabel: string;
  metricLabel: string;
  risk: 'none' | 'low' | 'medium' | 'high';
  fields: ReadonlyArray<{ label: string; value: string }>;
  tags: readonly string[];
  promptIds: readonly string[];
  sourceIds: readonly string[];
  cost?: Pick<CostEstimate, 'pricingMode' | 'currency' | 'minimum' | 'expected' | 'highRisk' | 'isIllustrative'>;
};

export type MockCinemaProject = {
  id: string;
  title: string;
  sceneNodeId: string;
  targetDurationSeconds: number;
  shotNodeIds: string[];
  nodes: Record<string, CinemaNodePresentation>;
  prompts: Record<string, PromptArtifact>;
  sources: Record<string, ResearchSource>;
  cost: CostEstimate;
};

export type CinemaProjectPresentation = MockCinemaProject;

export function validateMockCinemaProject(project: MockCinemaProject): MockCinemaProject {
  if (!project.nodes[project.sceneNodeId]) throw new Error('The mock scene node is missing.');

  const shotSeconds = project.shotNodeIds.reduce((total, id) => {
    const node = project.nodes[id];
    if (!node || node.kind !== 'shot') throw new Error(`Mock shot ${id} is missing.`);
    const duration = node.fields.find((field) => field.label === 'Duration')?.value;
    const seconds = Number(duration?.replace(/\D/g, ''));
    if (!Number.isFinite(seconds)) throw new Error(`Mock shot ${id} has no duration.`);
    return total + seconds;
  }, 0);
  if (shotSeconds !== project.targetDurationSeconds) {
    throw new Error('Mock shot durations do not match the project duration.');
  }

  for (const node of Object.values(project.nodes)) {
    for (const promptId of node.promptIds) {
      const prompt = project.prompts[promptId];
      if (!prompt || prompt.ownerNodeId !== node.nodeId) {
        throw new Error(`Mock prompt ${promptId} does not resolve to ${node.nodeId}.`);
      }
    }
    for (const sourceId of node.sourceIds) {
      if (!project.sources[sourceId]) throw new Error(`Mock source ${sourceId} is missing.`);
    }
  }

  for (const prompt of Object.values(project.prompts)) {
    for (const sourceId of prompt.researchSourceIds) {
      if (!project.sources[sourceId]) throw new Error(`Prompt source ${sourceId} is missing.`);
    }
    for (const nodeId of prompt.continuitySourceIds) {
      if (!project.nodes[nodeId]) throw new Error(`Prompt continuity source ${nodeId} is missing.`);
    }
  }

  if (
    project.cost.minimum !== null
    && project.cost.expected !== null
    && project.cost.highRisk !== null
    && (project.cost.minimum > project.cost.expected || project.cost.expected > project.cost.highRisk)
  ) {
    throw new Error('Mock cost ranges are out of order.');
  }
  return project;
}
