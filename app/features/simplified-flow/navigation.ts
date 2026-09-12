'use client';

import { useSyncExternalStore } from 'react';

export type FilmmakingWorkspace = 'story' | 'shots' | 'edit';
export type FilmmakingStage = 'idea' | 'plan' | 'references' | 'video' | 'final-cut';
export type FilmmakingDestination = FilmmakingWorkspace | FilmmakingStage;
export const workspaceNavigationEvent = 'cineserye-workspace-navigation';
const stages = new Set<FilmmakingStage>(['idea', 'plan', 'references', 'video', 'final-cut']);
export function workspaceForStage(stage: FilmmakingStage): FilmmakingWorkspace {
  return stage === 'idea' || stage === 'plan' ? 'story' : stage === 'references' || stage === 'video' ? 'shots' : 'edit';
}
export function stageFromSearch(search: string): FilmmakingStage {
  const parameters = new URLSearchParams(search), stage = parameters.get('stage');
  if (stages.has(stage as FilmmakingStage)) return stage as FilmmakingStage;
  const legacy = parameters.get('workspace');
  return legacy === 'shots' ? 'references' : legacy === 'edit' ? 'final-cut' : 'idea';
}
export function workspaceFromSearch(search: string): FilmmakingWorkspace {
  return workspaceForStage(stageFromSearch(search));
}
const subscribe = (notify: () => void) => {
  window.addEventListener('popstate', notify);
  window.addEventListener(workspaceNavigationEvent, notify);
  return () => { window.removeEventListener('popstate', notify); window.removeEventListener(workspaceNavigationEvent, notify); };
};
const snapshot = () => window.location.search;
const serverSnapshot = () => '';

export function setSimplifiedPreview(enabled: boolean) {
  const url = new URL(window.location.href);
  if (enabled) url.searchParams.set('flow', 'simplified');
  else { url.searchParams.delete('flow'); url.searchParams.delete('workspace'); url.searchParams.delete('stage'); }
  window.history.pushState(null, '', url);
  window.dispatchEvent(new Event(workspaceNavigationEvent));
}

/** URL/session state only. Navigation never changes project data or dispatches AI. */
export function useFilmmakingNavigation() {
  const search = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const stage = stageFromSearch(search);
  return {
    enabled: new URLSearchParams(search).get('flow') === 'simplified',
    stage,
    workspace: workspaceForStage(stage),
    select(destination: FilmmakingDestination) {
      const nextStage: FilmmakingStage = stages.has(destination as FilmmakingStage) ? destination as FilmmakingStage
        : destination === 'story' ? 'idea' : destination === 'shots' ? 'references' : 'final-cut';
      const url = new URL(window.location.href);
      url.searchParams.set('flow', 'simplified'); url.searchParams.set('stage', nextStage);
      url.searchParams.set('workspace', workspaceForStage(nextStage));
      window.history.pushState(null, '', url);
      window.dispatchEvent(new Event(workspaceNavigationEvent));
    },
  };
}
