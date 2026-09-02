import { describe, expect, it } from 'vitest';
import { applyCanvasCommandProposal } from '../../editor/canvas-commands';
import { applyCinemaDomainCommand } from '../../editor/cinema-domain-commands';
import { initialDocument } from '../../editor/initial-document';
import type { EditorDocument } from '../../editor/types';
import { MOCK_CINEMA_PROJECT_DATA, MOCK_SHOT_PLAN_PROPOSAL } from './mock/reel-knows-tomorrow';
import {
  cinemaAuditFingerprint,
  readCinemaAuditData,
  runFixtureContinuityAudit,
} from './continuity-audit';

function auditDocument() {
  const canvas = applyCanvasCommandProposal(initialDocument, MOCK_SHOT_PLAN_PROPOSAL).document;
  let document: EditorDocument = { ...canvas, cinema: structuredClone(MOCK_CINEMA_PROJECT_DATA) };
  document = applyCinemaDomainCommand(document, {
    type: 'add-scenes',
    scenes: [{ id: 'scene-02', title: 'After the rain', synopsis: 'Mara returns.', dramaticPurpose: 'Escalate.' }],
  });
  const entityNodeId = Object.values(document.cinema!.characters)[0].nodeId;
  document = applyCinemaDomainCommand(document, {
    type: 'set-shared-entity-scenes', entityNodeId, sceneIds: ['scene-01', 'scene-02'],
  });
  document = applyCinemaDomainCommand(document, {
    type: 'upsert-shared-entity-variant',
    variant: {
      id: 'variant-mara-scene-02', entityNodeId, sceneId: 'scene-02', wardrobe: 'Rain coat',
      ageOrCondition: 'Exhausted', timeOfDay: 'Night', locationVariant: '', notes: 'Intentional change awaiting review.',
    },
  });
  return document;
}

describe('Sprint 8 continuity-aware audit', () => {
  it('S8-UT-01 fingerprints the selected context deterministically and changes when audited data changes', () => {
    const project = auditDocument().cinema!;
    const scope = { kind: 'project', id: null } as const;
    expect(cinemaAuditFingerprint(project, scope)).toBe(cinemaAuditFingerprint(structuredClone(project), scope));
    const changed = structuredClone(project);
    changed.scenes['scene-02'].synopsis = 'Mara returns with a damaged coat.';
    expect(cinemaAuditFingerprint(changed, scope)).not.toBe(cinemaAuditFingerprint(project, scope));
  });

  it('S8-IT-01 ranks a known unreviewed scene variant and leaves the source untouched', () => {
    const project = auditDocument().cinema!;
    const before = structuredClone(project);
    const result = runFixtureContinuityAudit(project, { kind: 'project', id: null }, '2026-09-02T06:00:00.000Z');
    expect(result.findings.length).toBeLessThanOrEqual(5);
    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'wardrobe-condition', disposition: 'open' }),
    ]));
    expect(project).toEqual(before);
  });

  it('S8-IT-02 records a run, dismisses without project mutation, and accepts one correction atomically', () => {
    const source = auditDocument();
    const audited = applyCinemaDomainCommand(source, {
      type: 'run-continuity-audit', scope: { kind: 'project', id: null }, createdAt: '2026-09-02T06:00:00.000Z',
    });
    const audit = readCinemaAuditData(audited.cinema!);
    const finding = Object.values(audit.findings).find((candidate) => candidate.correction);
    expect(finding).toBeDefined();
    const run = Object.values(audit.runs)[0];
    const dismissed = applyCinemaDomainCommand(audited, { type: 'dismiss-continuity-audit-finding', findingId: finding!.id });
    expect(readCinemaAuditData(dismissed.cinema!).findings[finding!.id].disposition).toBe('dismissed');
    expect(dismissed.cinema?.multiScene?.continuityExceptions).toEqual(audited.cinema?.multiScene?.continuityExceptions);

    const accepted = applyCinemaDomainCommand(audited, {
      type: 'accept-continuity-audit-correction', findingId: finding!.id, sourceFingerprint: run.sourceFingerprint,
    });
    expect(readCinemaAuditData(accepted.cinema!).findings[finding!.id].disposition).toBe('accepted');
    expect(accepted.cinema?.multiScene?.continuityExceptions[`audit-exception-${finding!.id}`]).toBeDefined();
    expect(audited.cinema?.multiScene?.continuityExceptions[`audit-exception-${finding!.id}`]).toBeUndefined();
  });

  it('S8-SEC-01 blocks stale correction acceptance after the audited project changes', () => {
    const source = auditDocument();
    const audited = applyCinemaDomainCommand(source, {
      type: 'run-continuity-audit', scope: { kind: 'project', id: null }, createdAt: '2026-09-02T06:00:00.000Z',
    });
    const audit = readCinemaAuditData(audited.cinema!);
    const finding = Object.values(audit.findings).find((candidate) => candidate.correction)!;
    const run = Object.values(audit.runs)[0];
    const changed = applyCinemaDomainCommand(audited, {
      type: 'update-scene', sceneId: 'scene-02', patch: { synopsis: 'Changed after audit.' },
    });
    expect(() => applyCinemaDomainCommand(changed, {
      type: 'accept-continuity-audit-correction', findingId: finding.id, sourceFingerprint: run.sourceFingerprint,
    })).toThrow('stale');
    expect(changed.cinema?.multiScene?.continuityExceptions[`audit-exception-${finding.id}`]).toBeUndefined();
  });
});
