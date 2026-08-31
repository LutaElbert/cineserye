import { describe, expect, it } from 'vitest';
import { APP_CONFIG } from './config';
import { initialDocument } from './initial-document';

describe('Cineserye extraction contract', () => {
  it('uses isolated product, storage, backup, and export identifiers', () => {
    expect(APP_CONFIG).toMatchObject({
      name: 'Cineserye',
      shortMark: 'C',
      editorAriaLabel: 'Cineserye story canvas editor',
      storage: {
        databaseName: 'cineserye-local',
        projectFormat: 'cineserye-project',
        projectExtension: '.cineserye',
      },
      export: {
        defaultFileBase: 'cineserye-story',
        svgTitle: 'Cineserye editable story canvas',
      },
    });
  });

  it('starts with the premise-to-scene-to-shot story graph', () => {
    expect(initialDocument.nodes.map((node) => node.data.name)).toEqual([
      'Story Premise',
      'Scene 01',
      'Shot 01',
    ]);
    expect(initialDocument.edges.map(({ source, target }) => [source, target])).toEqual([
      ['story-premise', 'scene-01'],
      ['scene-01', 'shot-01'],
    ]);
  });
});
