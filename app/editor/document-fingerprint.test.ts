import { describe, expect, it } from 'vitest';
import { initialDocument } from './initial-document';
import { cinemaSourceFingerprint } from './document-fingerprint';

describe('cinema source fingerprint', () => {
  it('ignores transient selection and timestamps but changes with source content', () => {
    const transient = structuredClone(initialDocument);
    transient.updatedAt += 100;
    transient.nodes[0].selected = true;
    expect(cinemaSourceFingerprint(transient)).toBe(cinemaSourceFingerprint(initialDocument));
    transient.nodes[0].data.name = 'Changed premise';
    expect(cinemaSourceFingerprint(transient)).not.toBe(cinemaSourceFingerprint(initialDocument));
  });
});
