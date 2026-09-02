import type { CinemaProjectData } from './project-data';

export type CinemaSceneBoundaryProposal = {
  id: string;
  title: string;
  synopsis: string;
  beatSummary: string;
  sourceIndex: number;
};

export type CinemaSharedEntityVariantRecord = {
  id: string;
  entityNodeId: string;
  sceneId: string;
  wardrobe: string;
  ageOrCondition: string;
  timeOfDay: string;
  locationVariant: string;
  notes: string;
};

export type CinemaProjectContinuityException = {
  id: string;
  entityNodeId: string;
  sceneId: string;
  shotIds: string[];
  rationale: string;
};

export type CinemaMultiSceneData = {
  version: 1;
  sceneOrder: string[];
  sharedEntityVariants: Record<string, CinemaSharedEntityVariantRecord>;
  continuityExceptions: Record<string, CinemaProjectContinuityException>;
};

export type CinemaProjectTotals = {
  scenes: number;
  plannedScenes: number;
  shots: number;
  durationSeconds: number;
  expectedCost: number | null;
  storyboardFrames: number;
  approvedClips: number;
};

export type CinemaSequenceEntry = {
  sceneId: string;
  sceneNumber: number;
  shotId: string | null;
  shotNumber: number | null;
  productionOrder: number | null;
  title: string;
  durationSeconds: number;
  status: 'approved-clip' | 'approved-frame' | 'failed' | 'missing' | 'unplanned';
  artifactId: string | null;
};

export type CinemaContinuityImpact = {
  entityNodeId: string;
  title: string;
  affectedSceneIds: string[];
  affectedShotIds: string[];
  variantIds: string[];
};

const MAX_SCENES = 100;

export function createDefaultMultiSceneData(
  project: Pick<CinemaProjectData, 'sceneOrder'>,
): CinemaMultiSceneData {
  return { version: 1, sceneOrder: [...project.sceneOrder], sharedEntityVariants: {}, continuityExceptions: {} };
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${label} is invalid.`);
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, max = 20_000): string {
  if (typeof value !== 'string' || value.length > max) throw new Error(`${label} is invalid.`);
  return value;
}

function requiredText(value: unknown, label: string, max = 20_000): string {
  const result = text(value, label, max).trim();
  if (!result) throw new Error(`${label} is required.`);
  return result;
}

function ids(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length > 500) throw new Error(`${label} is invalid.`);
  const result = value.map((item) => requiredText(item, label, 160));
  if (new Set(result).size !== result.length) throw new Error(`${label} contains duplicates.`);
  return result;
}

function keyed<T extends { id: string }>(value: unknown, label: string, parse: (source: Record<string, unknown>) => T): Record<string, T> {
  const source = record(value, label);
  if (Object.keys(source).length > 2_500) throw new Error(`${label} is too large.`);
  return Object.fromEntries(Object.entries(source).map(([key, item]) => {
    const parsed = parse(record(item, `${label} ${key}`));
    if (parsed.id !== key) throw new Error(`${label} key does not match its id.`);
    return [key, parsed];
  }));
}

export function validateMultiSceneData(
  value: unknown,
  project: Pick<CinemaProjectData, 'sceneOrder' | 'scenes' | 'shots' | 'characters' | 'assets'>,
): CinemaMultiSceneData {
  if (value === undefined) return createDefaultMultiSceneData(project as Pick<CinemaProjectData, 'sceneOrder'>);
  const source = record(value, 'Multi-scene data');
  if (source.version !== 1) throw new Error('Multi-scene data version is unsupported.');
  const sceneOrder = ids(source.sceneOrder, 'Multi-scene order');
  if (sceneOrder.length !== project.sceneOrder.length || sceneOrder.some((sceneId) => !project.scenes[sceneId])) {
    throw new Error('Multi-scene order must contain every project scene exactly once.');
  }
  const entityByNode = new Map<string, { title: string; sceneIds: string[] }>([
    ...Object.values(project.characters).map((entity) => [entity.nodeId, entity] as const),
    ...Object.values(project.assets).map((entity) => [entity.nodeId, entity] as const),
  ]);
  const sharedEntityVariants = keyed(source.sharedEntityVariants, 'Shared entity variant', (item) => {
    const entityNodeId = requiredText(item.entityNodeId, 'Variant entity id', 160);
    const sceneId = requiredText(item.sceneId, 'Variant scene id', 160);
    const entity = entityByNode.get(entityNodeId);
    if (!entity || !entity.sceneIds.includes(sceneId) || !project.scenes[sceneId]) throw new Error('Shared entity variant must resolve to one of its scenes.');
    return {
      id: requiredText(item.id, 'Variant id', 160), entityNodeId, sceneId,
      wardrobe: text(item.wardrobe, 'Variant wardrobe', 2_000),
      ageOrCondition: text(item.ageOrCondition, 'Variant age or condition', 2_000),
      timeOfDay: text(item.timeOfDay, 'Variant time of day', 500),
      locationVariant: text(item.locationVariant, 'Variant location', 2_000),
      notes: text(item.notes, 'Variant notes'),
    };
  });
  const continuityExceptions = keyed(source.continuityExceptions, 'Project continuity exception', (item) => {
    const entityNodeId = requiredText(item.entityNodeId, 'Exception entity id', 160);
    const sceneId = requiredText(item.sceneId, 'Exception scene id', 160);
    const shotIds = ids(item.shotIds, 'Exception shot ids');
    if (!entityByNode.has(entityNodeId) || !project.scenes[sceneId]) throw new Error('Continuity exception target is missing.');
    shotIds.forEach((shotId) => {
      if (project.shots[shotId]?.sceneId !== sceneId) throw new Error('Continuity exception shot is outside its scene.');
    });
    return {
      id: requiredText(item.id, 'Exception id', 160), entityNodeId, sceneId, shotIds,
      rationale: requiredText(item.rationale, 'Exception rationale', 4_000),
    };
  });
  return { version: 1, sceneOrder, sharedEntityVariants, continuityExceptions };
}

function proposalTitle(source: string, index: number): string {
  const heading = source.split('\n')[0].replace(/^(?:#{1,6}\s*|SCENE\s*\d*\s*[:.\-]?\s*)/i, '').trim();
  return heading.slice(0, 120) || `Scene ${String(index + 1).padStart(2, '0')}`;
}

export function proposeSceneBoundaries(source: string): CinemaSceneBoundaryProposal[] {
  const normalized = source.replace(/\r\n?/g, '\n').trim();
  if (!normalized) throw new Error('Paste a treatment or scene outline first.');
  if (normalized.length > 50_000) throw new Error('Treatment input is too large.');
  const lines = normalized.split('\n');
  const hasHeadings = lines.some((line) => /^(?:#{1,6}\s+|SCENE\s*\d*\s*[:.\-]|INT\.|EXT\.|INT\/EXT\.)/i.test(line.trim()));
  const chunks: string[] = [];
  if (hasHeadings) {
    let current: string[] = [];
    for (const line of lines) {
      if (/^(?:#{1,6}\s+|SCENE\s*\d*\s*[:.\-]|INT\.|EXT\.|INT\/EXT\.)/i.test(line.trim()) && current.length) {
        chunks.push(current.join('\n').trim());
        current = [];
      }
      if (line.trim() || current.length) current.push(line);
    }
    if (current.length) chunks.push(current.join('\n').trim());
  } else {
    chunks.push(...normalized.split(/\n\s*\n+/).map((chunk) => chunk.trim()).filter(Boolean));
  }
  if (!chunks.length || chunks.length > MAX_SCENES) throw new Error('Treatment must propose between 1 and 100 scenes.');
  return chunks.map((chunk, index) => {
    const title = proposalTitle(chunk, index);
    const body = chunk.split('\n').slice(1).join(' ').trim() || chunk.trim();
    return {
      id: `scene-boundary-${index + 1}`,
      title,
      synopsis: body.slice(0, 2_000),
      beatSummary: body.replace(/\s+/g, ' ').slice(0, 240),
      sourceIndex: index,
    };
  });
}

export function calculateProjectTotals(project: CinemaProjectData): CinemaProjectTotals {
  const expected = Object.values(project.costs).map((cost) => cost.expected).filter((value): value is number => value !== null);
  const visual = project.visualPreproduction;
  return {
    scenes: project.sceneOrder.length,
    plannedScenes: project.sceneOrder.filter((sceneId) => project.scenes[sceneId].shotIds.length > 0 && Object.values(project.revisions).some((revision) => revision.sceneId === sceneId)).length,
    shots: Object.keys(project.shots).length,
    durationSeconds: Object.values(project.shots).reduce((sum, shot) => sum + shot.durationSeconds, 0),
    expectedCost: expected.length ? expected.reduce((sum, value) => sum + value, 0) : null,
    storyboardFrames: Object.keys(visual?.storyboardFrames ?? {}).length,
    approvedClips: Object.values(visual?.videoClips ?? {}).filter((clip) => clip.status === 'approved').length,
  };
}

export function analyzeContinuityImpact(project: CinemaProjectData, entityNodeId: string): CinemaContinuityImpact {
  const entity = [...Object.values(project.characters), ...Object.values(project.assets)].find((candidate) => candidate.nodeId === entityNodeId);
  if (!entity) throw new Error('Shared continuity entity is missing.');
  const affectedShotIds = Object.values(project.shots)
    .filter((shot) => shot.continuityNodeIds.includes(entityNodeId))
    .sort((left, right) => project.sceneOrder.indexOf(left.sceneId) - project.sceneOrder.indexOf(right.sceneId) || left.order - right.order)
    .map((shot) => shot.id);
  const variantIds = Object.values(project.multiScene?.sharedEntityVariants ?? {})
    .filter((variant) => variant.entityNodeId === entityNodeId)
    .map((variant) => variant.id);
  return {
    entityNodeId,
    title: entity.title,
    affectedSceneIds: [...entity.sceneIds].sort((left, right) => project.sceneOrder.indexOf(left) - project.sceneOrder.indexOf(right)),
    affectedShotIds,
    variantIds,
  };
}

export function buildProjectSequence(project: CinemaProjectData): CinemaSequenceEntry[] {
  const visual = project.visualPreproduction;
  const sequence: CinemaSequenceEntry[] = [];
  project.sceneOrder.forEach((sceneId, sceneIndex) => {
    const scene = project.scenes[sceneId];
    if (!scene.shotIds.length) {
      sequence.push({
        sceneId, sceneNumber: sceneIndex + 1, shotId: null, shotNumber: null, productionOrder: null,
        title: scene.title, durationSeconds: 0, status: 'unplanned', artifactId: null,
      });
      return;
    }
    scene.shotIds.forEach((shotId) => {
      const shot = project.shots[shotId];
      const clip = Object.values(visual?.videoClips ?? {}).find((candidate) => candidate.shotId === shotId && candidate.status === 'approved');
      const frame = Object.values(visual?.storyboardFrames ?? {}).find((candidate) => candidate.shotId === shotId && candidate.status === 'approved');
      const failed = Object.values(visual?.videoOperations ?? {}).some((candidate) => candidate.shotId === shotId && ['failed', 'timed-out'].includes(candidate.status));
      sequence.push({
        sceneId, sceneNumber: sceneIndex + 1, shotId, shotNumber: shot.order,
        productionOrder: project.professionalPlanning?.shots[shotId]?.productionOrder ?? shot.order,
        title: shot.title,
        durationSeconds: shot.durationSeconds,
        status: clip ? 'approved-clip' : frame ? 'approved-frame' : failed ? 'failed' : 'missing',
        artifactId: clip?.id ?? frame?.id ?? null,
      });
    });
  });
  return sequence;
}

export function upsertSharedEntityVariant(data: CinemaMultiSceneData, variant: CinemaSharedEntityVariantRecord): CinemaMultiSceneData {
  return { ...structuredClone(data), sharedEntityVariants: { ...structuredClone(data.sharedEntityVariants), [variant.id]: structuredClone(variant) } };
}
