import { z } from 'zod';
import { canonicalRequest } from './request-digest';
import type { CinemaAssetRecord, CinemaCharacterRecord, CinemaProjectData } from './project-data';

const identifier = z.string().min(1).max(160);
export const ContinuityBindingSchema = z.object({
  version: z.literal(1), kind: z.enum(['character', 'asset']), entityId: identifier,
  nodeId: identifier, sourceIdentity: z.string().min(1).max(100_000),
}).strict();
export type ContinuityBinding = z.infer<typeof ContinuityBindingSchema>;
const CatalogEntitySchema = ContinuityBindingSchema.extend({
  title: z.string().max(500), summary: z.string().max(20_000),
  category: z.enum(['location', 'prop', 'visual-element', 'reference', 'other']).nullable(),
});
export const ContinuityCatalogSchema = z.object({ version: z.literal(1), entities: z.array(CatalogEntitySchema).max(500) }).strict()
  .superRefine((catalog, context) => {
    const ids = new Set<string>(), hosts = new Set<string>();
    catalog.entities.forEach((item, index) => {
      if (ids.has(item.entityId) || hosts.has(item.nodeId)) context.addIssue({ code: 'custom', path: ['entities', index], message: 'Continuity identities must be unambiguous.' });
      if ((item.kind === 'character') !== (item.category === null)) context.addIssue({ code: 'custom', path: ['entities', index], message: 'Continuity identity kind and category disagree.' });
      ids.add(item.entityId); hosts.add(item.nodeId);
    });
  });
export type ContinuityCatalog = z.infer<typeof ContinuityCatalogSchema>;
type Entity = CinemaCharacterRecord | CinemaAssetRecord;

/** Scene membership is additive metadata, not the identity itself. Excluding it
 * lets two reviewed siblings reuse the same person without self-invalidating. */
export function continuityEntityIdentity(entity: Entity): string {
  const { sceneIds: _sceneIds, continuityBinding: _binding, ...identity } = entity;
  void _sceneIds; void _binding;
  return canonicalRequest(identity);
}

export function buildContinuityCatalog(project: CinemaProjectData): ContinuityCatalog {
  return ContinuityCatalogSchema.parse({ version: 1, entities: [
    ...Object.values(project.characters).map((item) => ({ version: 1, kind: 'character', entityId: item.id, nodeId: item.nodeId,
      title: item.title, summary: item.summary, category: null, sourceIdentity: continuityEntityIdentity(item) })),
    ...Object.values(project.assets).map((item) => ({ version: 1, kind: 'asset', entityId: item.id, nodeId: item.nodeId,
      title: item.title, summary: item.summary, category: item.category, sourceIdentity: continuityEntityIdentity(item) })),
  ] });
}

/** Legacy manual planning text has no catalog and therefore no reuse authority. */
export function continuityCatalogFromContext(planningContext?: string): ContinuityCatalog {
  if (!planningContext) return { version: 1, entities: [] };
  let value: unknown;
  try { value = JSON.parse(planningContext); } catch { return { version: 1, entities: [] }; }
  if (!value || typeof value !== 'object' || !('continuityCatalog' in value)) return { version: 1, entities: [] };
  return ContinuityCatalogSchema.parse(value.continuityCatalog);
}

/** Null/omitted is deliberately NEW, even when another entity has that title. */
export function bindReviewedContinuity(catalog: ContinuityCatalog, kind: ContinuityBinding['kind'], existingEntityId?: string | null,
  category?: CinemaAssetRecord['category']): ContinuityBinding | undefined {
  if (!existingEntityId) return undefined;
  const found = catalog.entities.filter((item) => item.entityId === existingEntityId);
  const target = found[0];
  if (found.length !== 1 || target.kind !== kind || (kind === 'asset' && target.category !== category)) {
    throw Error('The plan references an unknown, ambiguous, or incompatible reviewed continuity identity.');
  }
  return ContinuityBindingSchema.parse({ version: 1, kind, entityId: target.entityId, nodeId: target.nodeId, sourceIdentity: target.sourceIdentity });
}

export function continuityReuseSummary(incoming: CinemaProjectData) {
  const entities = [...Object.values(incoming.characters), ...Object.values(incoming.assets)];
  return { reused: entities.filter((item) => item.continuityBinding).map((item) => ({ title: item.title, ...item.continuityBinding! })),
    newEntities: entities.filter((item) => !item.continuityBinding).map((item) => ({ id: item.id, title: item.title })) };
}

export function validatePlanContinuityCatalog(incoming: CinemaProjectData, catalog: ContinuityCatalog): void {
  const targets = new Set<string>();
  for (const [kind, records] of [['character', incoming.characters], ['asset', incoming.assets]] as const) {
    for (const item of Object.values(records)) {
      const binding = item.continuityBinding;
      if (!binding) continue;
      const reviewed = bindReviewedContinuity(catalog, kind, binding.entityId, kind === 'asset' ? (item as CinemaAssetRecord).category : undefined);
      if (targets.has(binding.nodeId) || canonicalRequest(reviewed) !== canonicalRequest(binding)) throw Error('Continuity reuse was not part of the reviewed scope or is duplicated.');
      targets.add(binding.nodeId);
    }
  }
}

/** Returns placeholder-host -> canonical-host only after exact identity checks.
 * A reviewed catalog is additionally required at the scoped acceptance boundary. */
export function resolveContinuityBindings(current: CinemaProjectData | undefined, incoming: CinemaProjectData, catalog?: ContinuityCatalog): Map<string, string> {
  if (catalog) validatePlanContinuityCatalog(incoming, catalog);
  const remap = new Map<string, string>(), targets = new Set<string>();
  for (const [kind, records] of [['character', incoming.characters], ['asset', incoming.assets]] as const) {
    for (const item of Object.values(records)) {
      const binding = item.continuityBinding;
      if (!binding) {
        const collision = current && (current.characters[item.id] || current.assets[item.id]
          || [...Object.values(current.characters), ...Object.values(current.assets)].find((old) => old.nodeId === item.nodeId));
        // Legacy manual successor plans can keep their own exact record/host IDs.
        // This is an explicit ID match, never permission to replace a sibling.
        const ownLegacyRecord = collision && collision.id === item.id && collision.nodeId === item.nodeId
          && collision.sceneIds.length === 1 && collision.sceneIds[0] === incoming.activeSceneId
          && item.sceneIds.length === 1 && item.sceneIds[0] === incoming.activeSceneId;
        if (collision && !ownLegacyRecord) throw Error('New continuity identities cannot overwrite an existing entity.');
        continue;
      }
      const target = kind === 'character' ? current?.characters[binding.entityId] : current?.assets[binding.entityId];
      if (binding.kind !== kind || !target || target.nodeId !== binding.nodeId || targets.has(binding.nodeId)
        || continuityEntityIdentity(target) !== binding.sourceIdentity
        || (kind === 'asset' && (target as CinemaAssetRecord).category !== (item as CinemaAssetRecord).category)) {
        throw Error('The reviewed continuity binding is stale, ambiguous, or incompatible.');
      }
      if (catalog) {
        const reviewed = bindReviewedContinuity(catalog, kind, binding.entityId, kind === 'asset' ? (item as CinemaAssetRecord).category : undefined);
        if (canonicalRequest(reviewed) !== canonicalRequest(binding)) throw Error('Continuity reuse was not part of the reviewed scope.');
      }
      targets.add(binding.nodeId); remap.set(item.nodeId, binding.nodeId);
    }
  }
  return remap;
}
