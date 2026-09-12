import type { EditorDocument } from './types';
import { validateEditorDocument } from './document-file';

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
}

function hashSource(source: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** Compatibility reader for pending proposals saved before creative and
 * operational observations were separated. Never use for new approvals. */
export function legacyCinemaSourceFingerprint(document: EditorDocument): string {
  const normalized = validateEditorDocument(document);
  const source = canonical({
    schemaVersion: normalized.schemaVersion,
    title: normalized.title,
    nodes: normalized.nodes.map((node) => ({ ...node, selected: false, dragging: false })),
    edges: normalized.edges.map((edge) => ({ ...edge, selected: false })),
    cinema: normalized.cinema,
  });
  return hashSource(source);
}

function creativeCinema(value: ReturnType<typeof validateEditorDocument>['cinema']) {
  if (!value) return value;
  const cinema = structuredClone(value);
  // Selection and operation observations are separate owners. The existence
  // and creative output of a run still matters; polling timestamps/status do not.
  cinema.activeSceneId = null;
  cinema.activeRevisionId = null;
  for (const run of Object.values(cinema.agentRuns)) Object.assign(run, { status: 'ready', startedAt: null, completedAt: null });
  for (const revision of Object.values(cinema.revisions)) for (const run of Object.values(revision.snapshot.agentRuns)) {
    Object.assign(run, { status: 'ready', startedAt: null, completedAt: null });
  }
  if (cinema.visualPreproduction) {
    cinema.visualPreproduction.storyboardRuns = {};
    cinema.visualPreproduction.videoOperations = {};
  }
  if (cinema.storyWorkflow) {
    const workflow = cinema.storyWorkflow;
    workflow.reviewSessionId = null;
    if (workflow.assistant) Object.assign(workflow.assistant, {
      position: { x: 0, y: 0 }, hidden: false, collapsed: false, operationId: null, state: 'review', error: null,
      checkpoint: workflow.assistant.checkpoint ? { ...workflow.assistant.checkpoint, runId: '00000000-0000-4000-8000-000000000000', provenance: undefined } : null,
      previousAnswers: workflow.assistant.previousAnswers?.map((entry) => ({ ...entry,
        checkpoint: { ...entry.checkpoint, runId: '00000000-0000-4000-8000-000000000000', provenance: undefined } })),
    });
    workflow.sessions = workflow.sessions.map((session) => ({ ...session, operationId: null, stage: 'draft', error: null, provenance: undefined,
      revision: session.revision ? { ...session.revision, sourceOperationId: null, status: 'running', requestedAt: '1970-01-01T00:00:00.000Z', resolvedAt: null } : undefined }));
    const plan = (state: typeof workflow.shotPlanning) => state ? {
      input: state.input,
      mode: state.mode,
      model: state.model,
      jobs: state.jobs.map((job) => ({ sceneId: job.sceneId, title: job.title, sourceDigest: job.sourceDigest, result: job.result })),
      acceptedSceneIds: state.acceptedSceneIds,
      retrySceneIds: state.retrySceneIds,
    } : undefined;
    workflow.shotPlanning = plan(workflow.shotPlanning) as typeof workflow.shotPlanning;
    workflow.shotPlanningHistory = workflow.shotPlanningHistory?.map((item) => plan(item) as typeof item);
  }
  return cinema;
}

/** Creative content fingerprint for stale-proposal detection; not a security
 * primitive. Selection, navigation and transient provider observations are
 * deliberately excluded. */
export function cinemaSourceFingerprint(document: EditorDocument): string {
  const normalized = validateEditorDocument(document);
  return hashSource(canonical({
    schemaVersion: normalized.schemaVersion,
    title: normalized.title,
    nodes: normalized.nodes.map((node) => ({ ...node, selected: false, dragging: false })),
    edges: normalized.edges.map((edge) => ({ ...edge, selected: false })),
    cinema: creativeCinema(normalized.cinema),
  }));
}
