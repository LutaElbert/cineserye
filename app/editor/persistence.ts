import type { EditorDocument } from './types';
import { validateEditorDocument } from './document-file';
import { APP_CONFIG } from './config';
import type { CanvasCommandProposal } from './canvas-commands';
import type { CinemaProjectData } from '../domain/cinema/project-data';
import type { CinemaClientTraceEvent } from '../features/scene-planner/plan-scene-api';

const DATABASE_NAME = APP_CONFIG.storage.databaseName;
const STORE_NAME = 'documents';
const CHECKPOINT_STORE_NAME = 'checkpoints';
const PENDING_PROPOSAL_STORE_NAME = 'pending-proposals';
const TRACE_STORE_NAME = 'agent-traces';
const DOCUMENT_ID = 'current';
const RECOVERY_DOCUMENT_ID = 'last-non-empty';
const DATABASE_VERSION = 5;
const MAX_CHECKPOINTS = 20;
const MAX_LOCAL_TRACES = 50;

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
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
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
  await Promise.all(stored.slice(MAX_LOCAL_TRACES).map((entry) => deleteLocalCinemaTrace(entry.id)));
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
    return traces.sort((left, right) => right.createdAt - left.createdAt);
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
