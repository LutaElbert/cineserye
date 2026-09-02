import type {
  CinemaAssetRecord,
  CinemaCharacterRecord,
  CinemaProjectData,
  CinemaShotRecord,
} from './project-data';

export type CinemaProductionStatus = 'planned' | 'ready' | 'captured' | 'skipped';

export type CinemaProductionSetupRecord = {
  id: string;
  sceneId: string;
  name: string;
  camera: string;
  lens: string;
  lighting: string;
  location: string;
  equipment: string[];
  notes: string;
  estimatedSetupMinutes: number;
  shotIds: string[];
};

export type CinemaShotProductionRecord = {
  shotId: string;
  revisionId: string | null;
  productionOrder: number;
  setupId: string;
  status: CinemaProductionStatus;
  estimatedCost: number | null;
};

export type CinemaContinuityExceptionRecord = {
  id: string;
  sceneId: string;
  entityNodeId: string;
  fromShotId: string;
  toShotId: string;
  rationale: string;
};

export type CinemaProfessionalPlanningData = {
  version: 1;
  setups: Record<string, CinemaProductionSetupRecord>;
  shots: Record<string, CinemaShotProductionRecord>;
  continuityStates: Record<string, Record<string, string>>;
  continuityExceptions: Record<string, CinemaContinuityExceptionRecord>;
};

export type CinemaContinuityCell = {
  shotId: string;
  entityNodeId: string;
  state: string;
  included: boolean;
};

export type CinemaContinuityIssue = {
  id: string;
  kind: 'missing' | 'conflict';
  sceneId: string;
  entityNodeId: string;
  shotIds: string[];
  message: string;
};

export type CinemaContinuityRow = {
  entityNodeId: string;
  title: string;
  category: 'character' | 'location' | 'prop' | 'wardrobe' | 'style' | 'audio' | 'other';
  cells: CinemaContinuityCell[];
};

export type CinemaContinuityMatrix = {
  sceneId: string;
  shotIds: string[];
  rows: CinemaContinuityRow[];
  issues: CinemaContinuityIssue[];
};

const MAX_TEXT = 20_000;
const MAX_SHORT_TEXT = 500;
const MAX_ITEMS = 2_500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, label: string, max = MAX_TEXT) {
  if (typeof value !== 'string' || value.length > max) throw new Error(`${label} is invalid or too long.`);
  return value;
}

function id(value: unknown, label: string) {
  const result = text(value, label, 160);
  if (!result) throw new Error(`${label} is required.`);
  return result;
}

function number(value: unknown, label: string, { positive = false }: { positive?: boolean } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (positive && value <= 0)) {
    throw new Error(`${label} is invalid.`);
  }
  return value;
}

function integer(value: unknown, label: string, { positive = false }: { positive?: boolean } = {}) {
  const result = number(value, label, { positive });
  if (!Number.isInteger(result)) throw new Error(`${label} must be a whole number.`);
  return result;
}

function idList(value: unknown, label: string) {
  if (!Array.isArray(value) || value.length > MAX_ITEMS) throw new Error(`${label} is invalid or too large.`);
  const result = value.map((item, index) => id(item, `${label} item ${index + 1}`));
  if (new Set(result).size !== result.length) throw new Error(`${label} contains duplicate ids.`);
  return result;
}

function stringList(value: unknown, label: string) {
  if (!Array.isArray(value) || value.length > 100) throw new Error(`${label} is invalid or too large.`);
  return value.map((item, index) => text(item, `${label} item ${index + 1}`, MAX_SHORT_TEXT));
}

function defaultSetupId(sceneId: string) {
  return `setup-${sceneId}-primary`;
}

function sceneExpectedCost(project: Pick<CinemaProjectData, 'costs'>, sceneId: string) {
  return Object.values(project.costs)
    .filter((cost) => cost.sceneId === sceneId && cost.expected !== null)
    .sort((left, right) => left.id.localeCompare(right.id))[0]?.expected ?? null;
}

export function createDefaultProfessionalPlanningData(
  project: Pick<CinemaProjectData, 'activeRevisionId' | 'sceneOrder' | 'scenes' | 'shots' | 'costs'>,
): CinemaProfessionalPlanningData {
  const setups: Record<string, CinemaProductionSetupRecord> = {};
  const shots: Record<string, CinemaShotProductionRecord> = {};
  for (const sceneId of project.sceneOrder) {
    const scene = project.scenes[sceneId];
    if (!scene) continue;
    const setupId = defaultSetupId(sceneId);
    const orderedShotIds = [...scene.shotIds];
    const expected = sceneExpectedCost(project, sceneId);
    setups[setupId] = {
      id: setupId,
      sceneId,
      name: 'Primary setup',
      camera: 'Creator-selected camera',
      lens: 'As planned per shot',
      lighting: 'Scene lighting plan',
      location: scene.brief?.locationPeriod ?? '',
      equipment: [...(scene.brief?.productionConstraints.availableEquipment ?? [])],
      notes: 'Default production group. Split shots into additional setups when useful.',
      estimatedSetupMinutes: 20,
      shotIds: orderedShotIds,
    };
    orderedShotIds.forEach((shotId, index) => {
      shots[shotId] = {
        shotId,
        revisionId: project.activeRevisionId,
        productionOrder: index + 1,
        setupId,
        status: 'planned',
        estimatedCost: expected === null || !orderedShotIds.length
          ? null
          : Math.round((expected / orderedShotIds.length) * 100) / 100,
      };
    });
  }
  return {
    version: 1,
    setups,
    shots,
    continuityStates: Object.fromEntries(Object.values(project.shots).map((shot) => [
      shot.id,
      Object.fromEntries(shot.continuityNodeIds.map((nodeId) => [nodeId, 'present'])),
    ])),
    continuityExceptions: {},
  };
}

export function reconcileProfessionalPlanningData(
  project: Pick<CinemaProjectData, 'activeRevisionId' | 'sceneOrder' | 'scenes' | 'shots' | 'costs' | 'characters' | 'assets'>,
  current?: CinemaProfessionalPlanningData,
): CinemaProfessionalPlanningData {
  const defaults = createDefaultProfessionalPlanningData(project);
  if (!current) return defaults;
  const next = structuredClone(current);
  const validShotIds = new Set(Object.keys(project.shots));
  const validSceneIds = new Set(project.sceneOrder);
  const validContinuityNodeIds = new Set([
    ...Object.values(project.characters).map((record) => record.nodeId),
    ...Object.values(project.assets).map((record) => record.nodeId),
  ]);

  for (const shotId of Object.keys(next.shots)) if (!validShotIds.has(shotId)) delete next.shots[shotId];
  for (const shotId of Object.keys(next.continuityStates)) if (!validShotIds.has(shotId)) delete next.continuityStates[shotId];
  for (const states of Object.values(next.continuityStates)) {
    for (const nodeId of Object.keys(states)) if (!validContinuityNodeIds.has(nodeId)) delete states[nodeId];
  }
  for (const [setupId, setup] of Object.entries(next.setups)) {
    if (!validSceneIds.has(setup.sceneId)) {
      delete next.setups[setupId];
      continue;
    }
    setup.shotIds = setup.shotIds.filter((shotId) => validShotIds.has(shotId));
  }
  for (const [exceptionId, exception] of Object.entries(next.continuityExceptions)) {
    if (!validSceneIds.has(exception.sceneId)
      || !validContinuityNodeIds.has(exception.entityNodeId)
      || !validShotIds.has(exception.fromShotId)
      || !validShotIds.has(exception.toShotId)) delete next.continuityExceptions[exceptionId];
  }

  for (const sceneId of project.sceneOrder) {
    const scene = project.scenes[sceneId];
    if (!scene) continue;
    let setupIds = Object.values(next.setups).filter((setup) => setup.sceneId === sceneId).map((setup) => setup.id);
    if (!setupIds.length) {
      const setup = defaults.setups[defaultSetupId(sceneId)];
      next.setups[setup.id] = setup;
      setupIds = [setup.id];
    }
    const assigned = new Set(setupIds.flatMap((setupId) => next.setups[setupId].shotIds));
    const fallbackSetup = next.setups[setupIds[0]];
    for (const shotId of scene.shotIds) {
      if (!next.shots[shotId]) next.shots[shotId] = defaults.shots[shotId];
      next.shots[shotId].revisionId = project.activeRevisionId;
      if (!next.setups[next.shots[shotId].setupId] || !assigned.has(shotId)) {
        next.shots[shotId].setupId = fallbackSetup.id;
        if (!fallbackSetup.shotIds.includes(shotId)) fallbackSetup.shotIds.push(shotId);
      }
      next.continuityStates[shotId] ??= defaults.continuityStates[shotId] ?? {};
    }
    const productionOrder = scene.shotIds
      .map((shotId) => next.shots[shotId])
      .sort((left, right) => left.productionOrder - right.productionOrder || left.shotId.localeCompare(right.shotId));
    productionOrder.forEach((record, index) => { record.productionOrder = index + 1; });
  }
  return next;
}

export function validateProfessionalPlanningData(
  value: unknown,
  context: Pick<CinemaProjectData, 'activeRevisionId' | 'sceneOrder' | 'scenes' | 'shots' | 'costs' | 'characters' | 'assets'>,
): CinemaProfessionalPlanningData {
  if (value === undefined || value === null) return createDefaultProfessionalPlanningData(context as CinemaProjectData);
  if (!isRecord(value) || value.version !== 1) throw new Error('Professional planning data is unsupported.');
  if (!isRecord(value.setups) || !isRecord(value.shots) || !isRecord(value.continuityStates)
    || !isRecord(value.continuityExceptions)) throw new Error('Professional planning data is malformed.');

  const setups = Object.fromEntries(Object.entries(value.setups).map(([key, raw]) => {
    if (!isRecord(raw)) throw new Error(`Production setup ${key} is invalid.`);
    const setup: CinemaProductionSetupRecord = {
      id: id(raw.id, 'Production setup id'),
      sceneId: id(raw.sceneId, 'Production setup scene id'),
      name: text(raw.name, 'Production setup name', MAX_SHORT_TEXT),
      camera: text(raw.camera, 'Production setup camera', MAX_SHORT_TEXT),
      lens: text(raw.lens, 'Production setup lens', MAX_SHORT_TEXT),
      lighting: text(raw.lighting, 'Production setup lighting', MAX_SHORT_TEXT),
      location: text(raw.location, 'Production setup location', MAX_SHORT_TEXT),
      equipment: stringList(raw.equipment, 'Production setup equipment'),
      notes: text(raw.notes, 'Production setup notes'),
      estimatedSetupMinutes: number(raw.estimatedSetupMinutes, 'Production setup estimate'),
      shotIds: idList(raw.shotIds, 'Production setup shots'),
    };
    if (setup.id !== key || !context.scenes[setup.sceneId]) throw new Error(`Production setup ${key} is unresolved.`);
    return [key, setup];
  }));

  const shots = Object.fromEntries(Object.entries(value.shots).map(([key, raw]) => {
    if (!isRecord(raw)) throw new Error(`Production shot ${key} is invalid.`);
    const shot: CinemaShotProductionRecord = {
      shotId: id(raw.shotId, 'Production shot id'),
      revisionId: raw.revisionId === null ? null : id(raw.revisionId, 'Production shot revision id'),
      productionOrder: integer(raw.productionOrder, 'Production shot order', { positive: true }),
      setupId: id(raw.setupId, 'Production shot setup id'),
      status: ['planned', 'ready', 'captured', 'skipped'].includes(String(raw.status))
        ? raw.status as CinemaProductionStatus
        : (() => { throw new Error('Production shot status is unsupported.'); })(),
      estimatedCost: raw.estimatedCost === null ? null : number(raw.estimatedCost, 'Production shot cost'),
    };
    if (shot.shotId !== key || !context.shots[key] || !setups[shot.setupId]) {
      throw new Error(`Production shot ${key} is unresolved.`);
    }
    if (setups[shot.setupId].sceneId !== context.shots[key].sceneId) {
      throw new Error(`Production shot ${key} is assigned across scenes.`);
    }
    return [key, shot];
  }));

  if (Object.keys(shots).length !== Object.keys(context.shots).length
    || Object.keys(context.shots).some((shotId) => !shots[shotId])) {
    throw new Error('Professional planning must contain every shot exactly once.');
  }
  const setupShotIds = Object.values(setups).flatMap((setup) => setup.shotIds);
  if (setupShotIds.length !== Object.keys(context.shots).length
    || new Set(setupShotIds).size !== setupShotIds.length
    || setupShotIds.some((shotId) => !context.shots[shotId] || shots[shotId].setupId !== Object.values(setups).find((setup) => setup.shotIds.includes(shotId))?.id)) {
    throw new Error('Production setups must contain every shot exactly once.');
  }
  for (const sceneId of context.sceneOrder) {
    const orders = context.scenes[sceneId].shotIds.map((shotId) => shots[shotId].productionOrder).sort((a, b) => a - b);
    if (orders.some((order, index) => order !== index + 1)) throw new Error(`Scene ${sceneId} production order is invalid.`);
  }

  const validContinuityNodeIds = new Set([
    ...Object.values(context.characters).map((record) => record.nodeId),
    ...Object.values(context.assets).map((record) => record.nodeId),
  ]);
  const continuityStates = Object.fromEntries(Object.entries(value.continuityStates).map(([shotId, raw]) => {
    if (!context.shots[shotId] || !isRecord(raw)) throw new Error(`Continuity state for ${shotId} is invalid.`);
    return [shotId, Object.fromEntries(Object.entries(raw).map(([nodeId, state]) => {
      if (!validContinuityNodeIds.has(nodeId)) throw new Error(`Continuity state ${nodeId} is unresolved.`);
      return [nodeId, text(state, 'Continuity state', MAX_SHORT_TEXT)];
    }))];
  }));

  const continuityExceptions = Object.fromEntries(Object.entries(value.continuityExceptions).map(([key, raw]) => {
    if (!isRecord(raw)) throw new Error(`Continuity exception ${key} is invalid.`);
    const exception: CinemaContinuityExceptionRecord = {
      id: id(raw.id, 'Continuity exception id'),
      sceneId: id(raw.sceneId, 'Continuity exception scene id'),
      entityNodeId: id(raw.entityNodeId, 'Continuity exception entity id'),
      fromShotId: id(raw.fromShotId, 'Continuity exception from shot'),
      toShotId: id(raw.toShotId, 'Continuity exception to shot'),
      rationale: text(raw.rationale, 'Continuity exception rationale'),
    };
    if (exception.id !== key || !context.scenes[exception.sceneId] || !validContinuityNodeIds.has(exception.entityNodeId)
      || context.shots[exception.fromShotId]?.sceneId !== exception.sceneId
      || context.shots[exception.toShotId]?.sceneId !== exception.sceneId
      || !exception.rationale.trim()) throw new Error(`Continuity exception ${key} is unresolved.`);
    return [key, exception];
  }));

  return { version: 1, setups, shots, continuityStates, continuityExceptions };
}

export function reorderProductionShot(
  data: CinemaProfessionalPlanningData,
  sceneShotIds: readonly string[],
  shotId: string,
  toIndex: number,
): CinemaProfessionalPlanningData {
  if (!sceneShotIds.includes(shotId) || !Number.isInteger(toIndex) || toIndex < 0 || toIndex >= sceneShotIds.length) {
    throw new Error('Production reorder is invalid.');
  }
  const next = structuredClone(data);
  const ordered = sceneShotIds
    .map((id) => next.shots[id])
    .sort((left, right) => left.productionOrder - right.productionOrder)
    .map((record) => record.shotId)
    .filter((id) => id !== shotId);
  ordered.splice(toIndex, 0, shotId);
  ordered.forEach((id, index) => { next.shots[id].productionOrder = index + 1; });
  return next;
}

export function assignShotsToSetup(
  data: CinemaProfessionalPlanningData,
  shotIds: readonly string[],
  setupId: string,
): CinemaProfessionalPlanningData {
  const destination = data.setups[setupId];
  if (!destination || !shotIds.length || new Set(shotIds).size !== shotIds.length) throw new Error('Setup assignment is invalid.');
  const next = structuredClone(data);
  for (const shotId of shotIds) {
    const shot = next.shots[shotId];
    if (!shot || next.setups[shot.setupId]?.sceneId !== destination.sceneId) throw new Error('Setup assignment crosses scenes.');
    for (const setup of Object.values(next.setups)) setup.shotIds = setup.shotIds.filter((id) => id !== shotId);
    next.setups[setupId].shotIds.push(shotId);
    shot.setupId = setupId;
  }
  return next;
}

function continuityEntity(
  project: Pick<CinemaProjectData, 'characters' | 'assets'>,
  nodeId: string,
): { title: string; category: CinemaContinuityRow['category'] } | null {
  const character = Object.values(project.characters).find((record) => record.nodeId === nodeId);
  if (character) return { title: character.title, category: 'character' };
  const asset = Object.values(project.assets).find((record) => record.nodeId === nodeId);
  if (!asset) return null;
  return {
    title: asset.title,
    category: asset.category === 'location' || asset.category === 'prop' ? asset.category : asset.category === 'visual-element' ? 'style' : 'other',
  };
}

function exceptionKey(entityNodeId: string, fromShotId: string, toShotId: string) {
  return `${entityNodeId}:${fromShotId}:${toShotId}`;
}

export function buildContinuityMatrix(
  project: Pick<CinemaProjectData, 'scenes' | 'shots' | 'characters' | 'assets'>,
  data: CinemaProfessionalPlanningData,
  sceneId: string,
): CinemaContinuityMatrix {
  const scene = project.scenes[sceneId];
  if (!scene) throw new Error(`Scene ${sceneId} is missing.`);
  const entityNodeIds = [...new Set(scene.shotIds.flatMap((shotId) => [
    ...project.shots[shotId].continuityNodeIds,
    ...Object.keys(data.continuityStates[shotId] ?? {}),
  ]))];
  const issues: CinemaContinuityIssue[] = [];
  const rows = entityNodeIds.flatMap((entityNodeId): CinemaContinuityRow[] => {
    const entity = continuityEntity(project, entityNodeId);
    if (!entity) return [];
    const cells = scene.shotIds.map((shotId): CinemaContinuityCell => ({
      shotId,
      entityNodeId,
      state: data.continuityStates[shotId]?.[entityNodeId] ?? '',
      included: project.shots[shotId].continuityNodeIds.includes(entityNodeId),
    }));
    cells.forEach((cell) => {
      if (cell.included && !cell.state.trim()) issues.push({
        id: `missing:${entityNodeId}:${cell.shotId}`,
        kind: 'missing',
        sceneId,
        entityNodeId,
        shotIds: [cell.shotId],
        message: `${entity.title} has no continuity state for ${project.shots[cell.shotId].title}.`,
      });
    });
    const includedCells = cells.filter((cell) => cell.included);
    for (let index = 1; index < includedCells.length; index += 1) {
      const previous = includedCells[index - 1];
      const current = includedCells[index];
      if (!previous.state || !current.state || previous.state === current.state) continue;
      const excepted = Object.values(data.continuityExceptions).some((exception) =>
        exception.entityNodeId === entityNodeId
        && exception.fromShotId === previous.shotId
        && exception.toShotId === current.shotId);
      if (!excepted) issues.push({
        id: `conflict:${exceptionKey(entityNodeId, previous.shotId, current.shotId)}`,
        kind: 'conflict',
        sceneId,
        entityNodeId,
        shotIds: [previous.shotId, current.shotId],
        message: `${entity.title} changes from “${previous.state}” to “${current.state}” without an exception.`,
      });
    }
    return [{ entityNodeId, title: entity.title, category: entity.category, cells }];
  });
  return { sceneId, shotIds: [...scene.shotIds], rows, issues };
}

export function affectedShotsForContinuityEntity(
  project: Pick<CinemaProjectData, 'shots'>,
  entityNodeId: string,
): string[] {
  return Object.values(project.shots)
    .filter((shot) => shot.continuityNodeIds.includes(entityNodeId))
    .sort((left, right) => left.sceneId.localeCompare(right.sceneId) || left.order - right.order)
    .map((shot) => shot.id);
}

export function continuityEntityTitle(
  characters: Record<string, CinemaCharacterRecord>,
  assets: Record<string, CinemaAssetRecord>,
  nodeId: string,
) {
  return Object.values(characters).find((record) => record.nodeId === nodeId)?.title
    ?? Object.values(assets).find((record) => record.nodeId === nodeId)?.title
    ?? nodeId;
}

export function productionOrderedShots(
  project: Pick<CinemaProjectData, 'scenes' | 'shots'>,
  data: CinemaProfessionalPlanningData,
  sceneId: string,
): CinemaShotRecord[] {
  return project.scenes[sceneId].shotIds
    .map((shotId) => project.shots[shotId])
    .sort((left, right) => data.shots[left.id].productionOrder - data.shots[right.id].productionOrder);
}
