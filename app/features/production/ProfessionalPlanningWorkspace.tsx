'use client';

import { AlertTriangle, ArrowDown, ArrowUp, Check, Download, Film, Grid2X2, Plus, Table2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { buildHandoffArchive, buildHandoffPackage, type CinemaHandoffFile } from '../../domain/cinema/handoff';
import type { CinemaProjectData, CinemaShotRecord } from '../../domain/cinema/project-data';
import {
  buildContinuityMatrix,
  createDefaultProfessionalPlanningData,
  productionOrderedShots,
  type CinemaProfessionalPlanningData,
  type CinemaProductionSetupRecord,
  type CinemaProductionStatus,
} from '../../domain/cinema/professional-planning';
import type { CinemaDomainCommand, CinemaShotPatch } from '../../editor/cinema-domain-commands';
import { loadLocalMediaBlob } from '../../editor/persistence';

export type ProfessionalWorkspaceView = 'table' | 'board';

function downloadFile(file: Pick<CinemaHandoffFile, 'content' | 'fileName' | 'mimeType'>) {
  const content: BlobPart = typeof file.content === 'string'
    ? file.content
    : new Uint8Array(file.content).buffer;
  const blob = new Blob([content], { type: file.mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function ApprovedFrame({ cinema, shotId }: { cinema: CinemaProjectData; shotId: string }) {
  const frame = Object.values(cinema.visualPreproduction?.storyboardFrames ?? {})
    .filter((candidate) => candidate.shotId === shotId && candidate.status === 'approved')
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    if (frame) void loadLocalMediaBlob(frame.blobHash).then((media) => {
      if (!active || !media) return;
      objectUrl = URL.createObjectURL(media.blob);
      setUrl(objectUrl);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [frame]);
  return url
    // Approved frames are local object URLs; provider image optimization must not upload them.
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={url} alt={`Approved storyboard for ${cinema.shots[shotId].title}`} />
    : <div className="production-frame-placeholder"><Film size={20} /><span>No approved frame</span></div>;
}

function setupDraft(sceneId: string): CinemaProductionSetupRecord {
  const id = `setup-${sceneId}-${crypto.randomUUID().slice(0, 8)}`;
  return {
    id,
    sceneId,
    name: 'New setup',
    camera: 'Creator-selected camera',
    lens: 'As planned per shot',
    lighting: '',
    location: '',
    equipment: [],
    notes: '',
    estimatedSetupMinutes: 15,
    shotIds: [],
  };
}

export function ProfessionalPlanningWorkspace({
  cinema,
  view,
  onViewChange,
  onCommand,
  onSelectShot,
  onNotice,
}: {
  cinema: CinemaProjectData;
  view: ProfessionalWorkspaceView;
  onViewChange: (view: ProfessionalWorkspaceView) => void;
  onCommand: (command: CinemaDomainCommand, successMessage: string) => void;
  onSelectShot: (nodeId: string) => void;
  onNotice: (message: string, tone?: 'info' | 'success' | 'error') => void;
}) {
  const sceneId = cinema.activeSceneId;
  const scene = sceneId ? cinema.scenes[sceneId] : null;
  const planning: CinemaProfessionalPlanningData = cinema.professionalPlanning
    ?? createDefaultProfessionalPlanningData(cinema);
  const continuity = useMemo(
    () => scene ? buildContinuityMatrix(cinema, planning, scene.id) : null,
    [cinema, planning, scene],
  );
  const [newSetup, setNewSetup] = useState<CinemaProductionSetupRecord | null>(null);
  if (!scene || !sceneId) return <div className="production-empty"><strong>No active scene</strong><span>Accept a shot plan before opening production views.</span></div>;
  const narrativeShots = scene.shotIds.map((shotId) => cinema.shots[shotId]);
  const productionShots = productionOrderedShots(cinema, planning, scene.id);
  const setups = Object.values(planning.setups).filter((setup) => setup.sceneId === scene.id);

  const patchShot = (shot: CinemaShotRecord, patch: CinemaShotPatch) => {
    onCommand({ type: 'update-shot', shotId: shot.id, patch }, `${shot.title} updated.`);
  };
  const exportHandoff = () => {
    if (!cinema.activeRevisionId) return;
    const handoff = buildHandoffPackage(cinema, planning, cinema.activeRevisionId);
    downloadFile(buildHandoffArchive(handoff));
    onNotice(`${handoff.files.length}-file handoff exported locally${handoff.warnings.length ? ` with ${handoff.warnings.length} continuity warning${handoff.warnings.length === 1 ? '' : 's'}` : ''}.`, handoff.warnings.length ? 'info' : 'success');
  };

  return (
    <section className="professional-workspace" aria-label="Professional shot planning workspace">
      <header className="professional-workspace-header">
        <div>
          <span className="eyebrow">Professional planning</span>
          <h2>{scene.title}</h2>
          <p>{narrativeShots.length} shots · {setups.length} setups · {continuity?.issues.length ?? 0} continuity warnings</p>
        </div>
        <div className="professional-workspace-actions">
          <div className="workspace-view-switch" role="group" aria-label="Professional planning view">
            <button type="button" className={view === 'table' ? 'active' : ''} aria-pressed={view === 'table'} onClick={() => onViewChange('table')}><Table2 size={14} /> Table</button>
            <button type="button" className={view === 'board' ? 'active' : ''} aria-pressed={view === 'board'} onClick={() => onViewChange('board')}><Grid2X2 size={14} /> Board</button>
          </div>
          <button type="button" className="primary-button" onClick={exportHandoff} disabled={!cinema.activeRevisionId}><Download size={14} /> Export handoff</button>
        </div>
      </header>

      {continuity?.issues.length ? <div className="production-warning" role="status"><AlertTriangle size={16} /><span><strong>Continuity review needed.</strong> {continuity.issues[0].message}{continuity.issues.length > 1 ? ` +${continuity.issues.length - 1} more` : ''}</span></div> : <div className="production-ready" role="status"><Check size={16} /> Continuity states are internally consistent.</div>}

      {view === 'table' ? <div className="shot-table-scroll">
        <table className="shot-planning-table">
          <caption className="visually-hidden">Editable narrative shot list and production order</caption>
          <thead><tr><th>Narr.</th><th>Prod.</th><th>Shot / beat</th><th>Framing</th><th>Movement</th><th>Lens</th><th>Duration</th><th>Audio</th><th>Risk</th><th>Status</th><th>Setup</th></tr></thead>
          <tbody>{narrativeShots.map((shot) => {
            const production = planning.shots[shot.id];
            return <tr key={shot.id} data-shot-id={shot.id}>
              <td><button type="button" className="shot-order-link" onClick={() => onSelectShot(shot.nodeId)}>{shot.order}</button></td>
              <td><div className="production-order-control"><span>{production.productionOrder}</span><button type="button" aria-label={`Move ${shot.title} earlier in production order`} disabled={production.productionOrder === 1} onClick={() => onCommand({ type: 'reorder-production-shot', shotId: shot.id, toIndex: production.productionOrder - 2 }, 'Production order updated.')}><ArrowUp size={12} /></button><button type="button" aria-label={`Move ${shot.title} later in production order`} disabled={production.productionOrder === narrativeShots.length} onClick={() => onCommand({ type: 'reorder-production-shot', shotId: shot.id, toIndex: production.productionOrder }, 'Production order updated.')}><ArrowDown size={12} /></button></div></td>
              <td><label><span className="visually-hidden">{shot.title} title</span><input defaultValue={shot.title} onBlur={(event) => event.target.value !== shot.title && patchShot(shot, { title: event.target.value })} /></label><small>{shot.purpose}</small></td>
              <td><input aria-label={`${shot.title} framing`} defaultValue={shot.framing} onBlur={(event) => event.target.value !== shot.framing && patchShot(shot, { framing: event.target.value })} /></td>
              <td><input aria-label={`${shot.title} movement`} defaultValue={shot.cameraMovement} onBlur={(event) => event.target.value !== shot.cameraMovement && patchShot(shot, { cameraMovement: event.target.value })} /></td>
              <td><input aria-label={`${shot.title} lens millimeters`} type="number" min="1" max="300" defaultValue={shot.lensMm ?? ''} onBlur={(event) => { const value = event.target.value ? Number(event.target.value) : null; if (value !== shot.lensMm) patchShot(shot, { lensMm: value }); }} /></td>
              <td><input aria-label={`${shot.title} duration seconds`} type="number" min="0.1" max="600" step="0.1" defaultValue={shot.durationSeconds} onBlur={(event) => Number(event.target.value) !== shot.durationSeconds && patchShot(shot, { durationSeconds: Number(event.target.value) })} /></td>
              <td><input aria-label={`${shot.title} audio`} defaultValue={shot.audio} onBlur={(event) => event.target.value !== shot.audio && patchShot(shot, { audio: event.target.value })} /></td>
              <td><select aria-label={`${shot.title} risk`} value={shot.risk} onChange={(event) => patchShot(shot, { risk: event.target.value as CinemaShotRecord['risk'] })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></td>
              <td><select aria-label={`${shot.title} production status`} value={production.status} onChange={(event) => onCommand({ type: 'set-production-status', shotIds: [shot.id], status: event.target.value as CinemaProductionStatus }, `${shot.title} marked ${event.target.value}.`)}><option value="planned">Planned</option><option value="ready">Ready</option><option value="captured">Captured</option><option value="skipped">Skipped</option></select></td>
              <td><select aria-label={`${shot.title} production setup`} value={production.setupId} onChange={(event) => onCommand({ type: 'assign-shots-to-setup', shotIds: [shot.id], setupId: event.target.value }, `${shot.title} moved to ${planning.setups[event.target.value].name}.`)}>{setups.map((setup) => <option key={setup.id} value={setup.id}>{setup.name}</option>)}</select></td>
            </tr>;
          })}</tbody>
        </table>
      </div> : <div className="storyboard-board" aria-label="Storyboard production board">{productionShots.map((shot) => {
        const production = planning.shots[shot.id];
        return <article key={shot.id} className={`storyboard-production-card status-${production.status}`}>
          <button type="button" className="storyboard-card-frame" onClick={() => onSelectShot(shot.nodeId)}><ApprovedFrame cinema={cinema} shotId={shot.id} /></button>
          <div className="storyboard-card-copy"><span>Shot {shot.order} · Production {production.productionOrder}</span><h3>{shot.title}</h3><p>{shot.description}</p><dl><div><dt>Framing</dt><dd>{shot.framing}</dd></div><div><dt>Duration</dt><dd>{shot.durationSeconds}s</dd></div><div><dt>Setup</dt><dd>{planning.setups[production.setupId].name}</dd></div><div><dt>Status</dt><dd>{production.status}</dd></div></dl></div>
        </article>;
      })}</div>}

      <section className="production-setups" aria-labelledby="production-setups-heading">
        <div className="production-section-heading"><div><span className="eyebrow">Production order</span><h3 id="production-setups-heading">Camera and lighting setups</h3></div><button type="button" className="secondary-button" onClick={() => setNewSetup(setupDraft(scene.id))}><Plus size={13} /> Add setup</button></div>
        {newSetup ? <form className="new-setup-form" onSubmit={(event) => { event.preventDefault(); onCommand({ type: 'upsert-production-setup', setup: newSetup }, `${newSetup.name} added.`); setNewSetup(null); }}><label><span>Name</span><input value={newSetup.name} onChange={(event) => setNewSetup({ ...newSetup, name: event.target.value })} required /></label><label><span>Camera</span><input value={newSetup.camera} onChange={(event) => setNewSetup({ ...newSetup, camera: event.target.value })} required /></label><label><span>Lighting</span><input value={newSetup.lighting} onChange={(event) => setNewSetup({ ...newSetup, lighting: event.target.value })} /></label><label><span>Setup minutes</span><input type="number" min="0" value={newSetup.estimatedSetupMinutes} onChange={(event) => setNewSetup({ ...newSetup, estimatedSetupMinutes: Number(event.target.value) })} /></label><div><button type="button" className="secondary-button" onClick={() => setNewSetup(null)}>Cancel</button><button type="submit" className="primary-button">Save setup</button></div></form> : null}
        <div className="setup-card-grid">{setups.map((setup) => <article key={setup.id}><span>{setup.shotIds.length} shots · {setup.estimatedSetupMinutes} min setup</span><h4>{setup.name}</h4><p>{setup.camera} · {setup.lens}</p><p>{setup.lighting || 'Lighting not specified'} · {setup.location || 'Location not specified'}</p></article>)}</div>
      </section>

      <section className="continuity-matrix-section" aria-labelledby="continuity-matrix-heading">
        <div className="production-section-heading"><div><span className="eyebrow">Change impact</span><h3 id="continuity-matrix-heading">Continuity matrix</h3></div><span>{continuity?.issues.length ?? 0} open warnings</span></div>
        {continuity?.rows.length ? <div className="continuity-table-scroll"><table className="continuity-table"><thead><tr><th>Element</th>{continuity.shotIds.map((shotId) => <th key={shotId}>S{cinema.shots[shotId].order}</th>)}</tr></thead><tbody>{continuity.rows.map((row) => <tr key={row.entityNodeId}><th>{row.title}<small>{row.category}</small></th>{row.cells.map((cell) => <td key={cell.shotId}>{cell.included ? <input aria-label={`${row.title} continuity state for ${cinema.shots[cell.shotId].title}`} defaultValue={cell.state} onBlur={(event) => event.target.value !== cell.state && onCommand({ type: 'set-continuity-state', shotId: cell.shotId, entityNodeId: row.entityNodeId, state: event.target.value }, 'Continuity state updated.')} /> : <span aria-label="Not used">—</span>}</td>)}</tr>)}</tbody></table></div> : <p className="production-empty-inline">No shared continuity elements are linked to this scene.</p>}
      </section>
    </section>
  );
}
