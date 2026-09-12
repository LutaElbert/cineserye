'use client';

import { useRef, type ReactNode } from 'react';
import { Clapperboard, Lightbulb, Scissors, SlidersHorizontal, X } from 'lucide-react';
import { containModalDeletionKey } from '../../components/ConfirmationDialog';
import type { CinemaProjectData, CinemaShotRecord } from '../../domain/cinema/project-data';
import { workspaceForStage, type FilmmakingDestination, type FilmmakingStage, type FilmmakingWorkspace } from './navigation';
import type { StageGuidance } from './stage-projection';
import type { WorkspaceCapabilitiesState } from './useWorkspaceCapabilities';
import { capabilityLabels, capabilityStatusLabels, capabilityDescription } from '../story-development/workflow-capabilities';
import './simplified-flow.css';

const workspaces = [
  { id: 'story', label: 'Story', icon: Lightbulb, stages: [{ id: 'idea', label: 'Idea' }, { id: 'plan', label: 'Plan' }] },
  { id: 'shots', label: 'Shots', icon: Clapperboard, stages: [{ id: 'references', label: 'References' }, { id: 'video', label: 'Video' }] },
  { id: 'edit', label: 'Edit', icon: Scissors, stages: [{ id: 'final-cut', label: 'Final Cut' }] },
] as const;

export function FilmmakingNavigation({ stage, recommendedStage, onSelect }: {
  stage: FilmmakingStage; recommendedStage: FilmmakingStage; onSelect: (destination: FilmmakingDestination) => void;
}) {
  const workspace = workspaceForStage(stage);
  const recommendedWorkspace = workspaceForStage(recommendedStage);
  const active = workspaces.find((item) => item.id === workspace)!;
  const selectWorkspace = (destination: FilmmakingWorkspace) => {
    if (destination === workspace) return;
    onSelect(destination === recommendedWorkspace ? recommendedStage : destination);
  };
  return <div className="filmmaking-navigation">
    <nav className="filmmaking-workspaces" aria-label="Filmmaking workspaces">
      {workspaces.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-current={workspace === id ? 'page' : undefined}
        data-recommended={recommendedWorkspace === id ? 'true' : undefined} onClick={() => selectWorkspace(id)}>
        <Icon size={17} aria-hidden="true" /><span>{label}</span>
      </button>)}
    </nav>
    <nav className="filmmaking-stages" aria-label={`${active.label} stages`}>
      {active.stages.map(({ id, label }) => <button key={id} type="button" aria-current={stage === id ? 'step' : undefined}
        data-recommended={recommendedStage === id ? 'true' : undefined} onClick={() => onSelect(id)}>{label}</button>)}
    </nav>
  </div>;
}

export function WorkspaceStatus({ state, onRefresh, onDiagnostics }: {
  state: WorkspaceCapabilitiesState; onRefresh: () => void; onDiagnostics: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(true);
  const value = state.value;
  return <>
    <button ref={trigger} type="button" className="workspace-status-trigger" onClick={() => { restoreFocus.current = true; dialog.current?.showModal(); }}><SlidersHorizontal size={15} />Workspace status</button>
    <dialog className="workspace-status-dialog nokey" ref={dialog} aria-labelledby="workspace-status-title" onKeyDownCapture={containModalDeletionKey} onClose={() => { if (restoreFocus.current) trigger.current?.focus(); }}>
      <header><div><h2 id="workspace-status-title">Workspace status</h2><p>{value ? `${value.runtime === 'local-node' ? 'Local operator' : 'Unsupported execution runtime'} · ${value.mode === 'fixture' ? 'fixture mode' : 'live mode'}` : 'Checking this workspace'}</p></div>
        <button type="button" aria-label="Close workspace status" onClick={() => dialog.current?.close()}><X size={19} /></button></header>
      {state.status === 'loading' && <p role="status">Checking configuration. No provider call is being made.</p>}
      {state.status === 'error' && <p role="alert">{state.error}</p>}
      {value && <ul>{(Object.keys(capabilityLabels) as Array<keyof typeof capabilityLabels>).map((key) => {
        const item = value.stages[key];
        return <li key={key}><div><strong>{capabilityLabels[key]}</strong><span className="capability-label" data-state={item.status}>{capabilityStatusLabels[item.status]}</span></div>
          <p>{capabilityDescription(item)}</p></li>;
      })}</ul>}
      <div className="workspace-status-note"><strong>Your drafts remain editable.</strong><p>Local reference uploads, editing and backups do not require AI generation. Save failures and missing media are reported separately.</p></div>
      <button type="button" onClick={onRefresh}>Refresh status</button>
      <button type="button" onClick={() => { restoreFocus.current = false; dialog.current?.close(); onDiagnostics(); }}>Detailed diagnostics</button>
    </dialog>
  </>;
}

export function WorkspaceGuide({ guidance, workbenchOwnsAction, onAction, onOverview }: {
  guidance: StageGuidance; workbenchOwnsAction: boolean; onAction: (action: StageGuidance['action']) => void; onOverview: () => void;
}) {
  return <section className="workspace-guide" aria-label="Current filmmaking step">
    <div><span className="workspace-eyebrow">{guidance.stage.replace('-', ' ')} · {guidance.state.replaceAll('-', ' ')}</span>
      <h2>{guidance.title}</h2><p>{guidance.description}</p></div>
    {workbenchOwnsAction ? guidance.stage === 'references' || guidance.stage === 'video'
      ? <button type="button" onClick={onOverview}>Back to shots overview</button>
      : <span className="workspace-owner-note">Continue in the open workbench</span>
      : guidance.action.kind !== 'none' ? <button className="primary-button" type="button" onClick={() => onAction(guidance.action)}>{guidance.action.label}</button>
        : guidance.stage !== 'final-cut' ? <button type="button" onClick={onOverview}>Back to overview</button> : null}
  </section>;
}

export function ShotsOverview({ stage, cinema, onOpenScene, onOpenShot, onPlan, renderPreview }: {
  stage: 'plan' | 'references' | 'video';
  cinema?: CinemaProjectData; onOpenScene: (sceneId: string) => void; onOpenShot: (nodeId: string) => void;
  onPlan: () => void; renderPreview: (shot: CinemaShotRecord) => ReactNode;
}) {
  const scenes = cinema?.sceneOrder.flatMap((id) => cinema.scenes[id] ? [cinema.scenes[id]] : []) ?? [];
  const noun = stage === 'plan' ? 'shots' : stage === 'references' ? 'references' : 'video takes';
  return <section className="simplified-shots" aria-label={`${stage === 'plan' ? 'Plan' : stage === 'references' ? 'References' : 'Video'} overview`}>
    {!scenes.length ? <div className="workspace-empty"><Clapperboard size={32} /><h3>Your {noun} begin with a scene</h3><p>Accept scenes or add them manually. Opening this stage never generates.</p><button className="primary-button" type="button" onClick={onPlan}>Go to Plan</button></div> : scenes.map((scene, index) => <section className="simplified-scene" key={scene.id} aria-label={`Scene ${index + 1}: ${scene.title}`}>
      <header><div><span className="workspace-eyebrow">Scene {String(index + 1).padStart(2, '0')}</span><h3>{scene.title}</h3><p>{scene.synopsis}</p></div>{stage === 'plan' && <button type="button" onClick={() => onOpenScene(scene.id)}>{scene.shotIds.length ? 'Review shot plan' : 'Plan this scene'}</button>}</header>
      <div className="simplified-shot-grid">{scene.shotIds.flatMap((id) => cinema?.shots[id] ? [cinema.shots[id]] : []).sort((a, b) => a.order - b.order).map((shot, shotIndex) => <article className="simplified-shot" key={shot.id}>
        <span className="workspace-eyebrow">Shot {String(shotIndex + 1).padStart(2, '0')} · {shot.durationSeconds}s</span>
        {renderPreview(shot)}<h4>{shot.title}</h4><p>{stage === 'plan' ? 'Accepted plan and editable shot details' : stage === 'references' ? 'Ownership, transfer and image candidate review' : 'Request approval, decoded footage and take review'}</p>
        <button type="button" onClick={() => onOpenShot(shot.nodeId)}>{stage === 'plan' ? 'Open shot' : stage === 'references' ? 'Review references' : 'Review video'}</button>
      </article>)}</div>
      {!scene.shotIds.length && <p className="workspace-status-note">No accepted shot plan yet. Review this scene’s scope before generating.</p>}
    </section>)}
  </section>;
}
