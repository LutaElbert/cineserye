'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, ArrowUp, Check, Pencil, ShieldCheck } from 'lucide-react';
import type { StoryWorkflowData } from '../../domain/cinema/story-workflow';
import type { StoryQuote } from './contracts';
import { assistantScrollSurface } from './assistant-scroll';
import { AssistantScrollHint } from './AssistantScrollHint';

type Session = StoryWorkflowData['sessions'][number];
type Proposal = Session['proposals'][number];
export type AssistantPlanningProgress = { label: string; status: 'running' | 'completed' };

/** Presentation only. Every mutation and provider approval stays with the owner. */
export function AssistantSceneStage({ session, brief, mode, quote, count, busy, stale: sourceStale, locked = false, error, notice, canGenerate,
  referenceTitles, referenceBlockers, partial, progress, allocation, onCount, onPartial, onEdit, onMove, onGenerate,
  onAccept, onConcept, onRecover, onCancel, onRetryQuote, onReviseDirection, allocationCorrection }: {
  session?: Session; brief?: StoryWorkflowData['briefs'][number]; mode: 'fixture' | 'live' | 'loading'; quote: StoryQuote | null;
  count: number; busy: boolean; stale: boolean; locked?: boolean; error: string; notice: string; canGenerate: boolean;
  referenceTitles: string[]; referenceBlockers: string[]; partial: boolean; progress: AssistantPlanningProgress[];
  allocation?: { existing: number | null; selected: number; resulting: number | null; target: number; remaining: number | null; blockers: string[] };
  allocationCorrection?: ReactNode;
  onCount: (count: number) => void; onPartial: (value: boolean) => void; onEdit: (id: string, patch: Partial<Proposal>) => void;
  onMove: (id: string) => void; onGenerate: (revision?: string) => void; onAccept: () => void; onConcept: (id: string) => void;
  onRecover: () => void; onCancel: () => void; onRetryQuote: () => void; onReviseDirection: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const stale = sourceStale || locked;
  const [revision, setRevision] = useState('');
  const [reviewRevision, setReviewRevision] = useState(false);
  const [composeRevision, setComposeRevision] = useState(false);
  const [concept, setConcept] = useState<string | null>(null);
  const correctionRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const acceptedIds = new Set(session?.accepted.map((item) => item.proposalId) ?? []);
  const pending = session?.proposals.filter((item) => !acceptedIds.has(item.id)) ?? [];
  const selected = pending.filter((item) => item.selected);
  const seconds = selected.reduce((sum, item) => sum + item.durationSeconds, 0);
  const target = allocation?.remaining ?? brief?.durationSeconds ?? 0;
  const reviewing = !busy && session && ['proposal-review', 'stale'].includes(session.stage) && pending.length > 0;
  const waiting = !busy && session && ['running', 'outcome-unknown', 'cancelled'].includes(session.stage);
  const needsAllocation = allocation?.existing === null && Boolean(allocationCorrection) && !stale;
  const focusAllocation = () => {
    const field = correctionRef.current?.querySelector<HTMLInputElement>('input:not(:disabled)');
    const body = assistantScrollSurface(field?.closest<HTMLElement>('.assistant-stage-scroll') ?? null);
    if (!field || !body) return;
    field.focus({ preventScroll: true });
    const bounds = body.getBoundingClientRect(), scale = bounds.height / body.clientHeight;
    if (scale > 0) body.scrollTop += (field.getBoundingClientRect().top - bounds.top) / scale - 20;
  };
  const mismatch = seconds !== target;
  const disclosure = quote ? mode === 'fixture' ? 'Fixture sample · no AI or paid calls'
    : quote.cost > 0 && Number.isFinite(quote.cost) ? `Est. $${quote.cost} · allowance $${quote.ceiling}. Actual charges may differ.` : 'Estimate unavailable — pricing must be configured before approval.' : 'Checking this feature’s availability…';
  const blockers = [...referenceBlockers, ...(allocation?.blockers ?? []), ...(quote?.blockers ?? [])];
  const liveApproval = mode === 'live';
  const stage = busy ? 'running' : reviewing ? 'review' : waiting ? 'recovery' : 'approval';
  useEffect(() => { assistantScrollSurface(scrollRef.current)?.scrollTo({ top: 0 }); }, [stage, session?.id]);

  return <div className="assistant-stage assistant-scene-stage" data-stage={stage}>
    <div ref={scrollRef} className="assistant-stage-scroll" key={`${stage}:${session?.id ?? 'new'}`}>
      {error && <p role="alert" className="assistant-alert">{error}</p>}
      {notice && !reviewing && !busy && <p role="status" className="assistant-help">{notice}</p>}
      {sourceStale && <p role="alert" className="assistant-alert">Your source changed. Existing scenes are safe; review the updated direction before adding these proposals.</p>}
      {busy ? <>
        <h3>Building your scene outline</h3>
        <p className="assistant-help">Your existing story stays in place. Only validated proposals become ready for review.</p>
        <ol className="assistant-real-progress" aria-label="Scene outline progress">
          {progress.length ? progress.map((step, index) => <li key={`${step.label}:${index}`} data-state={step.status}>
            {step.status === 'completed' ? <Check size={15} aria-hidden="true" /> : <span className="assistant-progress-ring" aria-hidden="true" />}<span>{step.label}</span>
          </li>) : <li data-state="running"><span className="assistant-progress-ring" aria-hidden="true" /><span>Preparing this approved request</span></li>}
        </ol>
      </> : reviewing ? <section aria-label="Story proposals" className="assistant-proposal-review" data-composing={composeRevision}>
        {composeRevision ? <>
          <h3>What should change?</h3>
          <label><span className="sr-only">Revision</span><textarea aria-label="Tell the Assistant what to change" placeholder="Make the ending more suspenseful…" value={revision} maxLength={2000} disabled={stale} onChange={(event) => { setRevision(event.target.value); setReviewRevision(false); }} /></label>
        </> : <>
        <div className="assistant-review-heading"><h3>Your scene outline</h3><span className="assistant-result-provenance" data-mode={session.provenance?.mode ?? 'unknown'} title={session.provenance?.mode === 'live' ? `Saved result from ${session.provenance.provider}${session.provenance.model ? ` · ${session.provenance.model}` : ''}. ${session.provenance.usage?.totalTokens != null ? `${session.provenance.usage.totalTokens} tokens reported.` : 'Actual usage not reported.'}` : undefined}>{session.provenance?.mode === 'fixture' ? 'Fixture · no AI calls' : session.provenance?.mode === 'live' ? 'Live AI result' : 'Source unverified'}</span></div>
        <div className="assistant-selection-summary" role="status">{selected.length} {selected.length === 1 ? 'scene' : 'scenes'} selected · {seconds}s of {target}s{brief?.durationScope === 'new-material' ? ' new material' : ''}</div>
        <div className="assistant-scene-rows">
          {pending.map((proposal, index) => <article key={proposal.id} className="story-proposal assistant-scene-row" data-expanded={editing === proposal.id}>
            <div className="assistant-scene-row-summary">
              <input type="checkbox" aria-label={`Select proposal ${index + 1}`} checked={proposal.selected} disabled={stale} onChange={(event) => onEdit(proposal.id, { selected: event.target.checked })} />
              <div className="assistant-scene-row-copy"><strong>{proposal.title}</strong><p title={proposal.synopsis}>{proposal.synopsis}</p></div>
              <span className="assistant-scene-duration">{proposal.durationSeconds}s</span>
              <button type="button" className="assistant-icon-button" aria-label={`Edit proposal ${index + 1}`} aria-expanded={editing === proposal.id} onClick={() => setEditing(editing === proposal.id ? null : proposal.id)}><Pencil size={15} /></button>
            </div>
            {editing === proposal.id && <div className="assistant-inline-edit">
              <label>Title<input aria-label={`Proposal ${index + 1} title`} value={proposal.title} maxLength={500} disabled={stale} onChange={(event) => onEdit(proposal.id, { title: event.target.value })} /></label>
              <label>Summary<textarea aria-label={`Proposal ${index + 1} synopsis`} value={proposal.synopsis} maxLength={20000} disabled={stale} onChange={(event) => onEdit(proposal.id, { synopsis: event.target.value })} /></label>
              {session.mode !== 'surprise' && <label>Duration (seconds)<input aria-label={`Proposal ${index + 1} duration`} type="number" min={1} max={3600} value={proposal.durationSeconds} disabled={stale} onChange={(event) => { if (event.target.validity.valid && event.target.value) onEdit(proposal.id, { durationSeconds: Number(event.target.value) }); }} /></label>}
              <div className="assistant-inline-actions"><button type="button" disabled={index === 0 || stale} onClick={() => onMove(proposal.id)}><ArrowUp size={14} />Move up</button><button type="button" onClick={() => setEditing(null)}>Done editing</button></div>
            </div>}
            {session.mode === 'surprise' && <button type="button" disabled={stale} onClick={() => setConcept(proposal.id)}>Choose this concept</button>}
          </article>)}
        </div>
        {brief?.constraints.filter((item) => item !== 'No restrictions').length ? <p className="assistant-kept"><ShieldCheck size={14} />Kept: {brief.constraints.filter((item) => item !== 'No restrictions').join(' · ')}</p> : null}
        <button type="button" className="assistant-text-button" disabled={!selected.length || stale} onClick={() => { setComposeRevision(true); assistantScrollSurface(scrollRef.current)?.scrollTo({ top: 0 }); }}>Revise selected scenes</button>
        {concept && <div className="assistant-inline-approval" role="region" aria-label="Concept replacement approval"><p>Use this concept as your Story premise? Existing scenes stay unchanged and this is undoable.</p><button type="button" onClick={() => setConcept(null)}>Keep reviewing</button></div>}
        {mismatch && session.mode !== 'surprise' && <label className="assistant-check assistant-partial"><input type="checkbox" checked={partial} onChange={(event) => onPartial(event.target.checked)} />Accept {seconds}s without stretching other scenes; keep unselected drafts.</label>}
        </>}
        {reviewRevision && <div className="assistant-inline-approval" role="region" aria-label="Scene revision approval"><strong>Revise {selected.length} selected {selected.length === 1 ? 'scene' : 'scenes'}</strong><p>Uses this instruction, your brief and the selected drafts. No images or video.</p></div>}
      </section> : waiting ? <>
        <h3>{session.stage === 'cancelled' ? 'Request stopped locally' : 'Check this request’s outcome'}</h3>
        <p>No duplicate request will be sent. Dispatched provider work may still complete or be billed.</p>
      </> : <section aria-label="Story generation review" className="assistant-outline-approval">
        <h3>{draftTitle(brief?.mode)}</h3>
        <p>{count} {brief?.mode === 'surprise' ? 'concepts' : 'scene proposals'} · {brief?.durationSeconds ?? '—'}s {brief?.durationScope === 'new-material' ? 'new material' : 'whole-video target'} · {brief?.aspectRatio ?? 'Format not confirmed'}</p>
        <p className="assistant-help">I’ll draft an outline for you to review. Nothing is added yet.</p>
        {allocation && (allocation.existing === null || allocation.existing > 0) && <p className="assistant-help">{allocation.existing === null ? 'Existing duration needs a decision' : `${allocation.existing}s already planned`} · {allocation.remaining === null ? 'Set the available duration below' : `${allocation.remaining}s available`}</p>}
        <label className="assistant-proposal-count">Scenes to draft<input type="number" min={1} max={10} disabled={locked} aria-label="Proposal count" value={count} onChange={(event) => { if (event.target.validity.valid && event.target.value) onCount(Number(event.target.value)); }} /></label>
        <p className="assistant-help">Uses your confirmed brief and current scenes{referenceTitles.length ? ` · ${referenceTitles.join(' · ')}` : ' · no references'}. No research, images or video.</p>
      </section>}
      {!busy && blockers.map((message) => <p key={message} role="alert" className="assistant-alert">{message}</p>)}
      {allocationCorrection && <div ref={correctionRef}>{allocationCorrection}</div>}
    </div>
    <AssistantScrollHint target={scrollRef} stage={`${stage}:${session?.id}:${composeRevision}`} />
    <footer className="assistant-stage-footer">
      {busy ? <><p className="assistant-help">Progress reflects actual operation events, not an estimated percentage.</p><button type="button" onClick={onCancel}>Stop request</button></>
        : waiting ? <button type="button" className="primary-button" onClick={onRecover}>Check saved result</button>
        : reviewing ? <><p className="assistant-help">{reviewRevision ? disclosure : composeRevision ? `${selected.length} selected ${selected.length === 1 ? 'scene' : 'scenes'} · accepted scenes stay unchanged.` : 'Only selected scenes are added. Existing work stays unchanged.'}</p><div className="assistant-footer-actions">
          <button type="button" disabled={locked && !composeRevision} onClick={() => { if (composeRevision) { setComposeRevision(false); setReviewRevision(false); } else onReviseDirection(); }}>{composeRevision ? 'Back' : 'Revise direction'}</button>
          {concept ? <button type="button" className="primary-button" onClick={() => { onConcept(concept); setConcept(null); }}>Use this concept</button>
            : reviewRevision ? <button type="button" className="primary-button" disabled={!canGenerate || !selected.length || !revision.trim() || stale} onClick={() => { onGenerate(revision.trim()); setReviewRevision(false); setComposeRevision(false); }}>{liveApproval ? 'Approve & revise' : 'Revise selected'}<ArrowRight size={15} /></button>
              : composeRevision ? <button type="button" className="primary-button" aria-label="Review scene revision" disabled={!revision.trim() || !selected.length || stale} onClick={() => setReviewRevision(true)}>Review revision<ArrowRight size={15} /></button>
              : session.mode !== 'surprise' ? <button type="button" className="primary-button" disabled={stale || !selected.length || (mismatch && !partial) || Boolean(allocation?.blockers.length)} onClick={onAccept}>Add {selected.length} {selected.length === 1 ? 'scene' : 'scenes'}<ArrowRight size={15} /></button> : <span className="assistant-help">Choose one concept to continue</span>}
        </div></>
        : needsAllocation ? <><p className="assistant-help">Set the missing duration locally, then review the updated direction.</p><button type="button" className="primary-button" onClick={focusAllocation}>Set scene duration<ArrowRight size={15} /></button></>
        : <><p className="assistant-help">{disclosure}</p><div className="assistant-footer-actions"><button type="button" disabled={locked} onClick={onReviseDirection}>Revise direction</button>{!quote ? <button type="button" onClick={onRetryQuote}>Refresh availability</button> : <button type="button" className="primary-button" disabled={locked || !canGenerate || blockers.length > 0} onClick={() => onGenerate()}>{liveApproval ? 'Approve & draft scenes' : 'Draft scene outline'}<ArrowRight size={15} /></button>}</div></>}
    </footer>
  </div>;
}

function draftTitle(mode?: string) { return mode === 'surprise' ? 'Explore a few story directions' : 'Ready to shape your scenes'; }
