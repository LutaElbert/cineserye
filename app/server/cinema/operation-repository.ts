import 'server-only';
import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { ProviderError } from './provider-errors';
import { canonicalRequest } from '../../domain/cinema/request-digest';

type Database = import('node:sqlite').DatabaseSync;
type RecordRow = { digest: string; status: 'pending' | 'completed' | 'unknown' | 'expired'; result: string | null };

export function operationDigest(content: unknown): string {
  return createHash('sha256').update(canonicalRequest(content)).digest('hex');
}

/** Local adapter. Unsupported runtimes fail closed instead of falling back to a Map. */
export class OperationRepository {
  private constructor(private readonly database: Database) {}
  static async open(path: string) {
    if (path !== ':memory:') await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    // Node's built-in SQLite needs no package. Keep it out of the Workers bundle;
    // a future deployed adapter must be selected explicitly for that runtime.
    const moduleName = 'node:sqlite';
    const { DatabaseSync } = await import(/* @vite-ignore */ moduleName) as typeof import('node:sqlite');
    const database = new DatabaseSync(path);
    database.exec(`PRAGMA busy_timeout=5000;
      PRAGMA secure_delete=ON;
      CREATE TABLE IF NOT EXISTS operations (
        key TEXT PRIMARY KEY, digest TEXT NOT NULL, status TEXT NOT NULL,
        result TEXT, updated_at INTEGER NOT NULL
      );`);
    const repository = new OperationRepository(database);
    repository.pruneResults();
    return repository;
  }
  private pruneResults() {
    // Old video ledgers called local stop/timeout/failure "completed". Protect
    // their ownership BEFORE every retention pass (including open), so the
    // video store can migrate them without making an unknown purchase retryable.
    this.database.prepare(`UPDATE operations SET status='unknown'
      WHERE status='completed' AND substr(key,1,6)='video:' AND length(key)=70
      AND CASE WHEN json_valid(result) THEN
        json_extract(result,'$.mode')='live' AND
        json_extract(result,'$.status') IN ('failed','cancelled','timed-out')
      ELSE 0 END`).run();
    // Bound retained content, not merely age at process startup. Tombstones keep
    // expired IDs from accidentally purchasing the same operation again.
    this.database.prepare("UPDATE operations SET result=NULL, status='expired' WHERE status='completed' AND updated_at < ?")
      .run(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rows = this.database.prepare("SELECT key, length(CAST(result AS BLOB)) AS bytes FROM operations WHERE status='completed' ORDER BY updated_at DESC, key")
      .all() as Array<{ key: string; bytes: number }>;
    let bytes = 0;
    rows.forEach((row, index) => {
      bytes += row.bytes;
      if (index >= 100 || bytes > 256 * 1024 * 1024) this.database.prepare("UPDATE operations SET result=NULL, status='expired' WHERE key=?").run(row.key);
    });
  }
  claim(key: string, digest: string): { claimed: boolean; row: RecordRow } {
    this.pruneResults();
    const inserted = this.database.prepare("INSERT OR IGNORE INTO operations (key,digest,status,updated_at) VALUES (?,?,'pending',?)")
      .run(key, digest, Date.now());
    const row = this.database.prepare('SELECT digest,status,result FROM operations WHERE key=?').get(key) as RecordRow;
    if (row.digest !== digest) throw new ProviderError('INVALID_REQUEST', 'This operation ID was already used for different content.');
    return { claimed: Number(inserted.changes) === 1, row };
  }
  /** Reuse the durable ledger to fence a new ID in the same workflow scope.
   * Browser undo, an old backup, or a second process cannot bypass this check.
   * Exact prefix comparison (not LIKE) keeps user IDs containing %/_ literal. */
  claimExclusive(key: string, digest: string, scopePrefix: string, blockedMessage = 'An earlier Story request in this project is still running or has an unknown outcome. Recover the existing request before approving another.'): { claimed: boolean; row: RecordRow } {
    if (key.includes('\0') || scopePrefix.includes('\0') || !scopePrefix.endsWith(':') || !key.startsWith(scopePrefix) || !key.slice(scopePrefix.length)
      || key.slice(scopePrefix.length).includes(':')) throw new ProviderError('INVALID_REQUEST', 'Invalid operation scope.');
    return this.transaction(() => {
      // Existing IDs retain their original replay/conflict/tombstone policy.
      if (this.read(key)) return this.claim(key, digest);
      const unresolved = this.database.prepare("SELECT key FROM operations WHERE substr(key,1,length(?))=? AND instr(substr(key,length(?)+1),':')=0 AND status IN ('pending','unknown') LIMIT 1")
        .get(scopePrefix, scopePrefix, scopePrefix);
      if (unresolved) throw new ProviderError('PROVIDER_UNAVAILABLE',
        blockedMessage, false);
      return this.claim(key, digest);
    });
  }
  complete(key: string, result: unknown) {
    this.database.prepare("UPDATE operations SET status='completed', result=?, updated_at=? WHERE key=?")
      .run(JSON.stringify(result), Date.now(), key);
    this.pruneResults();
  }
  /** Durable non-terminal workflow checkpoint. Never revives a completed or
   * unknown operation and never dispatches work merely from a read. */
  checkpoint(key: string, digest: string, result: unknown) {
    const changed = this.database.prepare("UPDATE operations SET result=?, updated_at=? WHERE key=? AND digest=? AND status='pending'")
      .run(JSON.stringify(result), Date.now(), key, digest);
    if (!Number(changed.changes)) throw new ProviderError('INVALID_REQUEST', 'The workflow checkpoint is no longer writable.');
  }
  unknown(key: string) {
    this.database.prepare("UPDATE operations SET status='unknown', updated_at=? WHERE key=? AND status='pending'")
      .run(Date.now(), key);
  }
  read(key: string): RecordRow | undefined {
    this.pruneResults();
    return this.database.prepare('SELECT digest,status,result FROM operations WHERE key=?').get(key) as RecordRow | undefined;
  }
  /** Existing video ledger migration/observation: never claim or dispatch work,
   * and never revive a result whose retention tombstone has expired. */
  legacyVideoRows(): Array<RecordRow & { key: string }> {
    return this.database.prepare("SELECT key,digest,status,result FROM operations WHERE substr(key,1,6)='video:' AND length(key)=70 AND result IS NOT NULL")
      .all() as Array<RecordRow & { key: string }>;
  }
  hasUnscopedVideoClaim(): boolean {
    // A previously pruned legacy key has no recoverable scope or outcome. Do
    // not guess it was safe: scoped modern tombstones do not hit this fence.
    return Boolean(this.database.prepare("SELECT 1 FROM operations WHERE substr(key,1,6)='video:' AND length(key)=70 AND status IN ('pending','unknown','expired') AND result IS NULL LIMIT 1").get());
  }
  migrateVideoKey(key: string, nextKey: string, result: unknown, uncertain: boolean) {
    this.database.prepare("UPDATE operations SET key=?, result=?, status=CASE WHEN ? THEN 'unknown' ELSE status END WHERE key=? AND status!='expired'")
      .run(nextKey, JSON.stringify(result), Number(uncertain), key);
  }
  observeExisting(key: string, digest: string, result: unknown, terminal: boolean) {
    const changed = this.database.prepare("UPDATE operations SET status=?, result=?, updated_at=? WHERE key=? AND digest=? AND status IN ('pending','unknown')")
      .run(terminal ? 'completed' : 'pending', JSON.stringify(result), Date.now(), key, digest);
    if (!Number(changed.changes)) throw new ProviderError('INVALID_REQUEST', 'The observed operation is no longer writable. Refresh its existing result.');
    this.pruneResults();
  }
  close() { this.database.close(); }
  /** Synchronous only: atomically fence continuations against competing dispatch claims. */
  transaction<T>(work: () => T): T {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      if (result && typeof result === 'object' && 'then' in result) throw new Error('Operation transactions must be synchronous.');
      this.database.exec('COMMIT');
      return result;
    } catch (error) { this.database.exec('ROLLBACK'); throw error; }
  }
}

export class OperationExecutor {
  private readonly active = new Map<string, { digest: string; promise: Promise<unknown> }>();
  constructor(private readonly repository: OperationRepository) {}
  read(key: string) { return this.repository.read(key); }
  async execute<T>(key: string, content: unknown, dispatch: () => Promise<T>, scopePrefix?: string): Promise<T> {
    const digest = operationDigest(content);
    const running = this.active.get(key);
    if (running) {
      if (running.digest !== digest) throw new ProviderError('INVALID_REQUEST', 'This running operation has different content.');
      return running.promise as Promise<T>;
    }
    const { claimed, row } = scopePrefix === undefined ? this.repository.claim(key, digest) : this.repository.claimExclusive(key, digest, scopePrefix);
    if (!claimed) {
      if (row.status === 'completed' && row.result !== null) return JSON.parse(row.result) as T;
      throw new ProviderError('PROVIDER_UNAVAILABLE', row.status === 'expired'
        ? 'The saved result expired. Review a new generation explicitly; this operation will not be repeated.'
        : 'The previous request outcome is unknown or still running elsewhere. It will not be dispatched again. Review provider activity before starting a new approved request.', false);
    }
    const promise = Promise.resolve().then(dispatch).then((result) => {
      this.repository.complete(key, result);
      return result;
    }).catch((error: unknown) => {
      this.repository.unknown(key);
      // Once dispatched, even a timeout/cancel can have incurred charges.
      throw new ProviderError('PROVIDER_UNAVAILABLE', 'This request did not return a saved result. Its provider outcome may be unknown; it will not be automatically repeated.', false, { cause: error });
    }).finally(() => { this.active.delete(key); });
    this.active.set(key, { digest, promise });
    return promise;
  }
}

let executor: Promise<OperationExecutor> | undefined;
export function localOperationExecutor(): Promise<OperationExecutor> {
  const path = process.env.CINESERYE_OPERATION_DB_PATH?.trim() || '.wrangler/cineserye-operations.sqlite';
  executor ??= OperationRepository.open(path).then((repository) => new OperationExecutor(repository)).catch(() => {
    executor = undefined;
    throw new ProviderError('INVALID_CONFIGURATION', 'Durable local operation storage is unavailable. No provider request was started.');
  });
  return executor;
}
