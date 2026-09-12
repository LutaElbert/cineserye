'use client';

import { useSyncExternalStore } from 'react';
import type { FilmmakingStage } from './navigation';
import { listClientOperations, subscribeClientOperations, type ClientOperationEntry } from './operation-journal';

const labels: Record<ClientOperationEntry['kind'], string> = {
  'story-analysis': 'Story analysis', 'story-plan': 'Scene planning', 'shot-plan': 'Shot planning',
  'image-generation': 'Reference images', 'video-generation': 'Video take',
};
const stage: Record<ClientOperationEntry['kind'], FilmmakingStage> = {
  'story-analysis': 'idea', 'story-plan': 'plan', 'shot-plan': 'plan', 'image-generation': 'references', 'video-generation': 'video',
};
const active = new Set<ClientOperationEntry['phase']>(['intent', 'dispatched', 'running', 'tracking-stopped', 'unknown']);

export function ProjectOperationSummary({ projectId, onOpen }: { projectId?: string; onOpen: (value: FilmmakingStage) => void }) {
  const snapshot = useSyncExternalStore(subscribeClientOperations,
    () => { try { return JSON.stringify(listClientOperations(projectId).slice(0, 20)); } catch (error) { return JSON.stringify({ error: error instanceof Error ? error.message : 'Operation recovery is unavailable.' }); } },
    () => '[]');
  const parsed = JSON.parse(snapshot) as ClientOperationEntry[] | { error: string };
  if ('error' in parsed) return <section className="operation-summary" role="alert"><strong>Request recovery needs attention</strong><p>{parsed.error}</p></section>;
  const entries = parsed.filter((entry) => active.has(entry.phase) || entry.phase === 'failed' || entry.phase === 'expired').slice(0, 3);
  if (!entries.length) return null;
  return <section className="operation-summary" aria-label="Saved request status"><header><strong>Saved requests</strong><span>Opening this list never starts generation.</span></header>
    <ul>{entries.map((entry) => <li key={entry.id}><div><strong>{labels[entry.kind]}</strong><span>{entry.phase.replace('-', ' ')}</span><small>{entry.id} · updated {new Date(entry.updatedAt).toLocaleString()}</small>{entry.lastError ? <p>{entry.lastError}</p> : null}</div>
      <button type="button" onClick={() => onOpen(stage[entry.kind])}>{active.has(entry.phase) ? 'Check existing request' : 'Review status'}</button></li>)}</ul></section>;
}
