import { z } from 'zod';
import type { CinemaProjectData } from './project-data';
import { canonicalRequest } from './request-digest';
import { StoryAssistantSchema } from './story-assistant';
import { StoryGenresSchema } from './story-genres';
import { ScopedShotStateSchema } from './scoped-shot-planning';
import { OperationProvenanceSchema } from './generation-operation';

const id = z.string().min(1).max(160).regex(/^[a-zA-Z0-9_.:-]+$/)
  .refine((value) => !['__proto__', 'constructor', 'prototype'].includes(value), 'Reserved ID.');
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const short = z.string().trim().min(1).max(500);
const text = z.string().max(20_000);
const version = z.number().int().positive();
const owner = z.object({ kind: z.enum(['story', 'scene', 'shot']), id }).strict();
const uses = z.enum(['research', 'story-development', 'shot-planning', 'image-generation', 'video-generation']);
const unique = <T,>(values: T[]) => new Set(values).size === values.length;
const answers = z.array(z.object({ id: z.enum(['format', 'duration', 'tone-ending', 'constraints']),
  values: z.array(short).max(30).refine(unique), customText: z.string().max(2_000),
}).strict()).max(4).refine((items) => unique(items.map((item) => item.id)), 'Duplicate question ID.');
const ReferenceContentSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('note'), text: z.string().trim().min(1).max(10_000) }).strict(),
  z.object({ kind: z.literal('image'), blobHash: hash,
    mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
    byteSize: z.number().int().positive().max(15 * 1024 * 1024),
    width: z.number().int().positive().max(16_384), height: z.number().int().positive().max(16_384),
  }).strict(),
]).refine((content) => content.kind !== 'image' || content.width * content.height <= 24_000_000, 'Image exceeds decoded pixel limit.');
export const StoryReferenceVersionSchema = z.object({
  version, title: short, category: z.enum(['character', 'location', 'prop', 'style', 'composition', 'other']),
  content: ReferenceContentSchema, provenance: text,
  rights: z.enum(['creator-owned', 'licensed', 'public-domain', 'unknown']),
  approval: z.enum(['pending', 'approved', 'revoked']),
  allowedUses: z.array(uses).max(5).refine(unique, 'Duplicate permitted use.'),
  archived: z.boolean(),
}).strict();
const reference = z.object({ id, versions: z.array(StoryReferenceVersionSchema).min(1).max(100) }).strict()
  .refine((value) => value.versions.every((entry, index) => entry.version === index + 1), 'Reference versions must be contiguous.');
const binding = z.object({ owner, rules: z.array(z.discriminatedUnion('action', [
  z.object({ action: z.literal('add'), referenceId: id }).strict(),
  z.object({ action: z.literal('exclude'), referenceId: id }).strict(),
  z.object({ action: z.literal('replace'), referenceId: id, replacementId: id }).strict(),
])).max(100) }).strict().refine((value) => unique(value.rules.map((rule) => rule.referenceId)), 'Only one local rule per reference.');
export const StoryCreativeBriefSchema = z.object({
  version, mode: z.enum(['surprise', 'expand', 'continue']), sourceDigest: hash,
  premise: text, aspectRatio: z.enum(['9:16', '16:9', '1:1', '4:5']),
  platform: z.enum(['short-form', 'youtube', 'film-festival', 'commercial', 'other']),
  durationSeconds: z.number().int().positive().max(86_400), durationScope: z.enum(['whole-story', 'new-material']),
  tone: short, genres: StoryGenresSchema.optional(), ending: text, constraints: z.array(short).max(30),
  assumptions: z.array(short).max(30), status: z.enum(['draft', 'approved']),
  answers,
}).strict().refine((value) => unique(value.answers.map((answer) => answer.id)), 'Duplicate question ID.')
  .refine((value) => value.durationScope === (value.mode === 'continue' ? 'new-material' : 'whole-story'), 'Duration scope does not match route.');
const snapshot = z.object({ sourceDigest: hash, briefVersion: version, bindingRevision: z.number().int().nonnegative(),
  references: z.array(z.object({ id, version }).strict()).max(100).refine((items) => unique(items.map((item) => item.id))),
}).strict();
export const StorySceneProposalSchema = z.object({ id, title: short, synopsis: text, purpose: text,
  durationSeconds: z.number().int().positive().max(3_600), selected: z.boolean(),
}).strict();
const revisionLineage = z.object({
  instruction: z.string().trim().min(1).max(4_000), sourceSessionId: id, sourceOperationId: id.nullable(),
  selectedProposalIds: z.array(id).min(1).max(10).refine(unique), sourceVersion: version, resultVersion: version.nullable(),
  status: z.enum(['running', 'completed', 'rejected', 'cancelled', 'outcome-unknown']),
  requestedAt: z.string().datetime(), resolvedAt: z.string().datetime().nullable(),
  provenance: OperationProvenanceSchema.optional(),
}).strict().refine((value) => value.status === 'completed' ? value.resultVersion === value.sourceVersion + 1 : value.resultVersion === null,
  'A revision result must identify the next reviewed outline version.');
const session = z.object({ id, operationId: id.nullable(),
  mode: z.enum(['surprise', 'expand', 'continue']), anchorSceneId: id.nullable(),
  stage: z.enum(['draft', 'questions', 'brief-review', 'generation-review', 'running', 'proposal-review', 'accepted', 'rejected', 'cancelled', 'failed', 'stale', 'outcome-unknown']),
  source: snapshot, proposals: z.array(StorySceneProposalSchema).max(10),
  accepted: z.array(z.object({ proposalId: id, sceneId: id,
    allocationSeconds: z.number().int().positive().max(3_600).optional(),
    // Accepted output identity is separate from the reviewed input fingerprint.
    sourceIdentity: z.string().max(100_000).optional(),
  }).strict()).max(10),
  presentation: z.enum(['scene-review', 'scenes-added']).optional(),
  proposalVersion: version.optional(),
  outlineVersion: version.optional(), provenance: OperationProvenanceSchema.optional(),
  revision: revisionLineage.optional(),
  error: z.string().max(2_000).nullable(),
}).strict().refine((value) => unique(value.proposals.map((item) => item.id))
  && unique(value.accepted.map((item) => item.proposalId)) && unique(value.accepted.map((item) => item.sceneId)), 'Duplicate proposal or acceptance.');
export const StoryWorkflowSchema = z.object({
  version: z.union([z.literal(1), z.literal(2)]), revision: z.number().int().nonnegative(), bindingRevision: z.number().int().nonnegative(),
  assistant: StoryAssistantSchema.optional(),
  // View selection only; chronological session order and canonical scenes stay intact.
  reviewSessionId: id.nullable().optional(),
  shotPlanning: z.lazy(() => ScopedShotStateSchema).optional(),
  shotPlanningHistory: z.array(z.lazy(() => ScopedShotStateSchema)).max(20).optional(),
  allocations: z.array(z.object({ sceneId: id, durationSeconds: z.number().int().positive().max(86_400),
    source: z.enum(['manual', 'story-proposal']), sessionId: id.optional(), proposalId: id.optional(),
  }).strict()).max(2_500).refine((items) => unique(items.map((item) => item.sceneId)), 'Duplicate scene allocation.').optional(),
  references: z.array(reference).max(500), bindings: z.array(binding).max(2_500),
  briefs: z.array(StoryCreativeBriefSchema).max(100), sessions: z.array(session).max(100),
  draft: z.object({ mode: z.enum(['surprise', 'expand', 'continue']), premise: text, answers,
    anchorSceneId: id.nullable(), durationSeconds: z.number().int().positive().max(86_400).nullable(),
    aspectRatio: z.enum(['9:16', '16:9', '1:1', '4:5']).nullable(), tone: text, ending: text,
    genres: StoryGenresSchema.optional(), constraints: z.array(short).max(30),
  }).strict().nullable(),
}).strict().refine((data) => data.version === 2 ? Boolean(data.assistant) : !data.assistant, 'Assistant state requires workflow v2.');
export type StoryWorkflowData = z.infer<typeof StoryWorkflowSchema>;
export type StoryReferenceVersion = z.infer<typeof StoryReferenceVersionSchema>;
export type StoryReferenceOwner = z.infer<typeof owner>;
export type StoryReferenceBinding = z.infer<typeof binding>;
export type StoryReferenceUse = z.infer<typeof uses>;
export type StorySourceSnapshot = z.infer<typeof snapshot>;
export function storyReviewSession(workflow: StoryWorkflowData | undefined) {
  return workflow?.reviewSessionId ? workflow.sessions.find((item) => item.id === workflow.reviewSessionId) : workflow?.sessions.at(-1);
}
export function emptyStoryWorkflow(): StoryWorkflowData {
  return { version: 1, revision: 0, bindingRevision: 0, references: [], bindings: [], briefs: [], sessions: [], draft: null };
}
export function storyReferenceMediaHashes(data: StoryWorkflowData | undefined): Set<string> {
  return new Set(data?.references.flatMap((reference) => reference.versions.flatMap((version) =>
    version.content.kind === 'image' ? [version.content.blobHash] : [])) ?? []);
}
const ownerKey = (value: StoryReferenceOwner) => `${value.kind}:${value.id}`;
export function storyOwnerExists(project: CinemaProjectData, value: StoryReferenceOwner) {
  return value.kind === 'story' ? value.id === project.projectId
    : value.kind === 'scene' ? Boolean(project.scenes[value.id]) : Boolean(project.shots[value.id]);
}
export function validateStoryWorkflow(value: unknown, project: CinemaProjectData): StoryWorkflowData {
  const parsed = StoryWorkflowSchema.safeParse(value);
  if (!parsed.success) throw new Error('Story workflow data is invalid or uses an unsupported version. Open a compatible backup; do not discard its story data.');
  const data = parsed.data;
  if (data.shotPlanning && data.shotPlanning.projectId !== project.projectId) throw Error('Shot planning belongs to another project.');
  if (data.shotPlanningHistory?.some((item) => item.projectId !== project.projectId)) throw Error('Shot planning history belongs to another project.');
  if (data.assistant?.checkpoint && (data.assistant.checkpoint.projectId !== project.projectId
    || data.assistant.checkpoint.premiseNodeId !== data.assistant.premiseNodeId)) throw Error('Assistant checkpoint belongs to a different story.');
  if (new TextEncoder().encode(JSON.stringify(data)).byteLength > 5 * 1024 * 1024) throw new Error('Story metadata exceeds the 5 MB limit. Keep a backup before reducing history.');
  if (data.draft?.anchorSceneId && !project.scenes[data.draft.anchorSceneId]) throw new Error('Draft continuation anchor is missing.');
  const refs = new Map(data.references.map((item) => [item.id, item]));
  if (refs.size !== data.references.length || !unique(data.bindings.map((item) => ownerKey(item.owner)))
    || !unique(data.sessions.map((item) => item.id))) throw new Error('Duplicate story-workflow identity.');
  if (!data.briefs.every((brief, index) => brief.version === index + 1)) throw new Error('Brief versions must be contiguous.');
  if (data.reviewSessionId && !data.sessions.some((item) => item.id === data.reviewSessionId)) throw Error('Saved draft review refers to a missing session.');
  for (const reference of data.references) {
    if (project.visualPreproduction?.references[reference.id]) throw new Error('Reference ID conflicts with an existing scene reference.');
  }
  for (const binding of data.bindings) {
    if (!storyOwnerExists(project, binding.owner)) throw new Error('Reference binding owner is missing.');
    for (const rule of binding.rules) {
      if (!refs.has(rule.referenceId) || (rule.action === 'replace' && (!refs.has(rule.replacementId) || rule.replacementId === rule.referenceId))) {
        throw new Error('Reference rule has a missing or invalid target.');
      }
    }
    // Validate semantic targets as well as the existence of library IDs.
    resolveStoryReferences({ ...project, storyWorkflow: data }, binding.owner);
  }
  for (const item of data.sessions) {
    const brief = data.briefs[item.source.briefVersion - 1];
    if (!brief || brief.mode !== item.mode || item.source.bindingRevision > data.bindingRevision) throw new Error('Session has invalid brief or binding provenance.');
    for (const used of item.source.references) if (!refs.get(used.id)?.versions[used.version - 1]) throw new Error('Session references missing historical content.');
    if (item.anchorSceneId && !project.scenes[item.anchorSceneId] && item.stage !== 'stale') throw new Error('Session anchor is missing.');
    if (item.accepted.some((mapping) => !item.proposals.some((proposal) => proposal.id === mapping.proposalId))) throw new Error('Acceptance refers to a missing proposal.');
    if (item.revision) {
      const parentIndex = data.sessions.findIndex((parent) => parent.id === item.revision!.sourceSessionId);
      if (parentIndex < 0 || parentIndex >= data.sessions.indexOf(item)) throw Error('Revision lineage must refer to an earlier saved session.');
      const parent = data.sessions[parentIndex];
      if (item.revision.selectedProposalIds.some((id) => !parent.proposals.some((proposal) => proposal.id === id))) throw Error('Revision lineage targets a missing proposal.');
    }
    for (const mapping of item.accepted) if (mapping.allocationSeconds !== undefined
      && mapping.allocationSeconds !== item.proposals.find((proposal) => proposal.id === mapping.proposalId)?.durationSeconds) {
      throw Error('Accepted allocation does not match its immutable proposal.');
    }
  }
  for (const allocation of data.allocations ?? []) if (allocation.source === 'story-proposal') {
    const source = data.sessions.find((session) => session.id === allocation.sessionId);
    const mapping = source?.accepted.find((item) => item.sceneId === allocation.sceneId && item.proposalId === allocation.proposalId);
    if (!mapping || source?.proposals.find((item) => item.id === allocation.proposalId)?.durationSeconds !== allocation.durationSeconds) {
      throw Error('Scene allocation has invalid proposal provenance.');
    }
  }
  return data;
}

/** Inheritance is explicit; legacy scene references remain in their existing path. */
export function resolveStoryReferences(project: CinemaProjectData, target: StoryReferenceOwner) {
  if (!storyOwnerExists(project, target)) throw new Error('Reference target is missing.');
  const data = project.storyWorkflow ?? emptyStoryWorkflow();
  const chain: StoryReferenceOwner[] = [{ kind: 'story', id: project.projectId }];
  if (target.kind === 'scene') chain.push(target);
  if (target.kind === 'shot') chain.push({ kind: 'scene', id: project.shots[target.id].sceneId }, target);
  const result = new Map<string, { referenceId: string; inheritedFrom: StoryReferenceOwner }>();
  for (const ancestor of chain) {
    const rules = data.bindings.find((binding) => ownerKey(binding.owner) === ownerKey(ancestor))?.rules ?? [];
    // Exclusions/replacements refer to inherited IDs, never order-dependent local adds.
    const inherited = new Map(result);
    for (const rule of rules) {
      if (rule.action === 'add') {
        if (inherited.has(rule.referenceId)) throw new Error('Reference is already inherited; reset or exclude it instead.');
      } else {
        if (!inherited.has(rule.referenceId)) throw new Error('Only inherited references can be excluded or replaced.');
        result.delete(rule.referenceId);
      }
    }
    for (const rule of rules) if (rule.action !== 'exclude') {
      const referenceId = rule.action === 'replace' ? rule.replacementId : rule.referenceId;
      if (result.has(referenceId)) throw new Error('A reference is included more than once.');
      result.set(referenceId, { referenceId, inheritedFrom: ancestor });
    }
  }
  return [...result.values()].map((item) => {
    const reference = data.references.find((reference) => reference.id === item.referenceId);
    if (!reference) throw new Error('Bound reference is missing.');
    return { ...item, current: reference.versions[reference.versions.length - 1] };
  });
}

/** Produces a review manifest only; never fetches, loads blobs, or invokes AI. */
export function reviewStoryReferenceTransfer(project: CinemaProjectData, target: StoryReferenceOwner,
  purpose: StoryReferenceUse, limits: { maxImages: number; maxBytes: number; maxNoteCharacters: number }) {
  for (const limit of Object.values(limits)) if (!Number.isSafeInteger(limit) || limit < 0) throw new Error('Reference transfer limits must be finite non-negative integers.');
  const included: ReturnType<typeof resolveStoryReferences> = [];
  const excluded: Array<{ referenceId: string; reason: string }> = [];
  for (const item of resolveStoryReferences(project, target)) {
    const value = item.current;
    const reason = value.archived ? 'Archived' : value.approval !== 'approved' ? 'Not approved'
      : value.rights === 'unknown' ? 'Rights unknown' : !value.allowedUses.includes(purpose) ? `Not permitted for ${purpose}` : null;
    if (reason) excluded.push({ referenceId: item.referenceId, reason }); else included.push(item);
  }
  const images = included.filter((item) => item.current.content.kind === 'image');
  const bytes = images.reduce((sum, item) => sum + (item.current.content.kind === 'image' ? item.current.content.byteSize : 0), 0);
  const noteCharacters = included.reduce((sum, item) => sum + (item.current.content.kind === 'note' ? item.current.content.text.length : 0), 0);
  const blockers = [];
  if (images.length > limits.maxImages) blockers.push('Reduce the number of reference images.');
  if (bytes > limits.maxBytes) blockers.push('Reduce the total reference image bytes.');
  if (noteCharacters > limits.maxNoteCharacters) blockers.push('Reduce the total reference note length.');
  return { included, excluded, blockers, ready: blockers.length === 0, bytes, noteCharacters };
}

export function storySourceIsStale(project: CinemaProjectData, source: StorySourceSnapshot, currentSourceDigest: string) {
  const data = project.storyWorkflow;
  return !data || source.sourceDigest !== currentSourceDigest || source.bindingRevision !== data.bindingRevision
    || source.briefVersion !== data.briefs.at(-1)?.version
    || source.references.some((used) => {
      const current = data.references.find((item) => item.id === used.id)?.versions.at(-1);
      return !current || current.version !== used.version || current.archived || current.approval !== 'approved';
    });
}

/** Derived warnings leave accepted results and their source snapshots untouched. */
export function affectedStorySessions(project: CinemaProjectData, currentSourceDigest: string): string[] {
  return (project.storyWorkflow?.sessions ?? []).filter((session) =>
    storySourceIsStale(project, session.source, currentSourceDigest)).map((session) => session.id);
}

/** Compare-and-swap at the domain boundary; storage still needs cross-tab locking. */
export function updateStoryWorkflow(project: CinemaProjectData, expectedRevision: number,
  change: (draft: StoryWorkflowData) => void): CinemaProjectData {
  const current = project.storyWorkflow ?? emptyStoryWorkflow();
  if (current.revision !== expectedRevision) throw new Error('Story data changed; reload and review your edit.');
  const next = structuredClone(current);
  change(next);
  next.revision = current.revision + 1;
  next.bindingRevision = canonicalRequest(next.bindings) === canonicalRequest(current.bindings) ? current.bindingRevision : current.bindingRevision + 1;
  if (current.references.some((reference, index) => next.references[index]?.id !== reference.id)) {
    throw new Error('Reference library identity/order is immutable. Archive references instead of deleting or reordering them.');
  }
  // Old reference/brief versions are immutable, including archived content.
  for (const old of current.references) {
    const revised = next.references.find((item) => item.id === old.id);
    if (!revised || canonicalRequest(revised.versions.slice(0, old.versions.length)) !== canonicalRequest(old.versions)) throw new Error('Historical reference versions cannot be removed or edited.');
  }
  for (const reference of next.references) {
    const oldCount = current.references.find((item) => item.id === reference.id)?.versions.length ?? 0;
    for (let index = Math.max(1, oldCount); index < reference.versions.length; index++) {
      if (canonicalRequest(reference.versions[index].content) !== canonicalRequest(reference.versions[index - 1].content)) reference.versions[index].approval = 'pending';
    }
  }
  if (canonicalRequest(next.briefs.slice(0, current.briefs.length)) !== canonicalRequest(current.briefs)) throw new Error('Historical brief versions cannot be removed or edited.');
  for (const old of current.sessions.filter((item) => item.revision)) {
    const updated = next.sessions.find((item) => item.id === old.id);
    const input = (value: NonNullable<typeof old.revision>) => ({ instruction: value.instruction, sourceSessionId: value.sourceSessionId,
      sourceOperationId: value.sourceOperationId, selectedProposalIds: value.selectedProposalIds, sourceVersion: value.sourceVersion, requestedAt: value.requestedAt });
    if (!updated?.revision || canonicalRequest(input(updated.revision)) !== canonicalRequest(input(old.revision!))) throw Error('Saved revision instructions and scope are immutable.');
    if (old.revision!.status === 'completed' && canonicalRequest(updated.revision) !== canonicalRequest(old.revision)) throw Error('Completed revision provenance is immutable.');
  }
  for (const added of next.sessions.filter((item) => item.revision && !current.sessions.some((old) => old.id === item.id))) {
    const parent = current.sessions.find((item) => item.id === added.revision!.sourceSessionId);
    if (parent?.accepted.some((item) => added.revision!.selectedProposalIds.includes(item.proposalId))) throw Error('Accepted proposals cannot become revision targets.');
  }
  for (const old of current.sessions.filter((session) => session.accepted.length)) {
    const updated = next.sessions.find((session) => session.id === old.id);
    if (!updated || canonicalRequest(updated.source) !== canonicalRequest(old.source)
      || canonicalRequest(updated.accepted.slice(0, old.accepted.length)) !== canonicalRequest(old.accepted)) throw new Error('Accepted provenance cannot be removed or rewritten.');
    for (const mapping of old.accepted) if (canonicalRequest(updated.proposals.find((item) => item.id === mapping.proposalId))
      !== canonicalRequest(old.proposals.find((item) => item.id === mapping.proposalId))) throw new Error('Accepted scene proposals cannot be rewritten.');
  }
  return { ...project, schemaVersion: 3, storyWorkflow: validateStoryWorkflow(next, project) };
}

export function reviseStoryReference(project: CinemaProjectData, expectedRevision: number, referenceId: string,
  changes: Partial<Omit<StoryReferenceVersion, 'version'>>): CinemaProjectData {
  return updateStoryWorkflow(project, expectedRevision, (draft) => {
    const reference = draft.references.find((item) => item.id === referenceId);
    if (!reference) throw new Error('Reference not found.');
    const previous = reference.versions[reference.versions.length - 1];
    const next = { ...previous, ...changes, version: previous.version + 1 };
    if (canonicalRequest(next.content) !== canonicalRequest(previous.content)) next.approval = 'pending';
    reference.versions.push(next);
  });
}

/** Remove dangling live bindings after scene/shot deletion; preserve provenance. */
export function reconcileStoryWorkflow(project: CinemaProjectData): CinemaProjectData {
  if (!project.storyWorkflow) return project;
  const next = structuredClone(project.storyWorkflow);
  if (next.draft?.anchorSceneId && !project.scenes[next.draft.anchorSceneId]) next.draft.anchorSceneId = null;
  next.bindings = next.bindings.filter((binding) => storyOwnerExists(project, binding.owner));
  if (next.bindings.length !== project.storyWorkflow.bindings.length) next.bindingRevision++;
  for (const item of next.sessions) if (item.anchorSceneId && !project.scenes[item.anchorSceneId]) item.stage = 'stale';
  if (canonicalRequest(next) !== canonicalRequest(project.storyWorkflow)) next.revision++;
  return { ...project, schemaVersion: 3, storyWorkflow: next };
}
