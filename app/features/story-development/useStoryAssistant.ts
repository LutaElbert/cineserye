'use client';
import { useEffect, useRef, useState } from 'react';
import { canonicalRequest, requestDigest } from '../../domain/cinema/request-digest';
import { StoryCreativeBriefSchema, reviewStoryReferenceTransfer } from '../../domain/cinema/story-workflow';
import { AssistantCheckpointSchema, resumeAssistant, type AssistantCheckpoint, type AssistantFact, type StoryAssistant } from '../../domain/cinema/story-assistant';
import { changeStory, ensureStoryProject, storyPremise, storySceneContext, storyContextDigest, storySessionOutputs } from '../../editor/story-development-commands';
import { initialPremiseDraft } from '../../editor/premise-draft';
import { assistantPlacement } from '../../editor/story-assistant-projection';
import { loadLocalMediaBlob } from '../../editor/persistence';
import { fileToDataUrl } from '../../editor/image-file';
import type { EditorDocument } from '../../editor/types';
import { AssistantInputSchema, type AssistantInput } from './assistant-contracts';
import { readAssistantStream } from './assistant-client';
import type { StoryQuote } from './contracts';
import { resolvePromptReferenceMentions } from './prompt-composer-model';
import type { OperationProgress } from '../../domain/cinema/generation-operation';
import type { WorkflowCapabilities } from './workflow-capabilities';
import { useWorkspaceAdmission } from '../simplified-flow/useWorkspaceAdmission';
import { ensureClientOperation, observeClientOperation } from '../simplified-flow/operation-journal';

export const assistantRefLimits = { maxImages: 8, maxBytes: 12 * 1024 * 1024, maxNoteCharacters: 20000 };
export function assistantSourceIdentity(document: EditorDocument) {
  const workflow = document.cinema?.storyWorkflow;
  const ownSessions = workflow?.sessions.filter((session) => session.source.briefVersion === workflow.assistant?.confirmedBriefVersion) ?? [];
  const outputs = ownSessions.map((session) => storySessionOutputs(document, session.id));
  const excluded = outputs.flatMap((output) => output.unchanged), changed = outputs.flatMap((output) => output.changed);
  const allocations = workflow?.allocations?.filter((item) => !excluded.includes(item.sceneId) && document.cinema?.scenes[item.sceneId]);
  const draftSource = excluded.length && document.cinema ? { ...document, cinema: { ...document.cinema,
    sceneOrder: document.cinema.sceneOrder.filter((id) => !excluded.includes(id)) } } : document;
  return canonicalRequest({ projectId: document.cinema?.projectId, premise: storyPremise(document), context: storySceneContext(document, excluded),
    ...(changed.length ? { changedAcceptedOutputs: changed } : {}), ...(allocations?.length ? { allocations } : {}),
    draft: workflow?.draft ?? initialPremiseDraft(draftSource), references: workflow?.references ?? [], bindings: workflow?.bindings ?? [] });
}
export function useStoryAssistant(current: EditorDocument, getDocument: () => EditorDocument,
  commit: (document: EditorDocument, history?: boolean) => void, flush: () => Promise<unknown>, capabilities: WorkflowCapabilities | null) {
  const captureAdmission = useWorkspaceAdmission(capabilities);
  const running = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<OperationProgress[]>([]);
  useEffect(() => () => { running.current?.abort(); }, []);
  const assistant = current.cinema?.storyWorkflow?.assistant;
  const sourceIdentity = assistantSourceIdentity(current);
  const mutate = (change: (assistant: StoryAssistant) => void, history = false) => {
    const source = getDocument();
    if (!source.cinema?.storyWorkflow?.assistant) return;
    commit(changeStory(source, (data) => change(data.assistant!)), history);
  };
  const editable = (document: EditorDocument) => {
    const premise = storyPremise(document);
    if (!premise || document.nodes.find((node) => node.id === premise.nodeId)?.data.locked) throw Error('Unlock the original Story premise to use assistance.');
  };
  const open = () => {
    try {
      const source = ensureStoryProject(getDocument()); editable(source);
      const premise = storyPremise(source)!;
      const existing = source.cinema!.storyWorkflow?.assistant;
      commit(changeStory(source, (data) => {
        data.version = 2;
        data.assistant = existing ? { ...existing, hidden: false, collapsed: false } : {
          version: 1, id: `story-assistant:${crypto.randomUUID()}`, premiseNodeId: premise.nodeId,
          position: assistantPlacement(source.nodes, source.nodes.find((node) => node.id === premise.nodeId)!),
          hidden: false, collapsed: false, sourceDigest: null, operationId: null, state: 'review', checkpoint: null, answers: [], confirmedBriefVersion: null, error: null,
        };
      })); setError('');
    } catch (error) { setError((error as Error).message); }
  };
  const prepareInput = async (source: EditorDocument): Promise<AssistantInput> => {
    editable(source);
    const project = source.cinema!, draft = project.storyWorkflow?.draft ?? initialPremiseDraft(source);
    const manifest = reviewStoryReferenceTransfer(project, { kind: 'story', id: project.projectId }, 'story-development', assistantRefLimits);
    if (!manifest.ready) throw Error(manifest.blockers.join(' '));
    const explicit: AssistantFact[] = [];
    for (const field of ['aspectRatio', 'durationSeconds', 'tone', 'ending', 'constraints', 'genres'] as const) {
      const value = draft[field];
      if (value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length)) explicit.push({ field, value, origin: 'user', excerpt: '', referenceId: null, referenceVersion: null });
    }
    const references: AssistantInput['references'] = [];
    for (const ref of manifest.included) {
      const value = ref.current; let content: AssistantInput['references'][number]['content'];
      if (value.content.kind === 'note') content = value.content;
      else {
        const media = await loadLocalMediaBlob(value.content.blobHash); if (!media) throw Error(`Restore missing reference: ${value.title}.`);
        content = { kind: 'image', mimeType: value.content.mimeType, base64: (await fileToDataUrl(new File([media.blob], value.title, { type: media.mimeType }))).split(',')[1] };
      }
      references.push({ id: ref.referenceId, version: value.version, title: value.title, approval: 'approved', rights: value.rights as 'creator-owned' | 'licensed' | 'public-domain', allowedUses: value.allowedUses, content });
    }
    return AssistantInputSchema.parse({ version: 1, projectId: project.projectId, premiseNodeId: storyPremise(source)!.nodeId,
      premise: storyPremise(source)!.text, goal: draft.mode, anchorSceneId: draft.mode === 'continue' ? draft.anchorSceneId : null,
      context: storySceneContext(source), explicit, references,
      referenceMentions: resolvePromptReferenceMentions(storyPremise(source)!.text, project.storyWorkflow, manifest.included.map((item) => item.referenceId)),
      referenceRevision: project.storyWorkflow?.revision ?? 0 });
  };
  const applyCheckpoint = async (checkpoint: AssistantCheckpoint, identity: string, localDigest: string, operationId: string) => {
    const source = getDocument();
    if (source.cinema?.projectId !== checkpoint.projectId || source.cinema.storyWorkflow?.assistant?.operationId !== operationId) return;
    if (source.cinema.storyWorkflow.assistant.state === 'cancelled') return;
    if (assistantSourceIdentity(source) !== identity || storyPremise(source)?.nodeId !== checkpoint.premiseNodeId) {
      mutate((value) => { value.state = 'stale'; value.error = 'The source changed. Previous answers are retained; review a new analysis.'; }); return;
    }
    let next = source;
    if (checkpoint.stage === 'confirmed') {
      editable(source);
      const draft = { ...(source.cinema.storyWorkflow.draft ?? initialPremiseDraft(source)) };
      const facts = checkpoint.analysis.facts;
      const get = (field: AssistantFact['field']) => facts.find((fact) => fact.field === field)?.value;
      draft.aspectRatio = get('aspectRatio') as typeof draft.aspectRatio; draft.durationSeconds = get('durationSeconds') as number;
      draft.tone = get('tone') as string; draft.ending = get('ending') as string; draft.constraints = get('constraints') as string[];
      draft.genres = get('genres') as string[] ?? [];
      for (const field of ['cast', 'style'] as const) if (get(field)) draft.constraints = [...draft.constraints.filter((item) => item !== 'No restrictions'), `${field}: ${get(field)}`];
      draft.premise = storyPremise(source)!.text;
      const digest = await storyContextDigest(source);
      if (assistantSourceIdentity(getDocument()) !== identity) throw Error('Story changed during confirmation. Review again.');
      const brief = StoryCreativeBriefSchema.parse({ mode: draft.mode, premise: draft.premise, aspectRatio: draft.aspectRatio,
        durationSeconds: draft.durationSeconds, tone: draft.tone, ending: draft.ending, constraints: draft.constraints, answers: draft.answers, genres: draft.genres,
        version: (source.cinema.storyWorkflow.briefs.length ?? 0) + 1,
        sourceDigest: digest, durationScope: draft.mode === 'continue' ? 'new-material' : 'whole-story', platform: 'other',
        assumptions: ['Platform unspecified; no distribution platform assumed.'], status: 'approved',
      });
      next = changeStory(getDocument(), (data) => { data.draft = draft; data.briefs.push(brief); });
    }
    const nextDigest = checkpoint.stage === 'confirmed' ? await requestDigest(assistantSourceIdentity(next)) : localDigest;
    if (assistantSourceIdentity(getDocument()) !== identity) throw Error('Story changed before the checkpoint could be applied.');
    commit(changeStory(next, (data) => { const value = data.assistant!;
      value.checkpoint = checkpoint; value.state = checkpoint.stage; value.sourceDigest = nextDigest; value.answers = []; value.error = null;
      if (checkpoint.stage === 'confirmed') value.confirmedBriefVersion = data.briefs.at(-1)!.version;
    }), checkpoint.stage === 'confirmed');
    await flush();
  };
  const execute = async (mode: 'fixture' | 'live', quote: StoryQuote | null, consent: boolean, approvedIdentity: string, resume = false, approvalCurrent: () => boolean = () => true) => {
    if (running.current) return;
    const controller = new AbortController(); running.current = controller; setBusy(true); setError(''); setProgress([]);
    let operationId = ''; let projectId = ''; let dispatched = false; let journalRecorded = false; let previous: StoryAssistant | undefined;
    let journalScope = '';
    try {
      const requireAdmission = captureAdmission(mode);
      const requireApproval = () => { requireAdmission(); if (!approvalCurrent()) throw Error('Analysis estimate changed. Review and approve the current estimate again.'); };
      requireApproval();
      const source = getDocument(); editable(source);
      const state = source.cinema?.storyWorkflow?.assistant; if (!state) throw Error('Open Story assistance first.');
      previous = state;
      projectId = source.cinema!.projectId;
      const identity = assistantSourceIdentity(source), localDigest = await requestDigest(identity);
      if (approvedIdentity !== identity) throw Error('The premise or references changed. Review again.');
      operationId = crypto.randomUUID();
      let forwardedProps: unknown; let resumeInput: unknown[] = [];
      if (resume) {
        if (!state.checkpoint || state.sourceDigest !== localDigest) throw Error('Questions are stale. Review updated source.');
        // Keep incomplete forms editable; validation failure is not an unknown network outcome.
        resumeAssistant(state.checkpoint, state.answers, operationId);
        forwardedProps = { command: 'resume', projectId, parentRunId: state.checkpoint.runId, sourceDigest: state.checkpoint.sourceDigest, answers: state.answers };
        resumeInput = [{ interruptId: state.checkpoint.runId, status: 'resolved', payload: { answers: state.answers } }];
      } else {
        if (!consent || !quote?.ready || quote.mode !== mode) throw Error('Approve this analysis and its current estimate first.');
        const input = await prepareInput(source);
        forwardedProps = { command: 'analyze', mode, input, consent: true, quoteId: quote.quoteId, contentDigest: await requestDigest({ input, quoteId: quote.quoteId }) };
      }
      controller.signal.throwIfAborted();
      requireApproval();
      if (assistantSourceIdentity(getDocument()) !== identity) throw Error('The source changed while preparing references. Review again.');
      mutate((value) => {
        if (!resume && value.checkpoint && value.answers.length) {
          const previous = { checkpoint: value.checkpoint, answers: value.answers };
          const history = value.previousAnswers ?? [];
          if (canonicalRequest(history.at(-1)) !== canonicalRequest(previous)) value.previousAnswers = [...history, previous].slice(-10);
        }
        value.operationId = operationId; value.sourceDigest = localDigest; value.state = 'understanding'; value.error = null;
      }); await flush();
      controller.signal.throwIfAborted();
      requireApproval();
      if (assistantSourceIdentity(getDocument()) !== identity || getDocument().cinema?.storyWorkflow?.assistant?.operationId !== operationId) throw Error('The source changed before dispatch. Review again.');
      journalScope = storyPremise(source)!.nodeId;
      const journalOwner = { projectId, kind: 'story-analysis' as const, scopeKey: journalScope };
      ensureClientOperation({ id: operationId, ...journalOwner, sourceFingerprint: localDigest,
        provider: mode === 'fixture' ? 'cineserye-story-assistant-fixture' : 'configured-story-provider',
        model: quote?.model ?? null, estimateUsd: quote?.cost ?? null }, { phase: 'intent', dispatchCertainty: 'not-dispatched' });
      journalRecorded = true;
      observeClientOperation(operationId, journalOwner, { phase: 'dispatched', dispatchCertainty: 'may-have-dispatched' });
      dispatched = true;
      const response = await fetch('/api/cinema/story-assistant', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: projectId, runId: operationId, state: {}, messages: [], tools: [], context: [], forwardedProps, ...(resumeInput.length ? { resume: resumeInput } : {}) }) });
      const checkpoint = await readAssistantStream(response, projectId, operationId, (step) => {
        if (!controller.signal.aborted && getDocument().cinema?.storyWorkflow?.assistant?.operationId === operationId) {
          setProgress((steps) => [...steps.filter((item) => item.step !== step.step), step]);
        }
      });
      controller.signal.throwIfAborted();
      await applyCheckpoint(checkpoint, identity, localDigest, operationId);
      observeClientOperation(operationId, journalOwner, { phase: 'awaiting-review', dispatchCertainty: 'completed', lastError: null });
    } catch (error) {
      const message = (error as Error).message; setError(controller.signal.aborted ? '' : message);
      if (operationId && getDocument().cinema?.projectId === projectId) mutate((value) => {
        if (value.operationId === operationId && value.state === 'understanding') {
          if (!dispatched && previous) { value.state = previous.state; value.operationId = previous.operationId; value.sourceDigest = previous.sourceDigest; }
          else value.state = 'outcome-unknown';
          value.error = message.slice(0, 2000);
        }
      });
      if (journalRecorded) try { observeClientOperation(operationId, { projectId, kind: 'story-analysis', scopeKey: journalScope }, {
        phase: dispatched ? 'unknown' : 'failed', dispatchCertainty: dispatched ? 'may-have-dispatched' : 'not-dispatched', lastError: message,
      }); } catch { /* Older/corrupt records remain visible through their own recovery warning. */ }
    } finally { running.current = null; setBusy(false); }
  };
  const recover = async () => {
    try {
      const source = getDocument(), state = source.cinema?.storyWorkflow?.assistant;
      if (!state?.operationId || state.state === 'cancelled') throw Error('Cancelled results are not applied. Review a new analysis explicitly.');
      const identity = assistantSourceIdentity(source), digest = await requestDigest(identity);
      if (state.sourceDigest !== digest) throw Error('Saved result belongs to older story content.');
      const response = await fetch(`/api/cinema/story-assistant?projectId=${encodeURIComponent(source.cinema!.projectId)}&runId=${state.operationId}`);
      const result = await response.json() as { status?: string; checkpoint?: unknown };
      if (!response.ok || result.status !== 'completed') throw Error('No saved result yet. The outcome may be unknown; no analysis was restarted.');
      await applyCheckpoint(AssistantCheckpointSchema.parse(result.checkpoint), identity, digest, state.operationId);
      try { observeClientOperation(state.operationId, { projectId: source.cinema!.projectId, kind: 'story-analysis',
        scopeKey: state.premiseNodeId }, { phase: 'awaiting-review', dispatchCertainty: 'completed', lastError: null }); } catch { /* Legacy request. */ }
    } catch (error) { setError((error as Error).message); }
  };
  return { assistant, sourceIdentity, busy, error, progress, open, execute, recover,
    change: mutate,
    cancel: () => { running.current?.abort(); mutate((state) => { state.state = 'cancelled'; state.error = 'Cancelled locally. Dispatched work may still be billed; late results will not apply.';
      if (state.operationId && current.cinema) try {
        observeClientOperation(state.operationId, { projectId: current.cinema.projectId, kind: 'story-analysis', scopeKey: state.premiseNodeId }, {
          phase: 'tracking-stopped', dispatchCertainty: 'may-have-dispatched', lastError: state.error,
        });
      } catch { /* Legacy request. */ }
    }); },
  };
}
export type StoryAssistantController = ReturnType<typeof useStoryAssistant>;
