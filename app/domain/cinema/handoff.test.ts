import { describe, expect, it } from 'vitest';
import { MOCK_CINEMA_PROJECT_DATA } from './mock/reel-knows-tomorrow';
import { createDefaultProfessionalPlanningData } from './professional-planning';
import {
  buildHandoffPackage,
  buildHandoffArchive,
  buildShotListCsv,
  safeExportUrl,
  safeHandoffFileName,
  spreadsheetSafeCell,
} from './handoff';

describe('professional handoff exports', () => {
  it('S5-UT-04 neutralizes formulas, markup, unsafe URLs, and filenames', () => {
    expect(spreadsheetSafeCell('=WEBSERVICE("https://example.test")')).toBe('\'=WEBSERVICE("https://example.test")');
    expect(spreadsheetSafeCell('+1+1')).toBe("'+1+1");
    expect(safeExportUrl('javascript:alert(1)')).toBeNull();
    expect(safeExportUrl('https://example.test/source')).toBe('https://example.test/source');
    expect(safeHandoffFileName('../My <Scene> / Final')).toBe('..-my-scene-final');
  });

  it('S5-IT-02 creates a deterministic, revision-specific six-file handoff package', () => {
    const project = structuredClone(MOCK_CINEMA_PROJECT_DATA);
    const planning = createDefaultProfessionalPlanningData(project);
    const revisionId = project.activeRevisionId!;
    project.shots[project.scenes[project.activeSceneId!].shotIds[0]].title = '=Unsafe title';

    const first = buildHandoffPackage(project, planning, revisionId, '2026-09-02T06:00:00.000Z');
    const second = buildHandoffPackage(project, planning, revisionId, '2026-09-02T06:00:00.000Z');
    expect(first).toEqual(second);
    expect(first.files.map((file) => file.kind)).toEqual(['csv', 'pdf', 'markdown', 'markdown', 'csv', 'json']);
    expect(new TextDecoder().decode(first.files.find((file) => file.kind === 'pdf')!.content as Uint8Array))
      .toMatch(/^%PDF-1\.4/);
    const json = JSON.parse(first.files.find((file) => file.kind === 'json')!.content as string);
    expect(json).toMatchObject({ format: 'cineserye-handoff', revisionId });
    expect(json.narrativeShotIds).toHaveLength(project.scenes[project.activeSceneId!].shotIds.length);
    expect(first.files.every((file) => file.fileName.startsWith(first.baseName))).toBe(true);
    const archive = buildHandoffArchive(first);
    const archiveText = new TextDecoder().decode(archive.content);
    expect(Array.from(archive.content.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(archive.fileName).toMatch(/-handoff\.zip$/);
    expect(first.files.every((file) => archiveText.includes(file.fileName))).toBe(true);
  });

  it('keeps narrative and production ordering explicit in CSV', () => {
    const project = structuredClone(MOCK_CINEMA_PROJECT_DATA);
    const planning = createDefaultProfessionalPlanningData(project);
    const scene = project.scenes[project.activeSceneId!];
    planning.shots[scene.shotIds[0]].productionOrder = 2;
    planning.shots[scene.shotIds[1]].productionOrder = 1;
    const csv = buildShotListCsv(project, planning, project.activeRevisionId!);
    expect(csv).toContain('"Narrative order","Production order"');
    expect(csv).toContain('"1","2"');
    expect(csv).toContain('"2","1"');
  });

  it('wraps long PDF copy and normalizes punctuation without replacement glyphs', () => {
    const project = structuredClone(MOCK_CINEMA_PROJECT_DATA);
    const planning = createDefaultProfessionalPlanningData(project);
    project.revisions[project.activeRevisionId!].snapshot.scene.title = 'Punctuation — check · safe';
    const handoff = buildHandoffPackage(project, planning, project.activeRevisionId!, '2026-09-02T06:00:00.000Z');
    const pdf = new TextDecoder().decode(handoff.files.find((file) => file.kind === 'pdf')!.content as Uint8Array);
    expect(pdf).not.toContain('?');
    expect(pdf).toContain('Page 1 of');
    expect(pdf).toContain('Punctuation - check - safe');
    expect(pdf).toContain('(assumptions before spending.) Tj');
  });
});
