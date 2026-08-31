import { describe, expect, it } from 'vitest';
import { CINEMA_NODE_EXTENSIONS } from './node-extensions';

describe('cinema node extension catalog', () => {
  it('reserves every planned cinema node kind outside the editor layer', () => {
    expect(CINEMA_NODE_EXTENSIONS.all.map(({ kind }) => kind)).toEqual([
      'scene',
      'shot',
      'character',
      'asset',
      'agent-run',
    ]);
    expect(CINEMA_NODE_EXTENSIONS.all.every(({ status }) => status === 'planned')).toBe(true);
  });

  it('validates domain payloads without activating a renderer', () => {
    const scene = CINEMA_NODE_EXTENSIONS.get('scene');
    expect(scene?.validateData({
      schemaVersion: 1,
      kind: 'scene',
      title: 'Scene 01',
      synopsis: 'A filmmaker discovers a missing reel.',
      dramaticPurpose: 'Inciting incident',
      status: 'outline',
      estimatedDurationSeconds: 90,
      continuityNotes: '',
    })).toBe(true);
    expect(scene?.validateData({ kind: 'scene' })).toBe(false);
  });
});
