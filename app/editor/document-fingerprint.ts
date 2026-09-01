import type { EditorDocument } from './types';
import { validateEditorDocument } from './document-file';

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
}

/** Content fingerprint for stale-proposal detection; not a security primitive. */
export function cinemaSourceFingerprint(document: EditorDocument): string {
  const normalized = validateEditorDocument(document);
  const source = canonical({
    schemaVersion: normalized.schemaVersion,
    title: normalized.title,
    nodes: normalized.nodes.map((node) => ({ ...node, selected: false, dragging: false })),
    edges: normalized.edges.map((edge) => ({ ...edge, selected: false })),
    cinema: normalized.cinema,
  });
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
