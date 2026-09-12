'use client';

import type { CinemaProjectData } from '../../domain/cinema/project-data';

export const OPERATION_JOURNAL_KEY = 'cineserye.operation-journal.v1';
export const operationJournalEvent = 'cineserye-operation-journal';
const MAX_ENTRIES = 250;
const MAX_BYTES = 256 * 1024;

export type ClientOperationKind = 'story-analysis' | 'story-plan' | 'shot-plan' | 'image-generation' | 'video-generation';
export type ClientOperationPhase = 'intent' | 'dispatched' | 'running' | 'awaiting-review' | 'succeeded'
  | 'failed' | 'tracking-stopped' | 'unknown' | 'expired';
export type ClientOperationEntry = {
  version: 1;
  id: string;
  projectId: string;
  kind: ClientOperationKind;
  scopeKey: string;
  sourceFingerprint: string;
  provider: string;
  model: string | null;
  estimateUsd: number | null;
  createdAt: string;
  updatedAt: string;
  phase: ClientOperationPhase;
  dispatchCertainty: 'not-dispatched' | 'may-have-dispatched' | 'completed';
  lastError: string | null;
  completedUnits: number | null;
  totalUnits: number | null;
};

type Journal = { version: 1; entries: ClientOperationEntry[] };
type JournalStorage = Pick<Storage, 'getItem' | 'setItem'>;
const kinds = new Set<ClientOperationKind>(['story-analysis', 'story-plan', 'shot-plan', 'image-generation', 'video-generation']);
const phases = new Set<ClientOperationPhase>(['intent', 'dispatched', 'running', 'awaiting-review', 'succeeded', 'failed', 'tracking-stopped', 'unknown', 'expired']);
const ids = /^[a-zA-Z0-9_.:-]{1,160}$/;
const terminal = new Set<ClientOperationPhase>(['awaiting-review', 'succeeded', 'failed', 'expired']);

function storageOrThrow(storage?: JournalStorage) {
  const value = storage ?? (typeof window === 'undefined' ? null : window.localStorage);
  if (!value) throw Error('Local operation recovery is unavailable. No request was started.');
  return value;
}
function string(value: unknown, maximum: number) { return typeof value === 'string' && value.length > 0 && value.length <= maximum ? value : null; }
function nullableString(value: unknown, maximum: number) { return value === null ? null : string(value, maximum); }
function finite(value: unknown) { return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null; }
function parseEntry(value: unknown): ClientOperationEntry | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const id = string(item.id, 160), projectId = string(item.projectId, 160), scopeKey = string(item.scopeKey, 500);
  const sourceFingerprint = string(item.sourceFingerprint, 128), provider = string(item.provider, 80);
  const model = nullableString(item.model, 160), createdAt = string(item.createdAt, 80), updatedAt = string(item.updatedAt, 80);
  const lastError = item.lastError === null ? null : string(item.lastError, 2_000);
  const estimateUsd = item.estimateUsd === null ? null : finite(item.estimateUsd);
  const completedUnits = item.completedUnits === null ? null : finite(item.completedUnits);
  const totalUnits = item.totalUnits === null ? null : finite(item.totalUnits);
  if (item.version !== 1 || !id || !ids.test(id) || !projectId || !ids.test(projectId) || !scopeKey || !sourceFingerprint
    || !provider || !kinds.has(item.kind as ClientOperationKind) || !phases.has(item.phase as ClientOperationPhase)
    || !model && item.model !== null || !createdAt || !updatedAt || !Number.isFinite(Date.parse(createdAt)) || !Number.isFinite(Date.parse(updatedAt))
    || !['not-dispatched', 'may-have-dispatched', 'completed'].includes(String(item.dispatchCertainty))
    || !lastError && item.lastError !== null || !estimateUsd && item.estimateUsd !== 0 && item.estimateUsd !== null
    || !completedUnits && item.completedUnits !== 0 && item.completedUnits !== null
    || !totalUnits && item.totalUnits !== 0 && item.totalUnits !== null
    || completedUnits !== null && totalUnits !== null && completedUnits > totalUnits) return null;
  return { version: 1, id, projectId, kind: item.kind as ClientOperationKind, scopeKey, sourceFingerprint, provider, model,
    estimateUsd, createdAt, updatedAt, phase: item.phase as ClientOperationPhase,
    dispatchCertainty: item.dispatchCertainty as ClientOperationEntry['dispatchCertainty'], lastError, completedUnits, totalUnits };
}
function read(storage?: JournalStorage): Journal {
  const raw = storageOrThrow(storage).getItem(OPERATION_JOURNAL_KEY);
  if (raw === null) return { version: 1, entries: [] };
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw Error('Local operation recovery data is unreadable. No request was started.'); }
  if (!value || typeof value !== 'object' || (value as { version?: unknown }).version !== 1
    || !Array.isArray((value as { entries?: unknown }).entries)) throw Error('Local operation recovery data uses an unsupported format. No request was started.');
  const rawEntries = (value as { entries: unknown[] }).entries;
  if (rawEntries.length > MAX_ENTRIES) throw Error('Local operation recovery contains too many records. Review existing requests before starting another.');
  const entries = rawEntries.map(parseEntry);
  if (entries.some((entry) => entry === null)) throw Error('Local operation recovery data is invalid. No request was started.');
  const result = entries as ClientOperationEntry[];
  if (new Set(result.map((entry) => entry.id)).size !== result.length) throw Error('Local operation recovery contains duplicate request identities. No request was started.');
  return { version: 1, entries: result };
}
function notify() { if (typeof window !== 'undefined') window.dispatchEvent(new Event(operationJournalEvent)); }
function write(journal: Journal, storage?: JournalStorage) {
  const target = storageOrThrow(storage);
  const entries = [...journal.entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let encoded = JSON.stringify({ version: 1, entries });
  while ((entries.length > MAX_ENTRIES || new TextEncoder().encode(encoded).byteLength > MAX_BYTES) && entries.some((entry) => terminal.has(entry.phase))) {
    const oldest = entries.findIndex((entry) => terminal.has(entry.phase));
    entries.splice(oldest, 1); encoded = JSON.stringify({ version: 1, entries });
  }
  if (entries.length > MAX_ENTRIES || new TextEncoder().encode(encoded).byteLength > MAX_BYTES) {
    throw Error('Local operation recovery is full of unresolved requests. Review them before starting another.');
  }
  target.setItem(OPERATION_JOURNAL_KEY, encoded); notify();
}

export function listClientOperations(projectId?: string, storage?: JournalStorage) {
  const entries = read(storage).entries;
  return (projectId ? entries.filter((entry) => entry.projectId === projectId) : entries)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function recordClientOperationIntent(input: Omit<ClientOperationEntry, 'version' | 'createdAt' | 'updatedAt' | 'phase'
  | 'dispatchCertainty' | 'lastError' | 'completedUnits' | 'totalUnits'>, storage?: JournalStorage) {
  const journal = read(storage);
  if (journal.entries.some((entry) => entry.id === input.id)) throw Error('This request identity already exists. Check the existing request instead of starting it again.');
  const now = new Date().toISOString();
  const entry = parseEntry({ ...input, version: 1, createdAt: now, updatedAt: now, phase: 'intent', dispatchCertainty: 'not-dispatched',
    lastError: null, completedUnits: null, totalUnits: null });
  if (!entry) throw Error('The request recovery identity is invalid. No request was started.');
  write({ version: 1, entries: [...journal.entries, entry] }, storage);
  return entry;
}

export function observeClientOperation(id: string, expected: Pick<ClientOperationEntry, 'projectId' | 'kind' | 'scopeKey'>,
  patch: Partial<Pick<ClientOperationEntry, 'phase' | 'dispatchCertainty' | 'lastError' | 'completedUnits' | 'totalUnits'>>, storage?: JournalStorage) {
  const journal = read(storage), index = journal.entries.findIndex((entry) => entry.id === id);
  if (index < 0) throw Error('The local request recovery record is missing. Do not start a replacement until the existing outcome is checked.');
  const current = journal.entries[index];
  if (current.projectId !== expected.projectId || current.kind !== expected.kind || current.scopeKey !== expected.scopeKey) {
    throw Error('The local request recovery record belongs to another scope. Nothing was changed.');
  }
  const candidate = parseEntry({ ...current, ...patch, updatedAt: new Date().toISOString() });
  if (!candidate) throw Error('The request observation is invalid. The existing recovery record was preserved.');
  journal.entries[index] = candidate; write(journal, storage); return candidate;
}

export function ensureClientOperation(input: Omit<ClientOperationEntry, 'version' | 'createdAt' | 'updatedAt' | 'phase'
  | 'dispatchCertainty' | 'lastError' | 'completedUnits' | 'totalUnits'>,
observation: Partial<Pick<ClientOperationEntry, 'phase' | 'dispatchCertainty' | 'lastError' | 'completedUnits' | 'totalUnits'>>, storage?: JournalStorage) {
  const existing = read(storage).entries.find((entry) => entry.id === input.id);
  if (!existing) recordClientOperationIntent(input, storage);
  else if (existing.projectId !== input.projectId || existing.kind !== input.kind || existing.scopeKey !== input.scopeKey) {
    throw Error('The saved request identity conflicts with local recovery. Nothing was replaced.');
  } else return existing;
  return observeClientOperation(input.id, input, observation, storage);
}

const observed = (phase: ClientOperationPhase, completed = false, lastError: string | null = null,
  completedUnits: number | null = null, totalUnits: number | null = null) => ({ phase,
  dispatchCertainty: (completed ? 'completed' : 'may-have-dispatched') as ClientOperationEntry['dispatchCertainty'],
  lastError, completedUnits, totalUnits });
const fingerprint = (...parts: Array<string | number | null | undefined>) => parts.filter((part) => part !== null && part !== undefined)
  .join(':').slice(0, 128) || 'legacy-operation';

/** Import compatible operation identities from restored/older documents into
 * the local journal. This writes no creative content and performs no network
 * request. A conflict fails closed instead of overwriting either owner. */
export function reconcileProjectOperations(project: CinemaProjectData, storage?: JournalStorage) {
  const entries: Array<{ input: Parameters<typeof ensureClientOperation>[0]; observation: Parameters<typeof ensureClientOperation>[1] }> = [];
  const workflow = project.storyWorkflow;
  const assistant = workflow?.assistant;
  if (assistant?.operationId) entries.push({ input: { id: assistant.operationId, projectId: project.projectId, kind: 'story-analysis',
    scopeKey: assistant.premiseNodeId, sourceFingerprint: assistant.sourceDigest ?? fingerprint(assistant.premiseNodeId),
    provider: assistant.checkpoint?.provenance?.provider ?? 'unknown', model: assistant.checkpoint?.provenance?.model ?? null, estimateUsd: null },
  observation: assistant.state === 'understanding' ? observed('running') : assistant.state === 'outcome-unknown' ? observed('unknown', false, assistant.error)
    : assistant.state === 'cancelled' ? observed('tracking-stopped', false, assistant.error)
      : assistant.state === 'needs-input' || assistant.state === 'confirm-direction' ? observed('awaiting-review', true)
        : assistant.state === 'confirmed' ? observed('succeeded', true) : observed('failed', false, assistant.error) });
  for (const session of workflow?.sessions ?? []) if (session.operationId) {
    entries.push({ input: { id: session.operationId, projectId: project.projectId, kind: 'story-plan',
      scopeKey: `${session.mode}:${session.anchorSceneId ?? 'story'}:${session.source.briefVersion}`,
      sourceFingerprint: session.source.sourceDigest, provider: session.provenance?.provider ?? 'unknown', model: session.provenance?.model ?? null, estimateUsd: null },
    observation: session.stage === 'running' ? observed('running') : session.stage === 'outcome-unknown' ? observed('unknown', false, session.error)
      : session.stage === 'cancelled' ? observed('tracking-stopped', false, session.error)
        : session.stage === 'proposal-review' || session.stage === 'stale' ? observed('awaiting-review', true, session.error, session.proposals.length, session.proposals.length)
          : session.stage === 'accepted' ? observed('succeeded', true, session.error, session.accepted.length, session.proposals.length)
            : observed('failed', false, session.error) });
  }
  for (const plan of [workflow?.shotPlanning, ...(workflow?.shotPlanningHistory ?? [])]) if (plan) {
    const ready = plan.jobs.filter((job) => job.status === 'ready').length;
    entries.push({ input: { id: plan.requestId, projectId: project.projectId, kind: 'shot-plan', scopeKey: plan.inputDigest,
      sourceFingerprint: plan.inputDigest, provider: plan.mode === 'fixture' ? 'cineserye-shot-plan-fixture' : 'configured-shot-planning-provider',
      model: plan.model, estimateUsd: plan.estimatedCost },
    observation: plan.status === 'running' ? observed('running', false, null, ready, plan.jobs.length)
      : plan.status === 'review' ? observed('awaiting-review', true, null, ready, plan.jobs.length)
        : plan.status === 'cancelled' ? observed('tracking-stopped', false, 'Local tracking stopped. Provider work or billing may continue.', ready, plan.jobs.length)
          : observed('unknown', false, plan.jobs.find((job) => job.error)?.error ?? null, ready, plan.jobs.length) });
  }
  for (const run of Object.values(project.visualPreproduction?.storyboardRuns ?? {})) entries.push({ input: {
    id: run.id, projectId: project.projectId, kind: 'image-generation', scopeKey: `${run.shotId}:${run.revisionId}`,
    sourceFingerprint: fingerprint(run.promptId, run.promptVersion), provider: run.provider, model: run.model, estimateUsd: run.estimatedCost,
  }, observation: run.status === 'completed' ? observed('awaiting-review', true) : run.status === 'failed' ? observed('failed', true, run.error)
    : run.status === 'cancelled' ? observed('tracking-stopped', false, run.error) : observed('running') });
  for (const operation of Object.values(project.visualPreproduction?.videoOperations ?? {})) {
    const sceneId = project.revisions[operation.revisionId]?.sceneId ?? project.shots[operation.shotId]?.sceneId ?? 'unknown';
    entries.push({ input: { id: operation.id, projectId: project.projectId, kind: 'video-generation',
      scopeKey: `${sceneId}:${operation.shotId}:${operation.revisionId}`, sourceFingerprint: fingerprint(operation.promptId, operation.promptVersion, operation.startFrameId),
      provider: operation.provider, model: operation.model, estimateUsd: operation.estimatedCost },
    observation: operation.status === 'ready' ? observed('awaiting-review', true, operation.error)
      : operation.status === 'failed' ? observed('failed', Boolean(operation.failureConfirmed), operation.error)
        : operation.status === 'cancelled' ? observed('tracking-stopped', false, operation.error)
          : operation.status === 'expired' ? observed('expired', true, operation.error)
            : operation.status === 'unknown' || operation.status === 'timed-out' ? observed('unknown', false, operation.error) : observed('running', false, operation.error) });
  }
  for (const entry of entries) ensureClientOperation(entry.input, entry.observation, storage);
  return entries.length;
}

export function subscribeClientOperations(listener: () => void) {
  if (typeof window === 'undefined') return () => {};
  const changed = (event: Event) => { if (!(event instanceof StorageEvent) || event.key === OPERATION_JOURNAL_KEY) listener(); };
  window.addEventListener(operationJournalEvent, changed); window.addEventListener('storage', changed);
  return () => { window.removeEventListener(operationJournalEvent, changed); window.removeEventListener('storage', changed); };
}
