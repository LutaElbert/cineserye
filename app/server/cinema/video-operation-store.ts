import 'server-only';
import type { GenerateVideoRequest, VideoOperationSnapshot } from '../../features/video/video-api';
import type { VideoCapabilityProfile } from './video-capabilities';
import type { VideoProviderHandle } from './video-provider';
import { OperationRepository, operationDigest } from './operation-repository';
import { ProviderError } from './provider-errors';

export type VideoOwner = { projectId: string; sceneId: string; shotId: string; revisionId: string; operationId: string };
export type SavedVideoOperation = {
  version: 1;
  outcomeVersion?: 1;
  /** Local observation only; never rewrites provider provenance or authorizes dispatch. */
  trackingDeadline?: number;
  /** Durable stop fence, separate from provider outcome and creative history. */
  observationRevision?: number;
  owner: VideoOwner;
  digest: string;
  mode: 'fixture' | 'live';
  provider: { id: string; model: string; project: string | null; location: string | null };
  capability: VideoCapabilityProfile;
  /** Retain no reference bytes or prompt text in the polling checkpoint. */
  settings: GenerateVideoRequest['settings'];
  handle: Pick<VideoProviderHandle, 'name' | 'startedAt'>;
  status: VideoOperationSnapshot['status'];
  estimatedCost: number | null;
  currency: 'USD' | null;
  error: string | null;
  clip: VideoOperationSnapshot['clip'];
};
const TERMINAL = new Set(['ready', 'failed', 'cancelled', 'timed-out']);
const scopeFor = (owner: VideoOwner) => `video:${operationDigest({ projectId: owner.projectId, shotId: owner.shotId })}:`;
const keyFor = (owner: VideoOwner) => `${scopeFor(owner)}${operationDigest(owner)}`;
const legacyKeyFor = (owner: VideoOwner) => `video:${operationDigest(owner)}`;
const unknownMessage = 'The provider outcome is unknown. This operation will not be dispatched again; inspect provider activity before approving any new request.';
export class VideoResultUnavailable extends ProviderError {
  constructor(readonly operationId: string, readonly reason: 'expired' | 'not-found') {
    super('INVALID_REQUEST', reason === 'expired' ? 'The retained video result expired. This request will not be replayed.' : 'That owned video operation is unavailable. Its outcome is not known here.', false);
  }
}

/** Durable single-local-operator adapter; a scope is not hosted tenant authentication. */
export class VideoOperationStore {
  private readonly starting = new Map<string, { digest: string; promise: Promise<SavedVideoOperation> }>();
  private readonly polling = new Map<string, Promise<SavedVideoOperation>>();
  private starts = 0;
  constructor(private readonly repository: OperationRepository) {
    // Add unresolved-scope fencing without losing legacy IDs. Expired rows
    // without retained ownership keep their old tombstone key.
    repository.transaction(() => {
      for (const row of repository.legacyVideoRows()) {
        const saved = JSON.parse(row.result!) as SavedVideoOperation;
        if (saved.version !== 1 || !saved.owner || !['fixture', 'live'].includes(saved.mode) || saved.digest !== row.digest || legacyKeyFor(saved.owner) !== row.key
          || Object.keys(saved.owner).sort().join(',') !== 'operationId,projectId,revisionId,sceneId,shotId'
          || !/^[a-zA-Z0-9_-]{8,160}$/.test(saved.owner.operationId)
          || Object.values(saved.owner).some(value => typeof value !== 'string' || !value || value.includes('\0'))) {
          throw new ProviderError('INVALID_CONFIGURATION', 'A legacy video checkpoint cannot be safely migrated. No request was started.');
        }
        const uncertain = saved.mode === 'live' && ['failed', 'cancelled', 'timed-out'].includes(saved.status);
        repository.migrateVideoKey(row.key, keyFor(saved.owner), uncertain ? { ...saved, status: 'unknown', error: unknownMessage } : saved, uncertain);
      }
    });
  }
  close() { this.repository.close(); }
  read(owner: VideoOwner): SavedVideoOperation {
    const row = this.repository.read(keyFor(owner)) ?? this.repository.read(legacyKeyFor(owner));
    if (!row || row.status === 'expired' || !row.result) throw new VideoResultUnavailable(owner.operationId, row?.status === 'expired' ? 'expired' : 'not-found');
    let saved: SavedVideoOperation;
    try { saved = JSON.parse(row.result) as SavedVideoOperation; } catch { throw new ProviderError('UNEXPECTED_RESPONSE', 'The saved video checkpoint is unreadable.'); }
    if (operationDigest(saved.owner) !== operationDigest(owner)) throw new ProviderError('INVALID_REQUEST', 'That owned video operation does not match the requested scene or revision.');
    if (saved.version !== 1 || saved.digest !== row.digest) throw new ProviderError('UNEXPECTED_RESPONSE', 'The saved video checkpoint failed integrity validation.');
    if (row.status === 'unknown' && !saved.handle.name || row.status === 'pending' && !saved.handle.name && !this.starting.has(keyFor(owner))) return { ...saved, status: 'unknown', error: unknownMessage, clip: null };
    return saved;
  }
  async start(initial: SavedVideoOperation, dispatch: () => Promise<VideoProviderHandle>): Promise<SavedVideoOperation> {
    const key = keyFor(initial.owner), running = this.starting.get(key);
    if (running) {
      this.read(initial.owner);
      if (running.digest !== initial.digest) throw new ProviderError('INVALID_REQUEST', 'This running operation has different content.');
      return running.promise;
    }
    if (this.repository.read(legacyKeyFor(initial.owner))) return this.read(initial.owner);
    if (this.repository.hasUnscopedVideoClaim()) throw new ProviderError('PROVIDER_UNAVAILABLE', 'An older video dispatch has no retained ownership checkpoint. Its outcome needs provider review before new video work can safely start.', false);
    const claim = this.repository.claimExclusive(key, initial.digest, scopeFor(initial.owner), 'An earlier video request for this shot is still running or has an unknown outcome. Check that existing request before approving another.');
    if (!claim.claimed) return this.read(initial.owner);
    // Claim and checkpoint precede external dispatch. A crash cannot purchase a retry.
    initial = { ...initial, outcomeVersion: 1 };
    this.repository.checkpoint(key, initial.digest, initial);
    if (++this.starts > 200) { this.repository.unknown(key); throw new ProviderError('PROVIDER_UNAVAILABLE', 'The local video dispatch limit was reached.'); }
    const promise = Promise.resolve().then(dispatch).then((handle) => this.repository.transaction(() => {
      if (!handle.name || !Number.isFinite(handle.startedAt)) throw new Error('Missing provider operation handle.');
      const latest = this.read(initial.owner);
      if (TERMINAL.has(latest.status)) return latest; // Cancel won while start was in flight.
      const saved = { ...latest, handle: { name: handle.name, startedAt: handle.startedAt } };
      this.repository.checkpoint(key, initial.digest, saved);
      return saved;
    })).catch(() => {
      const latest = this.read(initial.owner);
      if (TERMINAL.has(latest.status)) return latest;
      this.repository.unknown(key);
      return { ...initial, status: 'unknown' as const, error: unknownMessage };
    }).finally(() => this.starting.delete(key));
    this.starting.set(key, { digest: initial.digest, promise });
    return promise;
  }
  async poll(owner: VideoOwner, update: (saved: SavedVideoOperation) => Promise<SavedVideoOperation>): Promise<SavedVideoOperation> {
    const saved = this.read(owner);
    const key = keyFor(owner), running = this.polling.get(key);
    if (running) return running;
    if (TERMINAL.has(saved.status) || !saved.handle.name) return saved;
    const promise = update(saved).then((next) => this.repository.transaction(() => {
      const latest = this.read(owner);
      if (TERMINAL.has(latest.status)) return latest; // Never revive a cancelled take.
      if ((latest.observationRevision ?? 0) !== (saved.observationRevision ?? 0)) return latest;
      if (next === saved) return latest; // An ordinary read of paused tracking is not a new observation.
      if (operationDigest(next.owner) !== operationDigest(owner) || next.digest !== saved.digest) throw new ProviderError('INVALID_REQUEST', 'A polling update changed its owned scope.');
      const observed: SavedVideoOperation = { ...next, outcomeVersion: 1,
        observationRevision: (saved.observationRevision ?? 0) + (next.status === 'unknown' ? 1 : 0) };
      this.repository.observeExisting(key, next.digest, observed, TERMINAL.has(next.status));
      return observed;
    })).finally(() => this.polling.delete(key));
    this.polling.set(key, promise);
    return promise;
  }
  cancel(owner: VideoOwner): SavedVideoOperation {
    return this.repository.transaction(() => {
    const saved = this.read(owner);
    if (TERMINAL.has(saved.status)) return saved;
    // Local observation has no authority to cancel a live provider. Keep the
    // saved handle and unresolved ledger claim for later same-request recovery.
    const next: SavedVideoOperation = { ...saved, observationRevision: (saved.observationRevision ?? 0) + 1, status: saved.mode === 'live' ? 'unknown' : 'cancelled',
      error: saved.mode === 'live' ? 'Local tracking stopped. Provider processing and billing may continue.' : 'The offline fixture was cancelled locally.', clip: null };
    if (saved.mode === 'live') {
      this.repository.observeExisting(keyFor(owner), saved.digest, next, false);
    } else this.repository.complete(keyFor(owner), next);
    return next;
    });
  }
}

let local: { path: string; promise: Promise<VideoOperationStore> } | undefined;
export function localVideoOperationStore() {
  const path = process.env.CINESERYE_VIDEO_OPERATION_DB_PATH?.trim() || '.wrangler/cineserye-video-operations.sqlite';
  if (!local || local.path !== path) local = { path, promise: OperationRepository.open(path).then((repository) => new VideoOperationStore(repository)).catch(() => {
    local = undefined;
    throw new ProviderError('INVALID_CONFIGURATION', 'Durable local video storage is unavailable. No provider request was started.');
  }) };
  return local.promise;
}
