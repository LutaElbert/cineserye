'use client';
import type { StoryWorkflowData } from '../../domain/cinema/story-workflow';

/** A saved-request ledger, not a provider action or an alternate canvas. */
export function StoryRevisionHistory({ workflow, busy, onReview, onCurrent, flat = false }: {
  workflow: StoryWorkflowData; busy: boolean; onReview: (id: string) => void; onCurrent: () => void; flat?: boolean;
}) {
  if (!workflow.sessions.length) return null;
  const content = <>
    <h3>Saved drafts · {workflow.sessions.length}</h3>
    <p>Opening history makes no AI call. Changed sources remain read-only until reviewed again.</p>
    {workflow.sessions.map((session, index) => {
      const revision = session.revision;
      const pending = session.proposals.filter((proposal) => !session.accepted.some((item) => item.proposalId === proposal.id)).length;
      const canReview = pending > 0 && ['proposal-review', 'stale'].includes(session.stage);
      const provenance = revision ? revision.provenance : session.provenance;
      const origin = provenance?.mode === 'fixture' ? 'Fixture · no AI calls' : provenance?.mode === 'live' ? `${provenance.provider} · ${provenance.model ?? 'model unreported'}` : 'Source unverified';
      const parent = revision ? workflow.sessions.findIndex((item) => item.id === revision.sourceSessionId) + 1 : null;
      return <article key={session.id} aria-label={`Saved draft ${index + 1}`}>
        <p><strong>Draft {index + 1}</strong> · {revision ? `${revision.status} · v${revision.sourceVersion}${revision.resultVersion ? ` → v${revision.resultVersion}` : ' → no new version'}` : `outline v${session.outlineVersion ?? session.proposalVersion ?? 1} · ${session.stage.replaceAll('-', ' ')}`}</p>
        {revision && <><p>{revision.instruction}</p><p>From draft {parent} · selected: {revision.selectedProposalIds.map((id) => workflow.sessions[parent! - 1]?.proposals.find((item) => item.id === id)?.title ?? id).join(' · ')}</p></>}
        <p>{revision && revision.status !== 'completed' ? 'No completed revision result recorded' : origin} · {pending} unaccepted · {session.accepted.length} added</p>
        {canReview && <button type="button" aria-label={`Review draft ${index + 1}`} disabled={busy} onClick={() => onReview(session.id)}>Review unaccepted drafts</button>}
      </article>;
    })}
    {workflow.reviewSessionId && <button type="button" onClick={onCurrent} disabled={busy}>Return to current flow</button>}
  </>;
  return flat ? <section className="assistant-history" aria-label="Saved story history">{content}</section> : <details className="assistant-history" aria-label="Saved story history"><summary>Draft & revision history · {workflow.sessions.length}</summary>{content}</details>;
}
