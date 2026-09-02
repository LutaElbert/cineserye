import type { CinemaProjectData, JsonValue } from './project-data';

export type CinemaAuditScope =
  | { kind: 'project'; id: null }
  | { kind: 'scene'; id: string }
  | { kind: 'entity'; id: string };

export type CinemaAuditCategory =
  | 'character-identity'
  | 'wardrobe-condition'
  | 'prop-location'
  | 'time-period'
  | 'style-drift'
  | 'missing-dependency'
  | 'duration'
  | 'budget-exposure';

export type CinemaAuditCorrection = {
  type: 'continuity-exception';
  entityNodeId: string;
  sceneId: string;
  shotIds: string[];
  rationale: string;
};

export type CinemaAuditFinding = {
  id: string;
  category: CinemaAuditCategory;
  severity: 'info' | 'warning' | 'critical';
  confidence: 'deterministic';
  title: string;
  explanation: string;
  evidenceNodeIds: string[];
  affectedSceneIds: string[];
  affectedShotIds: string[];
  disposition: 'open' | 'dismissed' | 'accepted';
  correction: CinemaAuditCorrection | null;
};

export type CinemaAuditRun = {
  id: string;
  provider: 'fixture-continuity-auditor';
  policyVersion: 1;
  scope: CinemaAuditScope;
  sourceFingerprint: string;
  createdAt: string;
  findingIds: string[];
};

export type CinemaAuditData = {
  version: 1;
  runs: Record<string, CinemaAuditRun>;
  findings: Record<string, CinemaAuditFinding>;
};

const AUDIT_EXTENSION_KEY = 'x-cineserye-audit' as const;
const MAX_FINDINGS = 5;

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function fingerprintText(source: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `audit-v1-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function projectedProject(project: CinemaProjectData, scope: CinemaAuditScope) {
  const scopedSceneIds = scope.kind === 'scene'
    ? [scope.id]
    : scope.kind === 'entity'
      ? [...Object.values(project.characters), ...Object.values(project.assets)]
        .find((entity) => entity.nodeId === scope.id)?.sceneIds ?? []
      : project.sceneOrder;
  const sceneIds = new Set(scopedSceneIds);
  return {
    projectId: project.projectId,
    scope,
    sceneOrder: project.sceneOrder.filter((sceneId) => sceneIds.has(sceneId)),
    scenes: Object.values(project.scenes).filter((scene) => sceneIds.has(scene.id)),
    shots: Object.values(project.shots).filter((shot) => sceneIds.has(shot.sceneId)),
    characters: Object.values(project.characters).filter((entity) => (
      scope.kind === 'entity' ? entity.nodeId === scope.id : entity.sceneIds.some((sceneId) => sceneIds.has(sceneId))
    )),
    assets: Object.values(project.assets).filter((entity) => (
      scope.kind === 'entity' ? entity.nodeId === scope.id : entity.sceneIds.some((sceneId) => sceneIds.has(sceneId))
    )),
    variants: Object.values(project.multiScene?.sharedEntityVariants ?? {}).filter((variant) => (
      sceneIds.has(variant.sceneId) && (scope.kind !== 'entity' || variant.entityNodeId === scope.id)
    )),
    exceptions: Object.values(project.multiScene?.continuityExceptions ?? {}).filter((exception) => (
      sceneIds.has(exception.sceneId) && (scope.kind !== 'entity' || exception.entityNodeId === scope.id)
    )),
    costs: Object.values(project.costs).filter((cost) => sceneIds.has(cost.sceneId)),
  };
}

export function cinemaAuditFingerprint(project: CinemaProjectData, scope: CinemaAuditScope): string {
  return fingerprintText(stable(projectedProject(project, scope)));
}

export function emptyCinemaAuditData(): CinemaAuditData {
  return { version: 1, runs: {}, findings: {} };
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} is invalid.`);
  return value as Record<string, unknown>;
}

function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length > 500 || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${label} is invalid.`);
  }
  return value as string[];
}

export function validateCinemaAuditData(value: unknown): CinemaAuditData {
  if (value === undefined) return emptyCinemaAuditData();
  const source = record(value, 'Cinema audit data');
  if (source.version !== 1) throw new Error('Cinema audit data version is unsupported.');
  const rawRuns = record(source.runs, 'Cinema audit runs');
  const rawFindings = record(source.findings, 'Cinema audit findings');
  if (Object.keys(rawRuns).length > 500 || Object.keys(rawFindings).length > 2_500) {
    throw new Error('Cinema audit data is too large.');
  }
  const findings = Object.fromEntries(Object.entries(rawFindings).map(([key, item]) => {
    const finding = record(item, `Cinema audit finding ${key}`);
    const correction = finding.correction === null ? null : record(finding.correction, 'Cinema audit correction');
    if (finding.id !== key || !['info', 'warning', 'critical'].includes(String(finding.severity))
      || !['open', 'dismissed', 'accepted'].includes(String(finding.disposition))) {
      throw new Error(`Cinema audit finding ${key} is invalid.`);
    }
    return [key, {
      id: key,
      category: finding.category as CinemaAuditCategory,
      severity: finding.severity as CinemaAuditFinding['severity'],
      confidence: 'deterministic' as const,
      title: String(finding.title ?? '').slice(0, 500),
      explanation: String(finding.explanation ?? '').slice(0, 20_000),
      evidenceNodeIds: strings(finding.evidenceNodeIds, 'Audit evidence nodes'),
      affectedSceneIds: strings(finding.affectedSceneIds, 'Audit affected scenes'),
      affectedShotIds: strings(finding.affectedShotIds, 'Audit affected shots'),
      disposition: finding.disposition as CinemaAuditFinding['disposition'],
      correction: correction ? {
        type: 'continuity-exception' as const,
        entityNodeId: String(correction.entityNodeId ?? ''),
        sceneId: String(correction.sceneId ?? ''),
        shotIds: strings(correction.shotIds, 'Audit correction shots'),
        rationale: String(correction.rationale ?? '').slice(0, 4_000),
      } : null,
    }];
  }));
  const runs = Object.fromEntries(Object.entries(rawRuns).map(([key, item]) => {
    const run = record(item, `Cinema audit run ${key}`);
    const scope = record(run.scope, 'Cinema audit scope');
    if (run.id !== key || !['project', 'scene', 'entity'].includes(String(scope.kind))) {
      throw new Error(`Cinema audit run ${key} is invalid.`);
    }
    const findingIds = strings(run.findingIds, 'Cinema audit finding ids');
    if (findingIds.some((findingId) => !findings[findingId])) throw new Error('Cinema audit run refers to a missing finding.');
    return [key, {
      id: key,
      provider: 'fixture-continuity-auditor' as const,
      policyVersion: 1 as const,
      scope: scope.kind === 'project'
        ? { kind: 'project' as const, id: null }
        : { kind: scope.kind as 'scene' | 'entity', id: String(scope.id ?? '') },
      sourceFingerprint: String(run.sourceFingerprint ?? ''),
      createdAt: String(run.createdAt ?? ''),
      findingIds,
    }];
  }));
  return { version: 1, runs, findings };
}

export function readCinemaAuditData(project: CinemaProjectData): CinemaAuditData {
  return validateCinemaAuditData(project[AUDIT_EXTENSION_KEY]);
}

export function writeCinemaAuditData(project: CinemaProjectData, data: CinemaAuditData): void {
  project[AUDIT_EXTENSION_KEY] = structuredClone(data) as unknown as JsonValue;
}

function findingId(prefix: string, ...parts: string[]) {
  return `${prefix}-${fingerprintText(parts.join(':')).replace('audit-v1-', '')}`;
}

function inScope(scope: CinemaAuditScope, sceneId: string, entityNodeId?: string) {
  return scope.kind === 'project' || (scope.kind === 'scene' && scope.id === sceneId)
    || (scope.kind === 'entity' && scope.id === entityNodeId);
}

export function runFixtureContinuityAudit(
  project: CinemaProjectData,
  scope: CinemaAuditScope,
  now = new Date().toISOString(),
): { run: CinemaAuditRun; findings: CinemaAuditFinding[] } {
  if (scope.kind === 'scene' && !project.scenes[scope.id]) throw new Error('Audit scene is missing.');
  const entities = [...Object.values(project.characters), ...Object.values(project.assets)];
  if (scope.kind === 'entity' && !entities.some((entity) => entity.nodeId === scope.id)) throw new Error('Audit entity is missing.');
  const findings: CinemaAuditFinding[] = [];
  const exceptions = Object.values(project.multiScene?.continuityExceptions ?? {});
  for (const entity of entities) {
    const variants = Object.values(project.multiScene?.sharedEntityVariants ?? {})
      .filter((variant) => variant.entityNodeId === entity.nodeId && inScope(scope, variant.sceneId, entity.nodeId));
    if (entity.sceneIds.length > 1 && variants.length) {
      for (const variant of variants) {
        const shotIds = Object.values(project.shots)
          .filter((shot) => shot.sceneId === variant.sceneId && shot.continuityNodeIds.includes(entity.nodeId))
          .map((shot) => shot.id);
        const covered = exceptions.some((exception) => exception.entityNodeId === entity.nodeId && exception.sceneId === variant.sceneId);
        const changed = [variant.wardrobe, variant.ageOrCondition, variant.timeOfDay, variant.locationVariant].some(Boolean);
        if (changed && !covered) findings.push({
          id: findingId('variant-review', entity.nodeId, variant.sceneId),
          category: 'wardrobe-condition', severity: 'warning', confidence: 'deterministic',
          title: `Review ${entity.title} in ${project.scenes[variant.sceneId]?.title ?? variant.sceneId}`,
          explanation: 'This scene has a scoped visual change but no recorded continuity exception confirming that it is intentional.',
          evidenceNodeIds: [entity.nodeId], affectedSceneIds: [variant.sceneId], affectedShotIds: shotIds,
          disposition: 'open',
          correction: { type: 'continuity-exception', entityNodeId: entity.nodeId, sceneId: variant.sceneId, shotIds, rationale: 'Intentional scene-scoped continuity change reviewed in the project audit.' },
        });
      }
    }
  }
  for (const sceneId of project.sceneOrder) {
    if (!inScope(scope, sceneId)) continue;
    const scene = project.scenes[sceneId];
    const duration = scene.shotIds.reduce((sum, shotId) => sum + (project.shots[shotId]?.durationSeconds ?? 0), 0);
    const target = scene.brief?.targetDurationSeconds;
    if (target && Math.abs(duration - target) / target > 0.1) findings.push({
      id: findingId('duration', sceneId), category: 'duration', severity: 'warning', confidence: 'deterministic',
      title: `${scene.title} misses its duration target`,
      explanation: `The accepted shots total ${duration}s against a ${target}s target, outside the allowed ±10% range.`,
      evidenceNodeIds: [scene.nodeId], affectedSceneIds: [sceneId], affectedShotIds: [...scene.shotIds], disposition: 'open', correction: null,
    });
    const cost = Object.values(project.costs).find((item) => item.sceneId === sceneId);
    if (cost && cost.ceiling !== null && cost.highRisk !== null && cost.highRisk > cost.ceiling) findings.push({
      id: findingId('budget', sceneId), category: 'budget-exposure', severity: 'critical', confidence: 'deterministic',
      title: `${scene.title} can exceed its generation ceiling`,
      explanation: `The illustrative high-risk estimate is ${cost.highRisk}, above the configured ceiling of ${cost.ceiling}.`,
      evidenceNodeIds: [scene.nodeId], affectedSceneIds: [sceneId], affectedShotIds: [...scene.shotIds], disposition: 'open', correction: null,
    });
  }
  const severityRank: Record<CinemaAuditFinding['severity'], number> = { critical: 0, warning: 1, info: 2 };
  const ranked = findings.sort((left, right) => (
    severityRank[left.severity] - severityRank[right.severity] || left.id.localeCompare(right.id)
  )).slice(0, MAX_FINDINGS);
  const sourceFingerprint = cinemaAuditFingerprint(project, scope);
  return {
    run: {
      id: `audit-${sourceFingerprint.replace('audit-v1-', '')}-${Date.parse(now) || 0}`,
      provider: 'fixture-continuity-auditor', policyVersion: 1, scope, sourceFingerprint, createdAt: now,
      findingIds: ranked.map((finding) => finding.id),
    },
    findings: ranked,
  };
}

export function storeCinemaAuditResult(project: CinemaProjectData, result: ReturnType<typeof runFixtureContinuityAudit>) {
  const audit = readCinemaAuditData(project);
  audit.runs[result.run.id] = structuredClone(result.run);
  for (const finding of result.findings) audit.findings[finding.id] = structuredClone(finding);
  writeCinemaAuditData(project, audit);
}
