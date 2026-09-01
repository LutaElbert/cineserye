import { describe, expect, it } from 'vitest';
import {
  cinemaDraftRole,
  cinemaRelativeLabel,
  cinemaRelativeRole,
  nextCinemaDraftName,
} from './manual-creation';

describe('cinema manual creation', () => {
  it('recognizes explicit domain metadata and legacy eyebrows', () => {
    expect(cinemaDraftRole('cinema.scene')).toBe('scene');
    expect(cinemaDraftRole(undefined, 'Hero prop')).toBe('prop');
    expect(cinemaDraftRole(undefined, 'Idea')).toBeNull();
  });

  it('maps structural actions to filmmaking concepts', () => {
    expect(cinemaRelativeRole('story', 'child')).toBe('scene');
    expect(cinemaRelativeRole('scene', 'child')).toBe('shot');
    expect(cinemaRelativeRole('scene', 'sibling')).toBe('scene');
    expect(cinemaRelativeRole('shot', 'sibling')).toBe('shot');
    expect(cinemaRelativeLabel('scene', 'sibling')).toBe('Add next scene');
  });

  it('allocates stable human-readable draft names', () => {
    expect(nextCinemaDraftName('scene', ['Scene 01', 'Scene 03'])).toBe('Scene 04');
    expect(nextCinemaDraftName('story', [])).toBe('Story Premise');
    expect(nextCinemaDraftName('prop', ['Prop 01'])).toBe('Prop 02');
  });
});
