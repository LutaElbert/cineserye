import { describe, expect, it } from 'vitest';
import {
  MOCK_CINEMA_PROJECT_DATA,
  MOCK_SHOT_PLAN_PROPOSAL,
} from '../domain/cinema/mock/reel-knows-tomorrow';
import { applyCanvasCommandProposal } from './canvas-commands';
import { applyCinemaDomainCommand } from './cinema-domain-commands';
import { initialDocument } from './initial-document';
import {
  parseProjectBackup,
  serializeProjectBackup,
  validateEditorDocument,
} from './document-file';

describe('Cineserye project backups', () => {
  it('round-trips a valid document through the portable envelope', () => {
    const source = serializeProjectBackup(initialDocument);
    const restored = parseProjectBackup(source);

    expect(restored.title).toBe(initialDocument.title);
    expect(restored.nodes).toHaveLength(initialDocument.nodes.length);
    expect(restored.edges).toHaveLength(initialDocument.edges.length);
    expect(restored.nodes.every((node) => node.selected === false)).toBe(true);
    expect(restored.schemaVersion).toBe(5);
    expect(restored.edges.every((edge) => edge.data?.relationship === 'hierarchy')).toBe(true);
  });

  it('preserves allowlisted connector relationships and drops unknown metadata values', () => {
    const document = structuredClone(initialDocument);
    document.edges[0].data = { ...document.edges[0].data!, relationship: 'attachment' };
    document.edges[1].data = { ...document.edges[1].data!, relationship: 'sequence' };
    const restored = parseProjectBackup(serializeProjectBackup(document));
    expect(restored.edges.map((edge) => edge.data?.relationship)).toEqual(['attachment', 'sequence']);

    const invalid = structuredClone(initialDocument) as unknown as {
      edges: Array<{ data: Record<string, unknown> }>;
    };
    invalid.edges[0].data.relationship = 'provider-authored';
    const sanitized = validateEditorDocument(invalid);
    expect(sanitized.edges[0].data?.relationship).toBeUndefined();
  });

  it('migrates version 1 projects to the current document version', () => {
    const legacy = structuredClone(initialDocument) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 1;
    const nodes = legacy.nodes as Array<{ data: Record<string, unknown> }>;
    for (const node of nodes) {
      delete node.data.body;
      delete node.data.collapsed;
      delete node.data.title;
    }
    const migrated = validateEditorDocument(legacy);
    expect(migrated.schemaVersion).toBe(5);
    const concept = migrated.nodes.find((node) => node.data.kind === 'concept');
    expect(concept?.data.kind === 'concept' && concept.data.body.type).toBe('doc');
    expect(concept?.data.kind === 'concept' && concept.data.title.type).toBe('doc');
  });

  it('migrates version 2 labels into formatted titles', () => {
    const legacy = structuredClone(initialDocument) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 2;
    const nodes = legacy.nodes as Array<{ data: Record<string, unknown> }>;
    for (const node of nodes) delete node.data.title;
    const migrated = validateEditorDocument(legacy);
    const concept = migrated.nodes.find((node) => node.data.kind === 'concept');
    if (!concept || concept.data.kind !== 'concept') throw new Error('Missing concept fixture.');
    expect(migrated.schemaVersion).toBe(5);
    expect(concept.data.title.content?.[0].content?.[0].marks).toEqual([{ type: 'bold' }]);
  });

  it('migrates version 3 concepts to default content alignment', () => {
    const legacy = structuredClone(initialDocument) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 3;
    const nodes = legacy.nodes as Array<{ data: Record<string, unknown> }>;
    for (const node of nodes) {
      delete node.data.horizontalAlign;
      delete node.data.verticalAlign;
    }
    const migrated = validateEditorDocument(legacy);
    const concept = migrated.nodes.find((node) => node.data.kind === 'concept');
    expect(migrated.schemaVersion).toBe(5);
    expect(concept?.data.kind === 'concept' && concept.data.horizontalAlign).toBe('left');
    expect(concept?.data.kind === 'concept' && concept.data.verticalAlign).toBe('top');
  });

  it('round-trips content alignment in version 4 projects', () => {
    const document = structuredClone(initialDocument);
    const concept = document.nodes.find((node) => node.data.kind === 'concept');
    if (!concept || concept.data.kind !== 'concept') throw new Error('Missing concept fixture.');
    concept.data.horizontalAlign = 'right';
    concept.data.verticalAlign = 'bottom';
    const restored = parseProjectBackup(serializeProjectBackup(document));
    const restoredConcept = restored.nodes.find((node) => node.id === concept.id);
    expect(restoredConcept?.data.kind === 'concept' && restoredConcept.data.horizontalAlign).toBe('right');
    expect(restoredConcept?.data.kind === 'concept' && restoredConcept.data.verticalAlign).toBe('bottom');
  });

  it('round-trips a bounded product domain type without coupling it to the canvas engine', () => {
    const document = structuredClone(initialDocument);
    const concept = document.nodes.find((node) => node.data.kind === 'concept');
    if (!concept || concept.data.kind !== 'concept') throw new Error('Missing concept fixture.');
    concept.data.domainType = 'cinema.character';

    const restored = parseProjectBackup(serializeProjectBackup(document));
    const restoredConcept = restored.nodes.find((node) => node.id === concept.id);

    expect(restoredConcept?.data.kind === 'concept' && restoredConcept.data.domainType).toBe('cinema.character');
  });

  it('rejects oversized product domain types', () => {
    const invalid = structuredClone(initialDocument);
    const concept = invalid.nodes.find((node) => node.data.kind === 'concept');
    if (!concept || concept.data.kind !== 'concept') throw new Error('Missing concept fixture.');
    concept.data.domainType = `cinema.${'x'.repeat(200)}`;

    expect(() => validateEditorDocument(invalid)).toThrow('Concept domain type is invalid or too long');
  });

  it('round-trips a complete versioned cinema sidecar', () => {
    const planned = applyCanvasCommandProposal(initialDocument, MOCK_SHOT_PLAN_PROPOSAL).document;
    planned.cinema = structuredClone(MOCK_CINEMA_PROJECT_DATA);

    const restored = parseProjectBackup(serializeProjectBackup(planned));

    expect(restored.schemaVersion).toBe(5);
    expect(restored.cinema?.schemaVersion).toBe(2);
    expect(restored.cinema?.sceneOrder).toEqual(['scene-01']);
    expect(Object.keys(restored.cinema?.shots ?? {})).toHaveLength(6);
    expect(Object.keys(restored.cinema?.prompts ?? {})).toHaveLength(18);
    expect(restored.cinema?.costs['cost-scene-01'].expected).toBe(820);
  });

  it('S7-UT-01 round-trips additive multi-scene order and continuity metadata', () => {
    const planned = applyCanvasCommandProposal(initialDocument, MOCK_SHOT_PLAN_PROPOSAL).document;
    planned.cinema = structuredClone(MOCK_CINEMA_PROJECT_DATA);
    let project = applyCinemaDomainCommand(planned, {
      type: 'add-scenes',
      scenes: [{ id: 'scene-02', title: 'The warning', synopsis: 'A warning appears.', dramaticPurpose: 'Escalate.' }],
    });
    const entityNodeId = Object.values(project.cinema!.characters)[0].nodeId;
    project = applyCinemaDomainCommand(project, {
      type: 'set-shared-entity-scenes', entityNodeId, sceneIds: ['scene-01', 'scene-02'],
    });
    project = applyCinemaDomainCommand(project, {
      type: 'upsert-shared-entity-variant',
      variant: { id: 'variant-02', entityNodeId, sceneId: 'scene-02', wardrobe: 'Rain coat', ageOrCondition: '', timeOfDay: 'Night', locationVariant: '', notes: '' },
    });

    const restored = parseProjectBackup(serializeProjectBackup(project));
    expect(restored.cinema?.sceneOrder).toEqual(['scene-01', 'scene-02']);
    expect(restored.cinema?.multiScene?.sharedEntityVariants['variant-02']).toMatchObject({ wardrobe: 'Rain coat' });
    expect(restored.nodes.some((node) => node.id === 'scene-02')).toBe(true);
  });

  it('migrates a version 4 generic document without inventing cinema data', () => {
    const legacy = structuredClone(initialDocument) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 4;
    delete legacy.cinema;

    const migrated = validateEditorDocument(legacy);

    expect(migrated.schemaVersion).toBe(5);
    expect(migrated.cinema).toBeUndefined();
  });

  it('rejects an unsupported future cinema sidecar version', () => {
    const planned = applyCanvasCommandProposal(initialDocument, MOCK_SHOT_PLAN_PROPOSAL).document;
    planned.cinema = { ...structuredClone(MOCK_CINEMA_PROJECT_DATA), schemaVersion: 4 } as never;

    expect(() => validateEditorDocument(planned)).toThrow('unsupported cinema data version');
  });

  it('removes trailing empty checklist rows while loading saved documents', () => {
    const stored = structuredClone(initialDocument);
    const concept = stored.nodes.find((node) => node.data.kind === 'concept');
    if (!concept || concept.data.kind !== 'concept') throw new Error('Missing concept fixture.');
    concept.data.body = {
      type: 'doc',
      content: [{
        type: 'taskList',
        content: [
          {
            type: 'taskItem',
            attrs: { checked: false },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Keep' }] }],
          },
          {
            type: 'taskItem',
            attrs: { checked: false },
            content: [{ type: 'paragraph' }],
          },
        ],
      }],
    };

    const restored = validateEditorDocument(stored);
    const restoredConcept = restored.nodes.find((node) => node.id === concept.id);
    expect(restoredConcept?.data.kind === 'concept' && restoredConcept.data.body.content?.[0].content).toHaveLength(1);
  });

  it('rejects multiline concept titles', () => {
    const invalid = structuredClone(initialDocument);
    const concept = invalid.nodes.find((node) => node.data.kind === 'concept');
    if (!concept || concept.data.kind !== 'concept') throw new Error('Missing concept fixture.');
    concept.data.title = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'First' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Second' }] },
      ],
    };
    expect(() => validateEditorDocument(invalid)).toThrow('single line');
  });

  it('rejects unsafe links in concept titles', () => {
    const unsafe = structuredClone(initialDocument);
    const concept = unsafe.nodes.find((node) => node.data.kind === 'concept');
    if (!concept || concept.data.kind !== 'concept') throw new Error('Missing concept fixture.');
    concept.data.title.content = [{
      type: 'paragraph',
      content: [{
        type: 'text',
        text: 'unsafe',
        marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
      }],
    }];
    expect(() => validateEditorDocument(unsafe)).toThrow('unsafe link');
  });

  it('rejects unsafe rich-text links', () => {
    const unsafe = structuredClone(initialDocument);
    const concept = unsafe.nodes.find((node) => node.data.kind === 'concept');
    if (!concept || concept.data.kind !== 'concept') throw new Error('Missing concept fixture.');
    concept.data.body = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{
        type: 'text',
        text: 'unsafe',
        marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
      }] }],
    };
    expect(() => validateEditorDocument(unsafe)).toThrow('unsafe link');
  });

  it('rejects duplicate layer ids', () => {
    const duplicate = structuredClone(initialDocument);
    duplicate.nodes[1].id = duplicate.nodes[0].id;
    expect(() => validateEditorDocument(duplicate)).toThrow('duplicate layer ids');
  });

  it.each([
    {
      name: 'duplicate connector ids',
      message: 'duplicate connector ids',
      mutate(document: typeof initialDocument) {
        document.edges[1].id = document.edges[0].id;
      },
    },
    {
      name: 'missing connector endpoints',
      message: 'missing layer',
      mutate(document: typeof initialDocument) {
        document.edges[0].target = 'missing-layer';
      },
    },
    {
      name: 'self-connections',
      message: 'layer to itself',
      mutate(document: typeof initialDocument) {
        document.edges[0].target = document.edges[0].source;
      },
    },
    {
      name: 'duplicate directed connectors',
      message: 'duplicate directed connectors',
      mutate(document: typeof initialDocument) {
        document.edges[1].source = document.edges[0].source;
        document.edges[1].target = document.edges[0].target;
      },
    },
  ])('rejects $name in portable backups', ({ message, mutate }) => {
    const document = structuredClone(initialDocument);
    mutate(document);
    const envelope = JSON.stringify({
      format: 'cineserye-project',
      version: 2,
      document,
    });
    expect(() => parseProjectBackup(envelope)).toThrow(message);
  });

  it('repairs invalid local graph edges without losing valid layers', () => {
    const local = structuredClone(initialDocument);
    local.edges.push({ ...structuredClone(local.edges[0]), id: 'duplicate-pair' });
    local.edges.push({ ...structuredClone(local.edges[0]), id: 'orphan', target: 'missing-layer' });
    const repaired = validateEditorDocument(local);
    expect(repaired.nodes).toHaveLength(local.nodes.length);
    expect(repaired.edges).toHaveLength(initialDocument.edges.length);
  });

  it('rejects unsupported project envelopes', () => {
    expect(() => parseProjectBackup('{"format":"another-app","version":1}')).toThrow(
      'not a supported Cineserye',
    );
  });
});
