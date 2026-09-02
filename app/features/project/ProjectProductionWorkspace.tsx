'use client';

import { AlertTriangle, ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, Copy, Film, Link2, Plus, Search, ShieldCheck, Sparkles, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  analyzeContinuityImpact,
  buildProjectSequence,
  calculateProjectTotals,
  proposeSceneBoundaries,
  type CinemaContinuityImpact,
  type CinemaSceneBoundaryProposal,
} from '../../domain/cinema/multi-scene';
import type { CinemaProjectData } from '../../domain/cinema/project-data';
import { readCinemaAuditData, type CinemaAuditScope } from '../../domain/cinema/continuity-audit';
import type { CinemaDomainCommand } from '../../editor/cinema-domain-commands';

type Notice = (message: string, tone?: 'info' | 'success' | 'error') => void;

function sceneDraft(title: string, synopsis: string, dramaticPurpose = '') {
  return { id: crypto.randomUUID(), title: title.trim(), synopsis: synopsis.trim(), dramaticPurpose: dramaticPurpose.trim() };
}

function projectExpectedCostLabel(cinema: CinemaProjectData, expected: number | null) {
  if (expected === null) return 'Unpriced';
  const priced = Object.values(cinema.costs).filter((cost) => cost.expected !== null);
  const bases = new Set(priced.map((cost) => cost.pricingMode === 'currency' ? cost.currency : cost.pricingMode));
  if (bases.size !== 1) return 'Mixed estimates';
  const basis = [...bases][0];
  if (basis === 'credits') return `${expected.toLocaleString('en-US')} credits`;
  const symbol = basis === 'PHP' ? '₱' : '$';
  return `${symbol}${expected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ProjectProductionWorkspace({
  cinema,
  onCommand,
  onOpenScene,
  onNotice,
}: {
  cinema: CinemaProjectData;
  onCommand: (command: CinemaDomainCommand, successMessage: string) => void;
  onOpenScene: (sceneId: string) => void;
  onNotice: Notice;
}) {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showAddScene, setShowAddScene] = useState(false);
  const [title, setTitle] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [boundaryReview, setBoundaryReview] = useState<CinemaSceneBoundaryProposal[] | null>(null);
  const [pendingImpact, setPendingImpact] = useState<CinemaContinuityImpact | null>(null);
  const [variantDraft, setVariantDraft] = useState<{ entityNodeId: string; sceneId: string; wardrobe: string; notes: string } | null>(null);
  const [exceptionDraft, setExceptionDraft] = useState<{ entityNodeId: string; sceneId: string; rationale: string } | null>(null);
  const [auditScopeKey, setAuditScopeKey] = useState('project');
  const totals = useMemo(() => calculateProjectTotals(cinema), [cinema]);
  const sequence = useMemo(() => buildProjectSequence(cinema), [cinema]);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const scenes = cinema.sceneOrder
    .map((sceneId) => cinema.scenes[sceneId])
    .filter((scene) => !normalizedQuery || `${scene.title} ${scene.synopsis}`.toLocaleLowerCase().includes(normalizedQuery));
  const entities = [...Object.values(cinema.characters), ...Object.values(cinema.assets)]
    .sort((left, right) => left.title.localeCompare(right.title));
  const audit = useMemo(() => readCinemaAuditData(cinema), [cinema]);
  const latestAudit = Object.values(audit.runs).sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
  const auditFindings = latestAudit?.findingIds.map((findingId) => audit.findings[findingId]).filter(Boolean) ?? [];

  const selectedAuditScope = (): CinemaAuditScope => {
    if (auditScopeKey === 'project') return { kind: 'project', id: null };
    const [kind, ...idParts] = auditScopeKey.split(':');
    return { kind: kind as 'scene' | 'entity', id: idParts.join(':') };
  };

  const addManualScene = () => {
    if (!title.trim()) return;
    onCommand({ type: 'add-scenes', scenes: [sceneDraft(title, synopsis)] }, `${title.trim()} added as an outline.`);
    setTitle('');
    setSynopsis('');
    setShowAddScene(false);
  };
  const proposeImport = () => {
    try {
      setBoundaryReview(proposeSceneBoundaries(treatment));
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Scene boundaries could not be proposed.', 'error');
    }
  };
  const acceptImport = () => {
    if (!boundaryReview?.length) return;
    onCommand({
      type: 'add-scenes',
      scenes: boundaryReview.map((proposal) => sceneDraft(proposal.title, proposal.synopsis, proposal.beatSummary)),
    }, `${boundaryReview.length} reviewed scene outline${boundaryReview.length === 1 ? '' : 's'} added.`);
    setBoundaryReview(null);
    setTreatment('');
  };
  const stageShare = (entityNodeId: string) => {
    try {
      setPendingImpact(analyzeContinuityImpact(cinema, entityNodeId));
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Continuity impact could not be calculated.', 'error');
    }
  };

  return <section className="project-production-workspace" aria-label="Multi-scene project workspace">
    <header className="project-production-header">
      <div><span className="eyebrow">Microdrama project</span><h2>Production overview</h2><p>Plan each scene independently while continuity, cost, and sequence remain project-aware.</p></div>
      <div className="project-header-actions"><button type="button" className="secondary-button" onClick={() => onCommand({ type: 'run-continuity-audit', scope: selectedAuditScope(), createdAt: new Date().toISOString() }, 'Continuity audit completed. Review each finding before applying a correction.')}><ShieldCheck size={14} /> Audit project</button><button type="button" className="primary-button" onClick={() => setShowAddScene((current) => !current)}><Plus size={14} /> Add scene</button></div>
    </header>

    <dl className="project-totals" aria-label="Project totals">
      <div><dt>Scenes</dt><dd>{totals.plannedScenes}/{totals.scenes} planned</dd></div>
      <div><dt>Shots</dt><dd>{totals.shots}</dd></div>
      <div><dt>Runtime</dt><dd>{totals.durationSeconds}s</dd></div>
      <div><dt>Expected generation</dt><dd>{projectExpectedCostLabel(cinema, totals.expectedCost)}</dd></div>
      <div><dt>Approved outputs</dt><dd>{totals.storyboardFrames} frames · {totals.approvedClips} clips</dd></div>
    </dl>

    <section className="project-panel project-audit-panel" aria-labelledby="project-audit-heading">
      <div className="project-panel-heading"><div><span className="eyebrow">Bounded copilot review</span><h3 id="project-audit-heading">Continuity audit</h3></div><label className="audit-scope"><span>Scope</span><select value={auditScopeKey} onChange={(event) => setAuditScopeKey(event.target.value)}><option value="project">Entire project</option>{cinema.sceneOrder.map((sceneId) => <option key={sceneId} value={`scene:${sceneId}`}>Scene · {cinema.scenes[sceneId].title}</option>)}{entities.map((entity) => <option key={entity.nodeId} value={`entity:${entity.nodeId}`}>Entity · {entity.title}</option>)}</select></label></div>
      {!latestAudit ? <p className="project-empty">Run the fixture audit to inspect continuity, duration, and budget without making an AI or cloud call.</p> : <><p className="audit-summary">{auditFindings.length ? `${auditFindings.filter((finding) => finding.disposition === 'open').length} open of ${auditFindings.length} ranked findings` : 'No bounded issues found'} · source {latestAudit.sourceFingerprint}</p><div className="audit-finding-list">{auditFindings.map((finding) => <article key={finding.id} className={`audit-finding severity-${finding.severity}`}><div className="audit-finding-copy"><span className="audit-severity"><AlertTriangle size={12} /> {finding.severity} · {finding.category.replace('-', ' ')}</span><h4>{finding.title}</h4><p>{finding.explanation}</p><small>{finding.affectedSceneIds.length} scenes · {finding.affectedShotIds.length} shots · {finding.confidence}</small></div><div className="audit-actions">{finding.disposition === 'open' ? <><button type="button" className="text-button" onClick={() => onCommand({ type: 'dismiss-continuity-audit-finding', findingId: finding.id }, 'Audit finding dismissed without changing the project.')}><X size={12} /> Dismiss</button>{finding.correction ? <button type="button" className="secondary-button" onClick={() => onCommand({ type: 'accept-continuity-audit-correction', findingId: finding.id, sourceFingerprint: latestAudit.sourceFingerprint }, 'Continuity exception accepted as one undoable change.')}><Check size={12} /> Record as intentional</button> : <span>Manual revision required</span>}</> : <span className={`audit-disposition disposition-${finding.disposition}`}>{finding.disposition}</span>}</div></article>)}</div></>}
    </section>

    {showAddScene ? <form className="project-inline-form" onSubmit={(event) => { event.preventDefault(); addManualScene(); }}>
      <div><span className="eyebrow">Manual outline</span><h3>Add one scene</h3></div>
      <label><span>Scene title</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={500} required /></label>
      <label><span>Synopsis</span><textarea value={synopsis} onChange={(event) => setSynopsis(event.target.value)} maxLength={20_000} /></label>
      <div className="project-form-actions"><button type="button" className="secondary-button" onClick={() => setShowAddScene(false)}>Cancel</button><button type="submit" className="primary-button">Add outline</button></div>
    </form> : null}

    <div className="project-workspace-grid">
      <section className="project-panel" aria-labelledby="project-scenes-heading">
        <div className="project-panel-heading"><div><span className="eyebrow">Narrative order</span><h3 id="project-scenes-heading">Scenes</h3></div><label className="project-search"><Search size={14} /><span className="visually-hidden">Filter scenes</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter scenes" /></label></div>
        <div className="project-scene-list">{scenes.map((scene) => {
          const index = cinema.sceneOrder.indexOf(scene.id);
          const isCollapsed = collapsed.has(scene.id);
          const duration = scene.shotIds.reduce((sum, shotId) => sum + cinema.shots[shotId].durationSeconds, 0);
          const activeRevision = Object.values(cinema.revisions).find((revision) => revision.sceneId === scene.id && revision.status === 'active');
          return <article key={scene.id} className={`project-scene-card ${cinema.activeSceneId === scene.id ? 'active' : ''}`} data-scene-id={scene.id}>
            <div className="project-scene-summary">
              <button type="button" className="project-collapse" aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${scene.title}`} aria-expanded={!isCollapsed} onClick={() => setCollapsed((current) => { const next = new Set(current); if (next.has(scene.id)) next.delete(scene.id); else next.add(scene.id); return next; })}>{isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}</button>
              <span className="project-scene-number">{String(index + 1).padStart(2, '0')}</span>
              <div><h4>{scene.title}</h4><p>{activeRevision ? `Revision ${activeRevision.number}` : 'Unplanned'} · {scene.shotIds.length} shots · {duration}s</p></div>
              <div className="project-scene-order"><button type="button" aria-label={`Move ${scene.title} earlier`} disabled={index === 0} onClick={() => onCommand({ type: 'reorder-scene', sceneId: scene.id, toIndex: index - 1 }, 'Narrative scene order updated.')}><ArrowUp size={13} /></button><button type="button" aria-label={`Move ${scene.title} later`} disabled={index === cinema.sceneOrder.length - 1} onClick={() => onCommand({ type: 'reorder-scene', sceneId: scene.id, toIndex: index + 1 }, 'Narrative scene order updated.')}><ArrowDown size={13} /></button></div>
            </div>
            {!isCollapsed ? <div className="project-scene-details"><p>{scene.synopsis || 'No synopsis yet.'}</p><div><button type="button" className="secondary-button" onClick={() => onOpenScene(scene.id)}><Sparkles size={13} /> {activeRevision ? 'Open scene' : 'Open & plan'}</button><button type="button" className="text-button" onClick={() => onCommand({ type: 'add-scenes', scenes: [sceneDraft(`${scene.title} copy`, scene.synopsis, scene.dramaticPurpose)] }, `${scene.title} duplicated as an independent outline.`)}><Copy size={13} /> Duplicate as outline</button></div></div> : null}
          </article>;
        })}</div>
        {!scenes.length ? <p className="project-empty">No scenes match this filter.</p> : null}
      </section>

      <section className="project-panel" aria-labelledby="scene-import-heading">
        <div className="project-panel-heading"><div><span className="eyebrow">Review before mutation</span><h3 id="scene-import-heading">Import treatment</h3></div></div>
        <textarea aria-label="Treatment or scene outline" value={treatment} onChange={(event) => { setTreatment(event.target.value); setBoundaryReview(null); }} placeholder={'SCENE 1: The arrival\nA creator enters...\n\nSCENE 2: The reveal\nThe clue appears...'} />
        {boundaryReview ? <div className="scene-boundary-review" aria-label="Proposed scene boundaries">{boundaryReview.map((proposal, index) => <article key={proposal.id}><span>Scene {index + 1}</span><label><span className="visually-hidden">Scene {index + 1} title</span><input value={proposal.title} onChange={(event) => setBoundaryReview((current) => current?.map((item) => item.id === proposal.id ? { ...item, title: event.target.value } : item) ?? null)} /></label><label><span className="visually-hidden">Scene {index + 1} summary</span><textarea value={proposal.synopsis} onChange={(event) => setBoundaryReview((current) => current?.map((item) => item.id === proposal.id ? { ...item, synopsis: event.target.value, beatSummary: event.target.value.slice(0, 240) } : item) ?? null)} /></label></article>)}</div> : <p className="project-help">Parsing only proposes boundaries. The canvas does not change until you accept this review.</p>}
        <div className="project-form-actions">{boundaryReview ? <button type="button" className="secondary-button" onClick={() => setBoundaryReview(null)}>Revise source</button> : null}<button type="button" className="primary-button" onClick={boundaryReview ? acceptImport : proposeImport} disabled={!treatment.trim()}>{boundaryReview ? <><Check size={13} /> Accept {boundaryReview.length} scenes</> : 'Propose boundaries'}</button></div>
      </section>
    </div>

    <section className="project-panel project-continuity-panel" aria-labelledby="shared-continuity-heading">
      <div className="project-panel-heading"><div><span className="eyebrow">Shared continuity</span><h3 id="shared-continuity-heading">Characters and assets</h3></div><span>{entities.length} reusable elements</span></div>
      {entities.length ? <div className="shared-entity-list">{entities.map((entity) => {
        const variantCount = Object.values(cinema.multiScene?.sharedEntityVariants ?? {}).filter((variant) => variant.entityNodeId === entity.nodeId).length;
        const exceptionCount = Object.values(cinema.multiScene?.continuityExceptions ?? {}).filter((exception) => exception.entityNodeId === entity.nodeId).length;
        return <article key={entity.nodeId}><div><strong>{entity.title}</strong><p>{entity.sceneIds.length} scene{entity.sceneIds.length === 1 ? '' : 's'} · {Object.values(cinema.shots).filter((shot) => shot.continuityNodeIds.includes(entity.nodeId)).length} affected shots · {variantCount} variants · {exceptionCount} exceptions</p></div><div className="shared-entity-actions"><button type="button" className="secondary-button" onClick={() => stageShare(entity.nodeId)}><Link2 size={13} /> Review impact</button>{entity.sceneIds.length > 1 ? <button type="button" className="text-button" onClick={() => setVariantDraft({ entityNodeId: entity.nodeId, sceneId: entity.sceneIds[1] ?? entity.sceneIds[0], wardrobe: '', notes: '' })}>Add scene variant</button> : null}<button type="button" className="text-button" onClick={() => setExceptionDraft({ entityNodeId: entity.nodeId, sceneId: entity.sceneIds[0], rationale: '' })}>Add exception</button></div></article>;
      })}</div> : <p className="project-empty">Plan a scene to create reusable character, prop, and location continuity records.</p>}
      {pendingImpact ? <div className="continuity-impact-review" role="dialog" aria-modal="false" aria-labelledby="continuity-impact-title"><div><span className="eyebrow">Change impact review</span><h4 id="continuity-impact-title">Share {pendingImpact.title} across every scene?</h4><p>This currently affects {pendingImpact.affectedSceneIds.length} scenes and {pendingImpact.affectedShotIds.length} shots. After acceptance, all {cinema.sceneOrder.length} scenes may define scoped variants without replacing the shared identity.</p><p><strong>Affected shots:</strong> {pendingImpact.affectedShotIds.length ? pendingImpact.affectedShotIds.map((shotId) => cinema.shots[shotId]?.title ?? shotId).join(', ') : 'None yet'}</p></div><div className="project-form-actions"><button type="button" className="secondary-button" onClick={() => setPendingImpact(null)}>Cancel</button><button type="button" className="primary-button" onClick={() => { onCommand({ type: 'set-shared-entity-scenes', entityNodeId: pendingImpact.entityNodeId, sceneIds: cinema.sceneOrder }, `${pendingImpact.title} shared across ${cinema.sceneOrder.length} scenes.`); setPendingImpact(null); }}><Check size={13} /> Accept continuity change</button></div></div> : null}
      {variantDraft ? <form className="continuity-variant-form" aria-label="Scene continuity variant" onSubmit={(event) => {
        event.preventDefault();
        onCommand({ type: 'upsert-shared-entity-variant', variant: {
          id: `variant-${variantDraft.entityNodeId}-${variantDraft.sceneId}`,
          entityNodeId: variantDraft.entityNodeId,
          sceneId: variantDraft.sceneId,
          wardrobe: variantDraft.wardrobe,
          ageOrCondition: '',
          timeOfDay: '',
          locationVariant: '',
          notes: variantDraft.notes,
        } }, 'Scene-scoped continuity variant saved.');
        setVariantDraft(null);
      }}><label><span>Scene</span><select value={variantDraft.sceneId} onChange={(event) => setVariantDraft({ ...variantDraft, sceneId: event.target.value })}>{cinema.sceneOrder.map((sceneId) => <option key={sceneId} value={sceneId}>{cinema.scenes[sceneId].title}</option>)}</select></label><label><span>Wardrobe or visual change</span><input value={variantDraft.wardrobe} onChange={(event) => setVariantDraft({ ...variantDraft, wardrobe: event.target.value })} placeholder="Rain coat, damaged prop, warmer light…" /></label><label><span>Notes</span><input value={variantDraft.notes} onChange={(event) => setVariantDraft({ ...variantDraft, notes: event.target.value })} /></label><div className="project-form-actions"><button type="button" className="secondary-button" onClick={() => setVariantDraft(null)}>Cancel</button><button type="submit" className="primary-button">Save variant</button></div></form> : null}
      {exceptionDraft ? <form className="continuity-variant-form" aria-label="Continuity exception" onSubmit={(event) => {
        event.preventDefault();
        const shotIds = Object.values(cinema.shots).filter((shot) => shot.sceneId === exceptionDraft.sceneId && shot.continuityNodeIds.includes(exceptionDraft.entityNodeId)).map((shot) => shot.id);
        onCommand({ type: 'add-project-continuity-exception', exception: {
          id: crypto.randomUUID(), entityNodeId: exceptionDraft.entityNodeId, sceneId: exceptionDraft.sceneId,
          shotIds, rationale: exceptionDraft.rationale,
        } }, 'Continuity exception saved with its rationale.');
        setExceptionDraft(null);
      }}><label><span>Scene</span><select value={exceptionDraft.sceneId} onChange={(event) => setExceptionDraft({ ...exceptionDraft, sceneId: event.target.value })}>{cinema.sceneOrder.map((sceneId) => <option key={sceneId} value={sceneId}>{cinema.scenes[sceneId].title}</option>)}</select></label><label className="continuity-rationale"><span>Exception rationale</span><input required value={exceptionDraft.rationale} onChange={(event) => setExceptionDraft({ ...exceptionDraft, rationale: event.target.value })} placeholder="Intentional wardrobe or prop discontinuity…" /></label><div className="project-form-actions"><button type="button" className="secondary-button" onClick={() => setExceptionDraft(null)}>Cancel</button><button type="submit" className="primary-button">Save exception</button></div></form> : null}
    </section>

    <section className="project-panel project-sequence-panel" aria-labelledby="project-sequence-heading">
      <div className="project-panel-heading"><div><span className="eyebrow">Assembly readiness</span><h3 id="project-sequence-heading">Project sequence</h3></div><span>Narrative and production order stay explicit</span></div>
      <div className="project-sequence-table"><table><thead><tr><th>Scene</th><th>Narrative shot</th><th>Production</th><th>Title</th><th>Duration</th><th>Output</th></tr></thead><tbody>{sequence.map((entry) => <tr key={`${entry.sceneId}:${entry.shotId ?? 'unplanned'}`}><td>{entry.sceneNumber}</td><td>{entry.shotNumber ?? '—'}</td><td>{entry.productionOrder ?? '—'}</td><td>{entry.title}</td><td>{entry.durationSeconds}s</td><td><span className={`sequence-status status-${entry.status}`}><Film size={12} /> {entry.status.replace('-', ' ')}</span></td></tr>)}</tbody></table></div>
    </section>
  </section>;
}
