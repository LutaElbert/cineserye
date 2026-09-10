import type { EditorDocument } from './types';
import { validateEditorDocument } from './document-file';
import { APP_CONFIG } from './config';
import type { CanvasCommandProposal } from './canvas-commands';
import type { CinemaProjectData } from '../domain/cinema/project-data';
import type { CinemaClientTraceEvent } from '../features/scene-planner/plan-scene-api';
import { pruneCinemaTraceRecords } from '../server/cinema/telemetry';
import { unreferencedMediaHashes, type MediaRoot } from './media-reachability';
import { storyReferenceMediaHashes, updateStoryWorkflow, type StoryWorkflowData } from '../domain/cinema/story-workflow';

const DATABASE_NAME = APP_CONFIG.storage.databaseName;
const STORE_NAME = 'documents';
const CHECKPOINT_STORE_NAME = 'checkpoints';
const PENDING_PROPOSAL_STORE_NAME = 'pending-proposals';
const TRACE_STORE_NAME = 'agent-traces';
const MEDIA_STORE_NAME = 'media-blobs';
const DOCUMENT_ID = 'current';
const RECOVERY_DOCUMENT_ID = 'last-non-empty';
const DATABASE_VERSION = 6;
const MAX_CHECKPOINTS = 20;
// Protect blobs involved in local reads/uploads before React metadata commits.
// These conservative pins last for this page lifetime, never a permanent leak.
const sessionMediaPins = new Set<string>();
export function localMediaPins(): ReadonlySet<string> { return sessionMediaPins; }

type StoredDocument = EditorDocument & { id: string };

export type LocalCheckpoint = {
  id: string;
  createdAt: number;
  title: string;
  document: EditorDocument;
};

export type PendingCinemaProposal = {
  id: string;
  projectId: string;
  sceneId: string;
  runId: string;
  sourceFingerprint: string;
  proposal: CanvasCommandProposal;
  cinema: CinemaProjectData;
  mode: 'fixture' | 'live';
  warningSummary: string[];
  sourceCount: number;
  selectedNodeId: string | null;
  readyAt: number;
};

export type LocalCinemaTrace = {
  id: string;
  createdAt: number;
  events: CinemaClientTraceEvent[];
};

export type LocalMediaBlob = {
  hash: string;
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
  byteSize: number;
  createdAt: number;
};

type StoredLocalMediaBlob = Omit<LocalMediaBlob, 'blob'> & {
  bytes?: ArrayBuffer;
  /** Version 6 development builds stored Blob directly. Read it for migration. */
  blob?: Blob;
};

function hydrateLocalMediaBlob(stored: StoredLocalMediaBlob): LocalMediaBlob {
  const blob = stored.blob ?? new Blob([stored.bytes ?? new ArrayBuffer(0)], { type: stored.mimeType });
  return {
    hash: stored.hash,
    blob,
    mimeType: stored.mimeType,
    width: stored.width,
    height: stored.height,
    byteSize: stored.byteSize,
    createdAt: stored.createdAt,
  };
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
}

export async function sha256Blob(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return bytesToHex(new Uint8Array(digest));
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(CHECKPOINT_STORE_NAME)) {
        const store = database.createObjectStore(CHECKPOINT_STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
      if (!database.objectStoreNames.contains(PENDING_PROPOSAL_STORE_NAME)) {
        const store = database.createObjectStore(PENDING_PROPOSAL_STORE_NAME, { keyPath: 'id' });
        store.createIndex('readyAt', 'readyAt');
      }
      if (!database.objectStoreNames.contains(TRACE_STORE_NAME)) {
        const store = database.createObjectStore(TRACE_STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
      if (!database.objectStoreNames.contains(MEDIA_STORE_NAME)) {
        const store = database.createObjectStore(MEDIA_STORE_NAME, { keyPath: 'hash' });
        store.createIndex('createdAt', 'createdAt');
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveLocalMediaBlob(
  blob: Blob,
  metadata: Pick<LocalMediaBlob, 'mimeType' | 'width' | 'height'>,
): Promise<LocalMediaBlob> {
  const hash = await sha256Blob(blob);
  sessionMediaPins.add(hash);
  const entry: LocalMediaBlob = {
    hash,
    blob,
    mimeType: metadata.mimeType,
    width: metadata.width,
    height: metadata.height,
    byteSize: blob.size,
    createdAt: Date.now(),
  };
  // WebKit's IndexedDB implementation can reject direct Blob structured clones.
  // ArrayBuffer is portable across Chromium, Firefox, WebKit, and backup exports.
  const storedEntry: StoredLocalMediaBlob = {
    hash,
    bytes: await blob.arrayBuffer(),
    mimeType: entry.mimeType,
    width: entry.width,
    height: entry.height,
    byteSize: entry.byteSize,
    createdAt: entry.createdAt,
  };
  const database = await openDatabase();
  try {
    const existing = await new Promise<StoredLocalMediaBlob | undefined>((resolve, reject) => {
      const transaction = database.transaction(MEDIA_STORE_NAME, 'readonly');
      const request = transaction.objectStore(MEDIA_STORE_NAME).get(hash);
      request.onsuccess = () => resolve(request.result as StoredLocalMediaBlob | undefined);
      request.onerror = () => reject(request.error);
    });
    if (existing) return hydrateLocalMediaBlob(existing);
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(MEDIA_STORE_NAME, 'readwrite');
      const request = transaction.objectStore(MEDIA_STORE_NAME).put(storedEntry);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(request.error ?? transaction.error ?? new Error('Could not store local media.'));
      transaction.onabort = () => reject(request.error ?? transaction.error ?? new Error('Could not store local media.'));
    });
    return entry;
  } finally {
    database.close();
  }
}

export async function loadLocalMediaBlob(hash: string): Promise<LocalMediaBlob | null> {
  sessionMediaPins.add(hash);
  const database = await openDatabase();
  try {
    return await new Promise<LocalMediaBlob | null>((resolve, reject) => {
      const transaction = database.transaction(MEDIA_STORE_NAME, 'readonly');
      const request = transaction.objectStore(MEDIA_STORE_NAME).get(hash);
      request.onsuccess = () => {
        const stored = request.result as StoredLocalMediaBlob | undefined;
        resolve(stored ? hydrateLocalMediaBlob(stored) : null);
      };
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

export async function listLocalMediaBlobs(): Promise<LocalMediaBlob[]> {
  const database = await openDatabase();
  try {
    return await new Promise<LocalMediaBlob[]>((resolve, reject) => {
      const transaction = database.transaction(MEDIA_STORE_NAME, 'readonly');
      const request = transaction.objectStore(MEDIA_STORE_NAME).getAll();
      request.onsuccess = () => resolve((request.result as StoredLocalMediaBlob[]).map(hydrateLocalMediaBlob));
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

export async function deleteLocalMediaBlob(hash: string): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(MEDIA_STORE_NAME, 'readwrite');
      transaction.objectStore(MEDIA_STORE_NAME).delete(hash);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

/** Recheck persistent and in-memory reachability within the deletion transaction. */
export async function collectUnusedLocalMedia(
  candidates: readonly string[],
  memoryRoots: () => readonly (MediaRoot | null | undefined)[],
): Promise<number> {
  const database = await openDatabase();
  try {
    return await new Promise<number>((resolve, reject) => {
      const transaction = database.transaction(
        [STORE_NAME, CHECKPOINT_STORE_NAME, PENDING_PROPOSAL_STORE_NAME, MEDIA_STORE_NAME], 'readwrite',
      );
      const roots: MediaRoot[] = [];
      let remaining = 3;
      let removed = 0;
      const loaded = () => {
        if (--remaining !== 0) return;
        try {
          const unused = unreferencedMediaHashes(candidates, [...roots, ...memoryRoots()]);
          for (const hash of unused) {
            if (sessionMediaPins.has(hash)) continue;
            transaction.objectStore(MEDIA_STORE_NAME).delete(hash);
            removed += 1;
          }
        } catch { transaction.abort(); }
      };
      for (const storeName of [STORE_NAME, CHECKPOINT_STORE_NAME, PENDING_PROPOSAL_STORE_NAME]) {
        const request = transaction.objectStore(storeName).getAll();
        request.onsuccess = () => {
          const entries = request.result as Array<MediaRoot & { document?: MediaRoot }>;
          roots.push(...entries.map((entry) => entry.document ?? entry));
          loaded();
        };
      }
      transaction.oncomplete = () => resolve(removed);
      transaction.onerror = () => reject(transaction.error ?? new Error('Media cleanup failed.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Media cleanup was cancelled.'));
    });
  } finally { database.close(); }
}

export async function saveLocalCinemaTrace(trace: LocalCinemaTrace): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(TRACE_STORE_NAME, 'readwrite');
      transaction.objectStore(TRACE_STORE_NAME).put(structuredClone(trace));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
  const stored = await listLocalCinemaTraces();
  const retained = new Set(pruneCinemaTraceRecords(stored).map((entry) => entry.id));
  await Promise.all(stored.filter((entry) => !retained.has(entry.id)).map((entry) => deleteLocalCinemaTrace(entry.id)));
}

export async function listLocalCinemaTraces(): Promise<LocalCinemaTrace[]> {
  const database = await openDatabase();
  try {
    const traces = await new Promise<LocalCinemaTrace[]>((resolve, reject) => {
      const transaction = database.transaction(TRACE_STORE_NAME, 'readonly');
      const request = transaction.objectStore(TRACE_STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result as LocalCinemaTrace[]);
      request.onerror = () => reject(request.error);
    });
    return pruneCinemaTraceRecords(traces);
  } finally {
    database.close();
  }
}

async function deleteLocalCinemaTrace(id: string): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(TRACE_STORE_NAME, 'readwrite');
      transaction.objectStore(TRACE_STORE_NAME).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export async function savePendingCinemaProposal(pending: PendingCinemaProposal): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(PENDING_PROPOSAL_STORE_NAME, 'readwrite');
      transaction.objectStore(PENDING_PROPOSAL_STORE_NAME).put(structuredClone(pending));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export async function loadLatestPendingCinemaProposal(): Promise<PendingCinemaProposal | null> {
  const database = await openDatabase();
  try {
    const entries = await new Promise<PendingCinemaProposal[]>((resolve, reject) => {
      const transaction = database.transaction(PENDING_PROPOSAL_STORE_NAME, 'readonly');
      const request = transaction.objectStore(PENDING_PROPOSAL_STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result as PendingCinemaProposal[]);
      request.onerror = () => reject(request.error);
    });
    return entries.sort((left, right) => right.readyAt - left.readyAt)[0] ?? null;
  } finally {
    database.close();
  }
}

export async function deletePendingCinemaProposal(id: string): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(PENDING_PROPOSAL_STORE_NAME, 'readwrite');
      transaction.objectStore(PENDING_PROPOSAL_STORE_NAME).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export async function clearPendingCinemaProposals(): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(PENDING_PROPOSAL_STORE_NAME, 'readwrite');
      transaction.objectStore(PENDING_PROPOSAL_STORE_NAME).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export async function updatePendingCinemaProposal(
  id: string,
  patch: Partial<Pick<PendingCinemaProposal, 'cinema' | 'selectedNodeId'>>,
): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(PENDING_PROPOSAL_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(PENDING_PROPOSAL_STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => {
        const current = request.result as PendingCinemaProposal | undefined;
        if (current) store.put({ ...current, ...structuredClone(patch) });
      };
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export async function saveLocalDocument(document: EditorDocument): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const stored: StoredDocument = { ...validateEditorDocument(document), id: DOCUMENT_ID };
      store.put(stored);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

/** Atomic story edit against the latest saved project; future UI must use this
 * boundary rather than a read/modify/write pair across asynchronous operations. */
export async function commitLocalStoryWorkflow(projectId: string, expectedRevision: number,
  change: (draft: StoryWorkflowData) => void): Promise<EditorDocument> {
  const database = await openDatabase();
  try {
    return await new Promise<EditorDocument>((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME, MEDIA_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(DOCUMENT_ID);
      let result: EditorDocument;
      let failure: unknown;
      const fail = (error: unknown) => { failure = error; transaction.abort(); };
      request.onsuccess = () => {
        try {
          const current = validateEditorDocument(request.result);
          if (current.cinema?.projectId !== projectId) throw new Error('The saved project changed. Reload before editing story data.');
          result = validateEditorDocument({ ...current, updatedAt: Date.now(),
            cinema: updateStoryWorkflow(current.cinema, expectedRevision, change) });
          const hashes = [...storyReferenceMediaHashes(result.cinema?.storyWorkflow)];
          let remaining = hashes.length;
          const commit = () => {
            store.put({ ...result, id: DOCUMENT_ID });
            if (result.nodes.length) store.put({ ...result, id: RECOVERY_DOCUMENT_ID });
          };
          if (!remaining) { commit(); return; }
          for (const hash of hashes) {
            const media = transaction.objectStore(MEDIA_STORE_NAME).getKey(hash);
            media.onsuccess = () => {
              if (media.result === undefined) { fail(new Error('A story reference image is missing. Relink it before saving.')); return; }
              if (--remaining === 0) commit();
            };
          }
        } catch (error) { fail(error); }
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(failure ?? transaction.error ?? new Error('Story data could not be saved.'));
      transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('Story edit was cancelled. The saved project was not changed.'));
    });
  } finally { database.close(); }
}

export async function loadLocalDocument(): Promise<EditorDocument | null> {
  const database = await openDatabase();
  try {
    const stored = await new Promise<StoredDocument | undefined>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(DOCUMENT_ID);
      request.onsuccess = () => resolve(request.result as StoredDocument | undefined);
      request.onerror = () => reject(request.error);
    });
    if (!stored) return null;
    return validateEditorDocument(stored);
  } finally {
    database.close();
  }
}

export async function clearLocalDocument(): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(DOCUMENT_ID);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export async function saveLocalRecoveryDocument(document: EditorDocument): Promise<void> {
  if (document.nodes.length === 0) throw new Error('A recovery document must not be empty.');
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const stored: StoredDocument = {
        ...validateEditorDocument(document),
        id: RECOVERY_DOCUMENT_ID,
      };
      transaction.objectStore(STORE_NAME).put(stored);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export async function loadLocalRecoveryDocument(): Promise<EditorDocument | null> {
  const database = await openDatabase();
  try {
    const stored = await new Promise<StoredDocument | undefined>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(RECOVERY_DOCUMENT_ID);
      request.onsuccess = () => resolve(request.result as StoredDocument | undefined);
      request.onerror = () => reject(request.error);
    });
    return stored ? validateEditorDocument(stored) : null;
  } finally {
    database.close();
  }
}

export async function clearLocalRecoveryDocument(): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(RECOVERY_DOCUMENT_ID);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export async function listLocalCheckpoints(): Promise<LocalCheckpoint[]> {
  const database = await openDatabase();
  try {
    const stored = await new Promise<LocalCheckpoint[]>((resolve, reject) => {
      const transaction = database.transaction(CHECKPOINT_STORE_NAME, 'readonly');
      const request = transaction.objectStore(CHECKPOINT_STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result as LocalCheckpoint[]);
      request.onerror = () => reject(request.error);
    });
    return stored
      .map((checkpoint) => ({ ...checkpoint, document: validateEditorDocument(checkpoint.document) }))
      .sort((a, b) => b.createdAt - a.createdAt);
  } finally {
    database.close();
  }
}

export async function createLocalCheckpoint(document: EditorDocument): Promise<LocalCheckpoint> {
  const checkpoint: LocalCheckpoint = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    title: document.title,
    document: validateEditorDocument(document),
  };
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(CHECKPOINT_STORE_NAME, 'readwrite');
      transaction.objectStore(CHECKPOINT_STORE_NAME).put(checkpoint);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
  const checkpoints = await listLocalCheckpoints();
  await Promise.all(checkpoints.slice(MAX_CHECKPOINTS).map((item) => deleteLocalCheckpoint(item.id)));
  return checkpoint;
}

export async function deleteLocalCheckpoint(id: string): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(CHECKPOINT_STORE_NAME, 'readwrite');
      transaction.objectStore(CHECKPOINT_STORE_NAME).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}
