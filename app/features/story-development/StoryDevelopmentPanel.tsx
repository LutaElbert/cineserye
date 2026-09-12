'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useScopedConfirmation } from '../../components/useScopedConfirmation';
import { requestDigest, canonicalRequest } from '../../domain/cinema/request-digest';
import { StoryCreativeBriefSchema, resolveStoryReferences, reviewStoryReferenceTransfer, storySourceIsStale, storyReviewSession,
  type StoryReferenceOwner, type StoryReferenceVersion, type StoryWorkflowData } from '../../domain/cinema/story-workflow';
import { changeStory, storyContextDigest, storySessionContextDigest, storyAllocationReview, storySceneContext, storyPremise, acceptStoryScenes, acceptStoryConcept, commitReviewedStoryDocument, assertStoryEditable, unresolvedStoryOperation } from '../../editor/story-development-commands';
import { loadLocalMediaBlob, saveLocalMediaBlob } from '../../editor/persistence';
import { validateImageFile, fileToDataUrl } from '../../editor/image-file';
import type { EditorDocument } from '../../editor/types';
import { syncPremiseDraft } from '../../editor/layer-editing';
import { initialPremiseDraft } from '../../editor/premise-draft';
import { StoryQuoteSchema, StoryResultSchema, storyApprovalContent, type StoryInput, type StoryQuote } from './contracts';
import { readStoryStream } from './story-stream-client';
import { InlineDiscardButton } from '../../editor/InlineDiscardButton';
import { resolvePromptReferenceMentions } from './prompt-composer-model';
import { AssistantSceneStage } from './AssistantSceneStage';
import { SceneAllocationCorrection } from './SceneAllocationCorrection';
import type { OperationProgress } from '../../domain/cinema/generation-operation';
import { assistantSourceIdentity } from './useStoryAssistant';
import { AssistantDirectionStage } from './AssistantDirectionStage';
import { ensureClientOperation, observeClientOperation } from '../simplified-flow/operation-journal';

type Draft = NonNullable<StoryWorkflowData['draft']>;
const initialDraft = initialPremiseDraft;
const allUses: StoryReferenceVersion['allowedUses'] = ['research', 'story-development', 'shot-planning', 'image-generation', 'video-generation'];
const refLimits = { maxImages: 8, maxBytes: 12 * 1024 * 1024, maxNoteCharacters: 20_000 };
function storyJournalOwner(projectId: string, session: Pick<StoryWorkflowData['sessions'][number], 'mode' | 'anchorSceneId' | 'source'>) {
  return { projectId, kind: 'story-plan' as const, scopeKey: `${session.mode}:${session.anchorSceneId ?? 'story'}:${session.source.briefVersion}` };
}
export function assertDirectionEditable(document: EditorDocument) {
  assertStoryEditable(document);
}
export function StoryReferencePreview({ hash, title }: { hash: string; title: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => { let live = true; let value = ''; void loadLocalMediaBlob(hash).then((media) => {
    if (live && media) { value = URL.createObjectURL(media.blob); setUrl(value); }
  }).catch(() => { /* Keep the explicit unavailable state; never fetch remotely. */ }); return () => { live = false; if (value) URL.revokeObjectURL(value); }; }, [hash]);
  return url ? <Image unoptimized src={url} alt={title} width={100} height={70} /> : <span>Image unavailable — restore a complete backup.</span>;
}

export function StoryDevelopmentPanel({ open, document: current, getDocument, commit, flush, onClose, owner: initialOwner, embedded = false, referencesOnly = false, planningOnly = false, directionOnly = false, onDirectionApproved, onAccepted, providerMode = 'loading', onReviseDirection }: {
  open: boolean; document: EditorDocument; getDocument: () => EditorDocument;
  commit: (document: EditorDocument, history?: boolean) => void; flush: () => Promise<unknown>; onClose: () => void; owner: StoryReferenceOwner; embedded?: boolean; referencesOnly?: boolean; planningOnly?: boolean; onAccepted?: (sceneIds?: string[]) => void;
  providerMode?: 'fixture' | 'live' | 'loading'; onReviseDirection?: () => void; directionOnly?: boolean; onDirectionApproved?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const controller = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const quoteRequest = useRef(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // Feature quotes cannot replace unknown workspace discovery with their own mode.
  const mode = providerMode;
  const committedMode = useRef(mode);
  useLayoutEffect(() => {
    committedMode.current = mode;
    // Invalidate even before passive effects run. An async approval callback
    // may resume with an older render's closure after the workspace changes.
    quoteRequest.current++;
  }, [mode]);
  const [progress, setProgress] = useState<OperationProgress[]>([]);
  const [count, setCount] = useState(3);
  const [storedQuote, setQuote] = useState<{ value: StoryQuote; scope: string } | null>(null);
  const [owner, setOwner] = useState(initialOwner);
  const [note, setNote] = useState('');
  const [refTitle, setRefTitle] = useState('');
  const [editingReference, setEditingReference] = useState<string | null>(null);
  const [replaceInherited, setReplaceInherited] = useState('');
  const [category, setCategory] = useState<StoryReferenceVersion['category']>('style');
  const [rights, setRights] = useState<StoryReferenceVersion['rights']>('unknown');
  const [approved, setApproved] = useState(false);
  const [uses, setUses] = useState<StoryReferenceVersion['allowedUses']>([]);
  const [review, setReview] = useState(false);
  const [digest, setDigest] = useState('');
  const [reviewDigest, setReviewDigest] = useState('');
  const project = current.cinema!;
  const workflow = project.storyWorkflow;
  const draft = workflow?.draft ?? initialDraft(current);
  const premiseLocked = Boolean(current.nodes.find((node) => node.id === storyPremise(current)?.nodeId)?.data.locked);
  const savedSession = storyReviewSession(workflow);
  const unresolved = unresolvedStoryOperation(workflow);
  // A freshly confirmed direction starts a new outline; older drafts remain in history.
  const session = planningOnly && !workflow?.reviewSessionId && savedSession?.source.briefVersion !== workflow?.briefs.at(-1)?.version ? undefined : savedSession;
  const brief = planningOnly && session ? workflow?.briefs[session.source.briefVersion - 1] : workflow?.briefs.at(-1);
  const briefVersion = brief?.version;
  const quoteScope = canonicalRequest({ projectId: project.projectId, briefVersion, mode });
  const committedQuoteScope = useRef(quoteScope);
  useLayoutEffect(() => { committedQuoteScope.current = quoteScope; quoteRequest.current++; }, [quoteScope]);
  const quote = storedQuote?.scope === quoteScope && storedQuote.value.mode === mode ? storedQuote.value : null;
  const quoteReady = !!quote?.ready;
  const effectiveOwner = owner.kind === 'story' ? { kind: 'story' as const, id: project.projectId }
    : (owner.kind === 'scene' ? project.scenes[owner.id] : project.shots[owner.id]) ? owner : { kind: 'story' as const, id: project.projectId };
  const effective = resolveStoryReferences(project, effectiveOwner);
  const manifest = reviewStoryReferenceTransfer(project, { kind: 'story', id: project.projectId }, 'story-development', refLimits);
  const inputIdentity = canonicalRequest({ draft, count, mode, brief, references: manifest, context: digest,
    revisionScope: session?.proposals });
  const [consent, setConsent] = useScopedConfirmation(`${inputIdentity}:${quote?.quoteId ?? ''}`);
  const currentApproval = useRef({ quote, consent, count });
  useLayoutEffect(() => { currentApproval.current = { quote, consent, count }; }, [quote, consent, count]);
  const [partial, setPartial] = useScopedConfirmation(canonicalRequest({ id: session?.id, proposals: session?.proposals }));
  const stale = session?.stage === 'stale' || !!session && !!reviewDigest && storySourceIsStale(project, session.source, reviewDigest);
  const approvedDirection = !!brief && brief.status === 'approved' && brief.sourceDigest === (session?.accepted.length ? reviewDigest : digest)
    && brief.mode === draft.mode && brief.premise === draft.premise && brief.aspectRatio === draft.aspectRatio
    && brief.durationSeconds === draft.durationSeconds && brief.tone === draft.tone && brief.ending === draft.ending
    && canonicalRequest(brief.genres ?? []) === canonicalRequest(draft.genres ?? [])
    && canonicalRequest(brief.constraints) === canonicalRequest(draft.constraints) && canonicalRequest(brief.answers) === canonicalRequest(draft.answers);

  useEffect(() => {
    let active = true;
    if (open) { opener.current = window.document.activeElement as HTMLElement; if (!embedded) dialog.current?.showModal(); queueMicrotask(() => { if (active) setOwner({ kind: initialOwner.kind, id: initialOwner.id }); }); }
    else dialog.current?.close();
    return () => { active = false; };
  }, [open, initialOwner.id, initialOwner.kind, embedded]); // Modal semantics/focus trapping are native.
  useEffect(() => { let active = true; void storyContextDigest(current).then((value) => { if (active) setDigest(value); }); return () => { active = false; }; }, [current]);
  useEffect(() => {
    let active = true;
    const currentSession = storyReviewSession(current.cinema?.storyWorkflow);
    void (currentSession ? storySessionContextDigest(current, currentSession.id) : storyContextDigest(current)).then((value) => { if (active) setReviewDigest(value); });
    return () => { active = false; };
  }, [current]);
  useEffect(() => () => { controller.current?.abort(); quoteRequest.current++; }, []);
  const act = (fn: () => void) => { try { fn(); setError(''); } catch (error) { setError((error as Error).message); } };
  const mutate = (change: (data: StoryWorkflowData) => void, history = true) => commit(changeStory(getDocument(), change), history);
  const updateDraft = (patch: Partial<Draft>) => act(() => {
    assertDirectionEditable(getDocument());
    let next = changeStory(getDocument(), (data) => { data.draft = { ...(data.draft ?? initialDraft(getDocument())), ...patch }; });
    if (patch.premise !== undefined) next = syncPremiseDraft(next, patch.premise);
    commit(next, false);
    setReview(false); setConsent(false);
  });
  const close = () => { onClose(); requestAnimationFrame(() => opener.current?.focus()); };
  const refreshQuote = async () => {
    const requestedMode = committedMode.current;
    if (requestedMode === 'loading') return;
    const scope = committedQuoteScope.current;
    const request = ++quoteRequest.current;
    setConsent(false); setQuote(null);
    try {
      const response = await fetch(`/api/cinema/develop-story?mode=${requestedMode}`);
      if (!response.ok) throw Error('Provider status is unavailable.');
      const value = StoryQuoteSchema.parse(await response.json());
      if (request !== quoteRequest.current || requestedMode !== committedMode.current) return;
      if (value.mode !== requestedMode) throw Error('Provider estimate does not match the workspace mode. Refresh the estimate.');
      setQuote({ value, scope });
    } catch (error) { if (request === quoteRequest.current) setError((error as Error).message); }
  };
  useEffect(() => {
    if (!briefVersion || referencesOnly || mode === 'loading') return;
    let active = true; const request = ++quoteRequest.current;
    queueMicrotask(() => { if (active && request === quoteRequest.current) setQuote(null); });
    void fetch(`/api/cinema/develop-story?mode=${mode}`).then(async (response) => {
      if (!response.ok) throw Error('Provider estimate unavailable.');
      const value = StoryQuoteSchema.parse(await response.json());
      if (value.mode !== mode) throw Error('Provider estimate does not match the workspace mode. Refresh the estimate.');
      if (active && request === quoteRequest.current && mode === committedMode.current) setQuote({ value, scope: quoteScope });
    }).catch((error) => { if (active && request === quoteRequest.current) setError((error as Error).message); });
    return () => { active = false; };
  }, [mode, briefVersion, referencesOnly, quoteScope]);
  const resetRefForm = () => { setEditingReference(null); setRefTitle(''); setNote(''); setApproved(false); setUses([]); setRights('unknown'); setReplaceInherited(''); };
  const writeReference = (content: StoryReferenceVersion['content']) => {
    const source = getDocument();
    if (!source.cinema || source.cinema.projectId !== project.projectId) throw Error('The project changed. Reopen references.');
    mutate((data) => {
      const existing = editingReference ? data.references.find((item) => item.id === editingReference) : null;
      const value: StoryReferenceVersion = { version: existing ? existing.versions.length + 1 : 1,
        title: refTitle.trim() || 'Untitled reference', category, content, provenance: 'Added locally by the creator',
        rights, approval: approved ? 'approved' : 'pending', allowedUses: uses, archived: false };
      if (existing) existing.versions.push(value);
      else {
        const id = crypto.randomUUID(); data.references.push({ id, versions: [value] });
        let binding = data.bindings.find((item) => item.owner.kind === owner.kind && item.owner.id === owner.id);
        if (!binding) { binding = { owner, rules: [] }; data.bindings.push(binding); }
        binding.rules.push(replaceInherited ? { action: 'replace', referenceId: replaceInherited, replacementId: id } : { action: 'add', referenceId: id });
      }
    });
    resetRefForm(); setNotice('Reference added to the local draft; saving…');
    void flush().then(() => setNotice('Reference saved locally. Changed content requires fresh approval; no AI was called.')).catch(() => setError('Reference is still unsaved. Keep this tab open and retry a backup or local save.'));
  };
  const upload = async (file: File) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try {
      assertDirectionEditable(getDocument());
      const image = await validateImageFile(file);
      const media = await saveLocalMediaBlob(file, { mimeType: image.type, width: image.width, height: image.height });
      writeReference({ kind: 'image', blobHash: media.hash, mimeType: image.type, width: image.width, height: image.height, byteSize: file.size });
      await flush();
    } catch (error) { setError((error as Error).message); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const approveBrief = async () => {
    try {
      assertDirectionEditable(getDocument());
      if (draft.mode !== 'surprise' && !draft.premise.trim()) throw Error('Write your premise or choose Surprise me.');
      if (!draft.aspectRatio || !draft.durationSeconds || !draft.tone.trim()) throw Error('Complete format, duration and tone before reviewing.');
      if (draft.mode === 'continue' && !draft.anchorSceneId) throw Error('Choose an existing scene to continue after.');
      const approvalSource = getDocument();
      const sourceDigest = await storyContextDigest(approvalSource);
      if (canonicalRequest({ ...approvalSource, updatedAt: 0 }) !== canonicalRequest({ ...getDocument(), updatedAt: 0 })) throw Error('The draft changed during review. Review the updated direction.');
      const value = StoryCreativeBriefSchema.parse({ version: (workflow?.briefs.length ?? 0) + 1, mode: draft.mode, sourceDigest,
        premise: draft.premise, aspectRatio: draft.aspectRatio, platform: draft.answers.find((item) => item.id === 'format')?.values[0] ?? 'short-form',
        durationSeconds: draft.durationSeconds, durationScope: draft.mode === 'continue' ? 'new-material' : 'whole-story',
        tone: draft.tone, genres: draft.genres, ending: draft.ending, constraints: draft.constraints, assumptions: draft.ending ? [] : ['Ending is open for proposal.'], status: 'approved', answers: draft.answers });
      let next = changeStory(approvalSource, (data) => {
        data.draft = draft; data.briefs.push(value); data.reviewSessionId = null;
        if (data.assistant) { data.assistant.state = 'confirmed'; data.assistant.confirmedBriefVersion = value.version; data.assistant.error = null; }
      });
      const assistantDigest = await requestDigest(assistantSourceIdentity(next));
      if (canonicalRequest({ ...approvalSource, updatedAt: 0 }) !== canonicalRequest({ ...getDocument(), updatedAt: 0 })) throw Error('The draft changed during review. Review the updated direction.');
      next = changeStory(next, (data) => { if (data.assistant) data.assistant.sourceDigest = assistantDigest; });
      commit(next);
      await flush(); setReview(true); setNotice('Direction approved locally. Generation needs separate approval.'); onDirectionApproved?.(); await refreshQuote();
    } catch (error) { setError((error as Error).message); }
  };
  const generate = async (revise = false, requestApproved = false, instruction = '') => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(''); setProgress([]);
    let sessionId = ''; let captured = ''; let originalProject = ''; let rejectedBeforeDispatch = false; let dispatched = false; let journalRecorded = false;
    const estimateRequest = quoteRequest.current;
    const assertCurrentApproval = (checkConsent: boolean) => {
      if (mode !== committedMode.current || estimateRequest !== quoteRequest.current
        || !quote || currentApproval.current.quote !== quote || currentApproval.current.count !== count
        || (checkConsent && !requestApproved && !currentApproval.current.consent)) {
        throw Error('The workspace mode, estimate or approval changed. Review again before generating.');
      }
    };
    try {
      const requestController = new AbortController(); controller.current = requestController;
      const source = getDocument(); originalProject = source.cinema!.projectId;
      assertDirectionEditable(source);
      if (unresolvedStoryOperation(source.cinema?.storyWorkflow)) throw Error('Check the existing Story request before starting another. Its outcome is not yet known.');
      captured = revise && session ? await storySessionContextDigest(source, session.id) : await storyContextDigest(source);
      const activeBrief = source.cinema!.storyWorkflow?.briefs.at(-1);
      if (mode === 'loading' || !activeBrief || !approvedDirection || !(consent || requestApproved) || !quote || !quoteReady || activeBrief.sourceDigest !== captured) throw Error('Review current direction, content and estimate before generating.');
      assertCurrentApproval(true);
      const allocation = storyAllocationReview(source, activeBrief, revise ? session?.id : undefined);
      if (allocation.blockers.length) throw Error(allocation.blockers.join(' '));
      const acceptedIds = new Set(session?.accepted.map((item) => item.proposalId) ?? []);
      const revised = revise ? session?.proposals.filter((item) => item.selected && !acceptedIds.has(item.id)) ?? [] : [];
      const currentManifest = reviewStoryReferenceTransfer(source.cinema!, { kind: 'story', id: originalProject }, 'story-development', refLimits);
      if (!currentManifest.ready) throw Error(currentManifest.blockers.join(' '));
      const references: StoryInput['references'] = [];
      for (const item of currentManifest.included) {
        const ref = item.current;
        let content: StoryInput['references'][number]['content'];
        if (ref.content.kind === 'note') content = ref.content;
        else {
          const media = await loadLocalMediaBlob(ref.content.blobHash); if (!media) throw Error(`Missing image: ${ref.title}.`);
          content = { kind: 'image', mimeType: ref.content.mimeType, base64: (await fileToDataUrl(new File([media.blob], ref.title, { type: media.mimeType }))).split(',')[1] };
        }
        references.push({ id: item.referenceId, version: ref.version, title: ref.title, rights: ref.rights as 'creator-owned' | 'licensed' | 'public-domain', approval: 'approved', allowedUses: ref.allowedUses, content });
      }
      const input: StoryInput = { version: 1, projectId: originalProject, brief: activeBrief, count: revise ? revised.length : count,
        context: storySceneContext(source),
        anchorSceneId: draft.mode === 'continue' ? draft.anchorSceneId : null, references,
        referenceMentions: resolvePromptReferenceMentions(activeBrief.premise, source.cinema?.storyWorkflow, references.map((item) => item.id)),
        revise: revised,
        allocation: { scope: activeBrief.durationScope, targetSeconds: activeBrief.durationSeconds, existingSeconds: allocation.existingSeconds,
          newSeconds: revise ? revised.reduce((sum, item) => sum + item.durationSeconds, 0) : allocation.remainingSeconds! },
        ...(revise && session && instruction.trim() ? { revision: { instruction: instruction.trim(), sourceSessionId: session.operationId ?? session.id,
          sourceVersion: session.outlineVersion ?? session.proposalVersion ?? 1, selectedProposalIds: revised.map((item) => item.id),
          untouchedProposals: session.proposals.filter((item) => !revised.some((selected) => selected.id === item.id)) } } : {}) };
      if (revise && !input.revise.length) throw Error('Select proposals to regenerate.');
      const approval = await requestDigest(storyApprovalContent(input, quote.quoteId));
      requestController.signal.throwIfAborted();
      // No async work may silently widen the approved source before dispatch.
      const checkedSource = getDocument();
      const checkedDigest = await (revise && session ? storySessionContextDigest(checkedSource, session.id) : storyContextDigest(checkedSource));
      if (captured !== checkedDigest || source.cinema?.projectId !== getDocument().cinema?.projectId
        || canonicalRequest(source.cinema?.storyWorkflow) !== canonicalRequest(getDocument().cinema?.storyWorkflow)
        || canonicalRequest({ ...checkedSource, updatedAt: 0 }) !== canonicalRequest({ ...getDocument(), updatedAt: 0 })) {
        throw Error('Source changed while preparing references. Review again.');
      }
      assertCurrentApproval(true);
      sessionId = crypto.randomUUID();
      mutate((data) => { data.sessions.push({ id: sessionId, operationId: sessionId, mode: draft.mode, anchorSceneId: input.anchorSceneId,
        stage: 'running', source: { sourceDigest: captured, briefVersion: activeBrief.version, bindingRevision: data.bindingRevision,
          references: references.map((item) => ({ id: item.id, version: item.version })) }, proposals: revise && session ? structuredClone(session.proposals) : [],
          accepted: revise && session ? structuredClone(session.accepted) : [], presentation: 'scene-review', proposalVersion: session?.proposalVersion ?? 1,
          ...(input.revision && session ? { revision: { instruction: input.revision.instruction, sourceSessionId: session.id,
            sourceOperationId: input.revision.sourceSessionId, selectedProposalIds: input.revision.selectedProposalIds,
            sourceVersion: input.revision.sourceVersion, resultVersion: null, status: 'running' as const,
            requestedAt: new Date().toISOString(), resolvedAt: null } } : {}), error: null }); data.reviewSessionId = null; });
      const prepared = getDocument();
      const preparedWorkflow = canonicalRequest(prepared.cinema?.storyWorkflow);
      await flush();
      requestController.signal.throwIfAborted();
      const dispatchSource = getDocument();
      if (dispatchSource.cinema?.projectId !== originalProject || preparedWorkflow !== canonicalRequest(dispatchSource.cinema?.storyWorkflow)
        || captured !== await storySessionContextDigest(dispatchSource, sessionId)
        || canonicalRequest({ ...dispatchSource, updatedAt: 0 }) !== canonicalRequest({ ...getDocument(), updatedAt: 0 })) {
        throw Error('Source changed while saving the request. Review again.');
      }
      // The running record can reset the presentation's consent scope. Its
      // creation is ours; mode/estimate/source changes are never ours to approve.
      assertCurrentApproval(false);
      requestController.signal.throwIfAborted();
      assertDirectionEditable(getDocument());
      const persistedSession = getDocument().cinema?.storyWorkflow?.sessions.find((item) => item.id === sessionId);
      if (!persistedSession) throw Error('The saved Story request is unavailable. No provider request was started.');
      const journalOwner = storyJournalOwner(originalProject, persistedSession);
      ensureClientOperation({ id: sessionId, ...journalOwner, sourceFingerprint: approval,
        provider: mode === 'fixture' ? 'cineserye-story-fixture' : 'configured-story-provider', model: quote.model, estimateUsd: quote.cost },
      { phase: 'intent', dispatchCertainty: 'not-dispatched' });
      journalRecorded = true;
      observeClientOperation(sessionId, journalOwner, { phase: 'dispatched', dispatchCertainty: 'may-have-dispatched' });
      dispatched = true;
      const response = await fetch('/api/cinema/develop-story', { method: 'POST', headers: { 'content-type': 'application/json', ...(planningOnly ? { accept: 'text/event-stream' } : {}) }, signal: requestController.signal,
        body: JSON.stringify({ mode, operationId: sessionId, input, consent: true, quoteId: quote.quoteId, contentDigest: approval }) });
      // This endpoint's streaming path returns JSON 400 only before creating its
      // event stream/dispatch. Transport failures and stream errors stay unknown.
      if (planningOnly && response.status === 400 && response.headers.get('content-type')?.includes('application/json')) {
        const rejection = await response.json() as { ok?: boolean; error?: unknown };
        if (rejection.ok === false && typeof rejection.error === 'string') { rejectedBeforeDispatch = true; throw Error(rejection.error); }
        throw Error('The request did not return a verifiable planning result.');
      }
      const result = planningOnly ? { ok: true, result: await readStoryStream(response, originalProject, sessionId, (step) => setProgress((steps) => [...steps.filter((item) => item.step !== step.step), step])), error: undefined }
        : await response.json() as { ok?: boolean; error?: string; result?: unknown };
      if (!response.ok || !result.ok) throw Error(result.error || 'Generation returned no usable proposal.');
      requestController.signal.throwIfAborted();
      if (getDocument().cinema?.projectId !== originalProject) return;
      const parsed = StoryResultSchema.parse(result.result);
      const currentDigest = await storySessionContextDigest(getDocument(), sessionId);
      mutate((data) => {
        const target = data.sessions.find((item) => item.id === sessionId);
        if (!target || target.stage !== 'running') return;
        target.proposals = revise && session ? session.proposals.map((item) => parsed.proposals.find((next) => next.id === item.id) ?? item) : parsed.proposals;
        target.proposalVersion = parsed.outlineVersion ?? (revise ? (session?.proposalVersion ?? 1) + 1 : 1);
        target.outlineVersion = parsed.outlineVersion ?? target.proposalVersion;
        target.provenance = parsed.provenance;
        if (target.revision && target.revision.status !== 'completed') { target.revision.status = 'completed'; target.revision.resultVersion = target.outlineVersion;
          target.revision.resolvedAt = new Date().toISOString(); target.revision.provenance = parsed.provenance; }
        target.stage = storySourceIsStale(getDocument().cinema!, target.source, currentDigest) ? 'stale' : 'proposal-review';
      }); await flush();
      observeClientOperation(sessionId, journalOwner, { phase: 'awaiting-review', dispatchCertainty: 'completed', lastError: null,
        completedUnits: parsed.proposals.length, totalUnits: parsed.proposals.length });
      setNotice(mode === 'fixture' ? 'Sample proposals ready. No AI or paid calls.' : 'Proposals ready for review; nothing was inserted.');
    } catch (error) {
      rejectedBeforeDispatch ||= !dispatched;
      const message = (error as Error).message; setError(message); setNotice('');
      if (sessionId && getDocument().cinema?.projectId === originalProject) {
        try { mutate((data) => {
          const target = data.sessions.find((item) => item.id === sessionId); if (!target || !['running', 'cancelled'].includes(target.stage)) return;
          target.error = message;
          if (target.stage === 'cancelled' && !rejectedBeforeDispatch) return;
          if (target.revision) { target.revision.status = rejectedBeforeDispatch ? 'rejected' : 'outcome-unknown';
            target.revision.resolvedAt = rejectedBeforeDispatch ? new Date().toISOString() : null; }
          if (rejectedBeforeDispatch && revise && session) {
            // Preserve the untouched local review and its durable parent identity.
            // A rejected attempt has no saved provider outline to revise/recover.
            target.stage = 'proposal-review'; target.operationId = session.operationId ?? session.id;
            target.outlineVersion = session.outlineVersion; target.proposalVersion = session.proposalVersion;
            target.provenance = session.provenance;
          } else target.stage = rejectedBeforeDispatch ? 'failed' : 'outcome-unknown';
        }); } catch (stateError) { setError(`${message} Local state could not be updated: ${(stateError as Error).message}`); }
      }
      if (journalRecorded) {
        const persistedSession = getDocument().cinema?.storyWorkflow?.sessions.find((item) => item.id === sessionId);
        if (persistedSession) try { observeClientOperation(sessionId, storyJournalOwner(originalProject, persistedSession), {
          phase: rejectedBeforeDispatch ? 'failed' : 'unknown', dispatchCertainty: rejectedBeforeDispatch ? 'not-dispatched' : 'may-have-dispatched',
          lastError: message, completedUnits: null, totalUnits: null,
        }); } catch { /* Preserve the document fallback for journals created by older clients. */ }
      }
    } finally { controller.current = null; busyRef.current = false; setBusy(false); setConsent(false); }
  };
  const recover = async (targetSession = unresolved ?? session) => {
    if (!targetSession?.operationId) return;
    const id = targetSession.id; const projectId = project.projectId;
    try {
      const response = await fetch(`/api/cinema/develop-story?operationId=${targetSession.operationId}&projectId=${encodeURIComponent(projectId)}`);
      const value = await response.json() as { status?: string; result?: unknown };
      if (!response.ok || value.status !== 'completed') throw Error('No saved result yet; outcome may be unknown. No request was dispatched. Check provider activity before approving a new request.');
      const result = StoryResultSchema.parse(value.result);
      if (getDocument().cinema?.projectId !== projectId) return;
      const currentDigest = await storySessionContextDigest(getDocument(), id);
      if (getDocument().cinema?.projectId !== projectId) return;
      mutate((data) => { const target = data.sessions.find((item) => item.id === id);
        if (!target || target.operationId !== targetSession.operationId || !['running', 'outcome-unknown', 'cancelled'].includes(target.stage)) return;
        target.proposals = target.proposals.length ? target.proposals.map((item) => result.proposals.find((replacement) => replacement.id === item.id) ?? item) : result.proposals;
        target.proposalVersion = result.outlineVersion ?? target.proposalVersion ?? 1;
        target.outlineVersion = result.outlineVersion ?? target.proposalVersion;
        target.provenance = result.provenance;
        if (target.revision && target.revision.status !== 'completed') { target.revision.status = 'completed'; target.revision.resultVersion = target.outlineVersion;
          target.revision.resolvedAt = new Date().toISOString(); target.revision.provenance = result.provenance; }
        target.stage = storySourceIsStale(getDocument().cinema!, target.source, currentDigest) ? 'stale' : 'proposal-review'; });
      try { observeClientOperation(targetSession.operationId, storyJournalOwner(projectId, targetSession), {
        phase: 'awaiting-review', dispatchCertainty: 'completed', lastError: null,
        completedUnits: result.proposals.length, totalUnits: result.proposals.length,
      }); } catch { /* Old saved Story requests predate the independent journal. */ }
    } catch (error) { setError((error as Error).message); }
  };
  const editProposal = (id: string, patch: Partial<NonNullable<typeof session>['proposals'][number]>) => act(() => { assertDirectionEditable(getDocument()); mutate((data) => {
    const item = data.sessions.find((item) => item.id === session?.id); if (item?.stage !== 'proposal-review') throw Error('Only pending proposals can be edited.');
    if (item.accepted.some((accepted) => accepted.proposalId === id)) throw Error('Accepted scenes cannot be edited through their old proposal.');
    Object.assign(item.proposals.find((item) => item.id === id)!, patch);
  }, false); });
  const chooseConcept = async (id: string) => {
    try { assertDirectionEditable(getDocument()); await commitReviewedStoryDocument(getDocument, commit, (document, digest) => acceptStoryConcept(document, session!.id, id, digest)); setReview(false); }
    catch (error) { setError((error as Error).message); }
  };
  const acceptSelected = async () => {
    if (!session || busyRef.current) return;
    try {
      assertDirectionEditable(getDocument());
      const previousIds = new Set(getDocument().nodes.map((node) => node.id));
      await commitReviewedStoryDocument(getDocument, commit, (document, digest) => acceptStoryScenes(document, session.id, digest, partial), session.id);
      await flush(); setNotice('Scenes accepted as one undoable change. No AI call.'); onAccepted?.(getDocument().cinema?.sceneOrder.filter((id) => !previousIds.has(getDocument().cinema!.scenes[id].nodeId)));
    } catch (error) { setError((error as Error).message); }
  };
  const stopRequest = () => {
    controller.current?.abort(); act(() => mutate((data) => { const target = storyReviewSession(data); if (target?.stage === 'running') {
      target.stage = 'cancelled'; if (target.revision) { target.revision.status = 'cancelled'; target.revision.resolvedAt = new Date().toISOString(); }
      if (target.operationId) try { observeClientOperation(target.operationId, storyJournalOwner(project.projectId, target), {
        phase: 'tracking-stopped', dispatchCertainty: 'may-have-dispatched', lastError: 'Local tracking stopped. Provider work or billing may continue.',
      }); } catch { /* Old saved Story requests predate the independent journal. */ }
    } }));
    setNotice('Stopped locally. Dispatched provider work may still be billed; no automatic retry.');
  };
  if (directionOnly && embedded) return <AssistantDirectionStage draft={draft} error={error || (premiseLocked ? 'Unlock the Story premise to change its direction.' : '')} busy={busy || premiseLocked} onChange={updateDraft} onConfirm={() => void approveBrief()} onBack={onClose} />;
  if (planningOnly && embedded) {
    const reviewAllocation = brief ? storyAllocationReview(current, brief, session?.id) : null;
    const labels: Record<OperationProgress['step'], string> = { preparing: 'Preparing approved context', model: mode === 'fixture' ? 'Preparing fixture scene proposals' : 'Drafting scene proposals', validation: 'Validating scene scope and allocation', checkpoint: 'Saving the reviewed outline' };
    return <AssistantSceneStage key={workflow?.reviewSessionId ?? 'current'} session={session} brief={brief} mode={mode} quote={quote} count={count} busy={busy} stale={stale} locked={premiseLocked}
      error={error || session?.error || (unresolved && unresolved.id !== session?.id ? 'Check the existing Story request in generation history before starting another.' : '')} notice={notice} canGenerate={!busy && !unresolved && !premiseLocked && approvedDirection && quoteReady && manifest.ready}
      referenceTitles={manifest.included.map((item) => `${item.current.title} v${item.current.version}`)} referenceBlockers={manifest.blockers}
      partial={partial} progress={progress.map((step) => ({ label: labels[step.step], status: step.status }))}
      allocation={reviewAllocation ? { existing: reviewAllocation.existingSeconds, selected: reviewAllocation.newSelectedSeconds,
        resulting: reviewAllocation.resultingSeconds, target: reviewAllocation.targetSeconds, remaining: reviewAllocation.remainingSeconds, blockers: reviewAllocation.blockers } : undefined}
      allocationCorrection={!busy && !stale && reviewAllocation?.existingSeconds === null ? <SceneAllocationCorrection
        document={current} getDocument={getDocument} commit={commit} flush={flush} sceneIds={reviewAllocation.unknownSceneIds} /> : undefined}
      onCount={setCount} onPartial={setPartial} onEdit={editProposal}
      onMove={(id) => act(() => { assertDirectionEditable(getDocument()); mutate((data) => { const proposals = data.sessions.find((item) => item.id === session?.id)!.proposals; const index = proposals.findIndex((item) => item.id === id); if (index > 0) [proposals[index - 1], proposals[index]] = [proposals[index], proposals[index - 1]]; }); })}
      onGenerate={(revision) => void generate(Boolean(revision), true, revision)} onAccept={() => void acceptSelected()} onConcept={(id) => void chooseConcept(id)}
      onRecover={() => void recover()} onCancel={stopRequest} onRetryQuote={() => void refreshQuote()} onReviseDirection={onReviseDirection ?? (() => setReview(true))} />;
  }
  const content = <>
    {!embedded && <header><div><span className="eyebrow">Story workspace</span><h2 id="story-development-title">Develop this story</h2></div><button type="button" onClick={close} aria-label="Close story development">Close</button></header>}
    <p>{referencesOnly ? 'References stay on this device. Sending them to AI requires separate approval.' : 'Local questions and edits never call AI. Manual scenes and shots stay available.'}</p>
    {error && <p role="alert" className="story-error">{error}</p>}{notice && <p role="status">{notice}</p>}
    {premiseLocked && <p role="status">Unlock the Story premise before changing story content or proposals. Existing work remains readable.</p>}
    {unresolved && !busy && <p role="status">An existing Story request is unresolved. No new request will be started. <button type="button" onClick={() => void recover(unresolved)}>Check existing Story request</button></p>}
    <details open={referencesOnly || undefined}><summary>References ({workflow?.references.length ?? 0}) — local library</summary><fieldset disabled={busy || premiseLocked}>
      <legend>1. References — local library</legend>
      <label>Reference scope<select value={`${owner.kind}:${owner.id}`} onChange={(event) => { const [kind, ...id] = event.target.value.split(':'); setOwner({ kind: kind as StoryReferenceOwner['kind'], id: id.join(':') }); resetRefForm(); }}>
        <option value={`story:${project.projectId}`}>Story default</option>
        {Object.values(project.scenes).map((scene) => <option key={scene.id} value={`scene:${scene.id}`}>{scene.title}</option>)}
        {Object.values(project.shots).map((shot) => <option key={shot.id} value={`shot:${shot.id}`}>Shot: {shot.title}</option>)}
      </select></label>
      {effective.map((item) => <article key={item.referenceId} className="story-reference">
        {item.current.content.kind === 'image' && <StoryReferencePreview hash={item.current.content.blobHash} title={item.current.title} />}
        <strong>{item.current.title}</strong><small>v{item.current.version} · {item.current.approval} · {item.current.rights} · {item.inheritedFrom.kind === owner.kind && item.inheritedFrom.id === owner.id ? 'Local' : `Inherited from ${item.inheritedFrom.kind}`}{item.current.archived ? ' · Archived' : ''}</small>
        {item.current.content.kind === 'note' && <p>{item.current.content.text}</p>}
        <button type="button" onClick={() => { setEditingReference(item.referenceId); setRefTitle(item.current.title); setCategory(item.current.category); setRights(item.current.rights); setApproved(item.current.approval === 'approved'); setUses(item.current.allowedUses); setNote(item.current.content.kind === 'note' ? item.current.content.text : ''); }}>Edit policy/content</button>
        <button type="button" onClick={() => act(() => mutate((data) => {
          let binding = data.bindings.find((entry) => entry.owner.kind === owner.kind && entry.owner.id === owner.id);
          if (!binding) { binding = { owner, rules: [] }; data.bindings.push(binding); }
          const local = binding.rules.find((rule) => (rule.action === 'add' && rule.referenceId === item.referenceId) || (rule.action === 'replace' && rule.replacementId === item.referenceId));
          if (local) binding.rules = binding.rules.filter((rule) => rule !== local);
          else binding.rules.push({ action: 'exclude', referenceId: item.referenceId });
        }))}>Detach / exclude</button>
        <button type="button" onClick={() => act(() => mutate((data) => { const ref = data.references.find((ref) => ref.id === item.referenceId)!; ref.versions.push({ ...ref.versions.at(-1)!, version: ref.versions.length + 1, archived: !item.current.archived }); }))}>{item.current.archived ? 'Restore reference' : 'Archive reference'}</button>
      </article>)}
      <button type="button" onClick={() => act(() => mutate((data) => { data.bindings = data.bindings.filter((item) => item.owner.kind !== owner.kind || item.owner.id !== owner.id); }))}>Reset this scope to inherited references</button>
      <p>Legacy scene reference decks remain available in the shot workbench; they are not automatically granted story-development permission.</p>
      <label>Reference title<input value={refTitle} maxLength={500} onChange={(event) => setRefTitle(event.target.value)} /></label>
      <label>Category<select value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>{['character', 'location', 'prop', 'style', 'composition', 'other'].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Rights<select value={rights} onChange={(event) => setRights(event.target.value as typeof rights)}>{['unknown', 'creator-owned', 'licensed', 'public-domain'].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><input type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} />I approve this reference content</label>
      <div role="group" aria-label="Permitted reference uses">{allUses.map((use) => <label key={use}><input type="checkbox" checked={uses.includes(use)} onChange={(event) => setUses(event.target.checked ? [...uses, use] : uses.filter((item) => item !== use))} />{use}</label>)}</div>
      {!editingReference && <label>Replace inherited reference<select value={replaceInherited} onChange={(event) => setReplaceInherited(event.target.value)}><option value="">Add without replacing</option>{effective.filter((item) => item.inheritedFrom.id !== owner.id).map((item) => <option key={item.referenceId} value={item.referenceId}>{item.current.title}</option>)}</select></label>}
      <label>Reference note<textarea value={note} maxLength={10_000} onChange={(event) => setNote(event.target.value)} /></label>
      <button type="button" disabled={!note.trim()} onClick={() => act(() => writeReference({ kind: 'note', text: note }))}>{editingReference ? 'Save reference revision' : 'Add note reference'}</button>
      {editingReference && <button type="button" onClick={() => act(() => { const ref = workflow!.references.find((item) => item.id === editingReference)!; writeReference(ref.versions.at(-1)!.content); })}>Save policy only</button>}
      <label>{editingReference ? 'Replace image content' : 'Attach reference image'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ''; }} /></label>
      <small>PNG/JPEG/WebP, 15 MB local limit. No upload-time AI. Generation has a separate 12 MB aggregate limit.</small>
    </fieldset></details>
    {!referencesOnly && <>{!planningOnly && <><fieldset disabled={busy || premiseLocked}><legend>2. Creative direction — up to four local questions</legend>
      {workflow?.draft && draft.premise !== (storyPremise(current)?.text ?? '') && <p role="status">This saved development draft differs from the canvas premise. Nothing was overwritten on open.
        <button type="button" onClick={() => updateDraft({ premise: storyPremise(current)?.text ?? '' })}>Use canvas premise</button>
        <button type="button" onClick={() => updateDraft({ premise: draft.premise })}>Use development draft</button>
      </p>}
      <label>Goal<select value={draft.mode} onChange={(event) => updateDraft({ mode: event.target.value as Draft['mode'] })}><option value="surprise">Surprise me</option><option value="expand">Expand my idea</option><option value="continue">Continue my story</option></select></label>
      <label>Premise for development<textarea value={draft.premise} maxLength={20_000} onChange={(event) => updateDraft({ premise: event.target.value })} /></label>
      {draft.mode === 'continue' && <label>Continue after<select value={draft.anchorSceneId ?? ''} onChange={(event) => updateDraft({ anchorSceneId: event.target.value || null })}><option value="">Choose a scene</option>{project.sceneOrder.map((id) => <option key={id} value={id}>{project.scenes[id].title}</option>)}</select></label>}
      <label>Format<select value={draft.aspectRatio ?? ''} onChange={(event) => updateDraft({ aspectRatio: event.target.value as Draft['aspectRatio'] })}><option value="">Choose format</option>{['9:16', '16:9', '1:1', '4:5'].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Platform<select value={draft.answers.find((item) => item.id === 'format')?.values[0] ?? 'short-form'} onChange={(event) => updateDraft({ answers: [...draft.answers.filter((item) => item.id !== 'format'), { id: 'format', values: [event.target.value], customText: '' }] })}>{['short-form', 'youtube', 'film-festival', 'commercial', 'other'].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>{draft.mode === 'continue' ? 'New material duration (seconds)' : 'Target duration (seconds)'}<input type="number" min={1} max={86400} value={draft.durationSeconds ?? ''} onChange={(event) => updateDraft({ durationSeconds: Number(event.target.value) || null })} /></label>
      <label>Tone<input value={draft.tone} maxLength={500} onChange={(event) => updateDraft({ tone: event.target.value })} /></label>
      <label>Ending direction<textarea value={draft.ending} maxLength={2000} onChange={(event) => updateDraft({ ending: event.target.value })} /></label>
      <div role="group" aria-label="Production constraints">{['No restrictions', 'One actor', 'One room', 'No dialogue'].map((value) => <label key={value}><input type="checkbox" checked={draft.constraints.includes(value)} onChange={(event) => updateDraft({ constraints: event.target.checked ? value === 'No restrictions' ? [value] : [...draft.constraints.filter((item) => item !== 'No restrictions'), value] : draft.constraints.filter((item) => item !== value) })} />{value}</label>)}</div>
      <label>Custom constraints (one per line)<textarea value={draft.constraints.filter((item) => !['No restrictions', 'One actor', 'One room', 'No dialogue'].includes(item)).join('\n')} onChange={(event) => updateDraft({ constraints: [...draft.constraints.filter((item) => ['One actor', 'One room', 'No dialogue'].includes(item)), ...event.target.value.split('\n').filter(Boolean)].slice(0, 30) })} /></label>
      <button type="button" onClick={() => setReview(true)}>Review creative brief</button>
      <InlineDiscardButton label="Discard direction draft" description="Discard local direction answers? Existing scenes and references are kept." onConfirm={() => act(() => mutate((data) => { data.draft = null; }))} />
    </fieldset>
    {review && <section aria-label="Creative brief review"><h3>3. Review direction</h3><p>{draft.mode} · {draft.aspectRatio || 'Format missing'} · {draft.durationSeconds ?? '?'} seconds · {draft.tone || 'Tone missing'}</p><p>{draft.premise || 'Surprise me: no premise supplied.'}</p><p>Constraints: {draft.constraints.join(', ') || 'None specified'}</p><p>Assumptions: {draft.ending ? 'None added.' : 'Ending is open for proposal.'} Platform defaults to short-form unless you choose another.</p><button type="button" disabled={busy || premiseLocked} onClick={() => void approveBrief()}>Approve direction — no AI call</button></section>}
    </>}{brief && session?.stage !== 'accepted' && <section aria-label="Story generation review"><h3>Turn your direction into scenes</h3><p>Brief v{brief.version} · {brief.durationSeconds}s {brief.durationScope === 'whole-story' ? 'whole story' : 'new material'} · {brief.aspectRatio}. Review proposals before adding them. No images or video yet.</p>
      <p>Workspace provider: {mode === 'loading' ? 'Checking availability…' : mode === 'fixture' ? 'Fixture — sample outputs, no paid calls' : 'Live — explicit approval required'}</p>
      <label>Proposal count<input type="number" min={1} max={10} value={count} disabled={busy} onChange={(event) => setCount(Number(event.target.value))} /></label>
      <p>Included references: {manifest.included.map((item) => `${item.current.title} v${item.current.version}`).join(', ') || 'None'}. Included scene context: {project.sceneOrder.length} scene titles and synopses. No external research.</p>
      {manifest.excluded.map((item) => <p key={item.referenceId}>Excluded {workflow?.references.find((ref) => ref.id === item.referenceId)?.versions.at(-1)?.title}: {item.reason}</p>)}
      {manifest.blockers.map((message) => <p role="alert" key={message}>{message}</p>)}
      {!quote && <button type="button" disabled={busy} onClick={() => void refreshQuote()}>Retry story estimate</button>}
      {quote && <><p>{quote.model} · {quote.mode === 'fixture' ? 'No paid calls' : `Operator bounded estimate: USD ${quote.cost}. Ceiling: USD ${quote.ceiling}. Actual charges may differ.`} One attempt, no automatic retry.</p>{quote.blockers.map((message) => <p key={message}>{message}</p>)}</>}
      {mode === 'live' && <label><input type="checkbox" disabled={busy || !quoteReady} checked={consent} onChange={(event) => setConsent(event.target.checked)} />I approve sending this brief, scene context and listed references for this one paid request.</label>}
      <button type="button" className="primary-button" disabled={busy || premiseLocked || !!unresolved || !approvedDirection || (mode === 'live' && !consent) || !quoteReady || !manifest.ready} onClick={() => void generate(false, mode === 'fixture')}>Generate {draft.mode === 'surprise' ? 'concepts' : 'scene proposals'}</button>
      {busy && <button type="button" onClick={stopRequest}>Cancel story request</button>}
    </section>}
    {session && session.stage !== 'accepted' && <section aria-label="Story proposals"><h3>Review your scenes · {session.stage}</h3>{stale && <p role="alert">Source changed. Accepted work is preserved; review new proposals before inserting anything.</p>}
      {['running', 'outcome-unknown', 'cancelled'].includes(session.stage) && !busy && <button type="button" onClick={() => void recover()}>Check saved result — never generate again</button>}
      {session.proposals.map((proposal, index) => <article key={proposal.id} className="story-proposal"><label><input type="checkbox" checked={proposal.selected} disabled={premiseLocked || session.stage !== 'proposal-review'} onChange={(event) => editProposal(proposal.id, { selected: event.target.checked })} />Select proposal {index + 1}</label>
        <strong>{proposal.title}</strong><p>{proposal.synopsis}</p><small>{proposal.durationSeconds}s · {proposal.purpose}</small><details><summary>Edit this proposal</summary>
        <label>Proposal {index + 1} title<input value={proposal.title} disabled={premiseLocked || session.stage !== 'proposal-review'} onChange={(event) => editProposal(proposal.id, { title: event.target.value })} /></label>
        <label>Proposal {index + 1} synopsis<textarea value={proposal.synopsis} disabled={premiseLocked || session.stage !== 'proposal-review'} onChange={(event) => editProposal(proposal.id, { synopsis: event.target.value })} /></label><p>{proposal.purpose}</p>
        {session.mode !== 'surprise' && <label>Proposal {index + 1} duration<input type="number" min={1} max={3600} value={proposal.durationSeconds} disabled={premiseLocked || session.stage !== 'proposal-review'} onChange={(event) => editProposal(proposal.id, { durationSeconds: Number(event.target.value) })} /></label>}
        {session.stage === 'proposal-review' && <><button type="button" disabled={premiseLocked || !index} onClick={() => act(() => mutate((data) => { const proposals = data.sessions.find((item) => item.id === session.id)!.proposals; [proposals[index - 1], proposals[index]] = [proposals[index], proposals[index - 1]]; }))}>Move proposal {index + 1} up</button>{session.mode === 'surprise' && <InlineDiscardButton disabled={premiseLocked || stale} label={`Use concept ${index + 1}`} confirmLabel="Confirm concept replacement" description="Replace the existing premise with this concept? This is undoable and does not generate scenes." onConfirm={() => void chooseConcept(proposal.id)} />}</>}
      </details></article>)}
      {session.stage === 'proposal-review' && <><p>Selected allocation: {session.proposals.filter((item) => item.selected).reduce((sum, item) => sum + item.durationSeconds, 0)}s / {brief?.durationSeconds}s target. Shot runtime remains separate.</p>
        <label><input type="checkbox" checked={partial} onChange={(event) => setPartial(event.target.checked)} />Accept a partial or different total without stretching other scenes</label>
        {session.mode !== 'surprise' && <button type="button" disabled={premiseLocked || stale || busy} onClick={async () => { try { await commitReviewedStoryDocument(getDocument, commit, (document, digest) => acceptStoryScenes(document, session.id, digest, partial)); await flush(); setNotice('Scenes accepted as one undoable change. No AI call.'); onAccepted?.(); } catch (error) { setError((error as Error).message); } }}>Accept selected scenes</button>}
        <button type="button" disabled={premiseLocked || !!unresolved || busy || (mode === 'live' && !consent) || !quoteReady || stale} onClick={() => void generate(true, mode === 'fixture')}>Regenerate selected — new reviewed request</button>
        <button type="button" disabled={premiseLocked || busy} onClick={() => act(() => mutate((data) => { data.sessions.find((item) => item.id === session.id)!.stage = 'rejected'; }))}>Reject proposals</button></>}
    </section>}</>}
  </>;
  return embedded ? <div className="story-development-dialog story-development-embedded">{content}</div>
    : <dialog ref={dialog} className="story-development-dialog" aria-label="Develop this story" onCancel={(event) => { event.preventDefault(); close(); }}>{content}</dialog>;
}
