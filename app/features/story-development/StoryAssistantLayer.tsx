'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Handle, Position } from '@xyflow/react';
import { X, Sparkles, BookOpen, ImageIcon, Check, ArrowRight } from 'lucide-react';
import { requestDigest } from '../../domain/cinema/request-digest';
import { fieldLabels, questionsFor, type AssistantQuestion } from '../../domain/cinema/story-assistant';
import { reviewStoryReferenceTransfer, storyReviewSession } from '../../domain/cinema/story-workflow';
import { storyPremise, openStorySessionReview, returnToLatestStorySession } from '../../editor/story-development-commands';
import type { EditorDocument } from '../../editor/types';
import { assistantRefLimits, type StoryAssistantController } from './useStoryAssistant';
import { StructuredQuestions } from './StructuredQuestions';
import { StoryDevelopmentPanel } from './StoryDevelopmentPanel';
import type { StoryQuote } from './contracts';
import type { OperationProgress } from '../../domain/cinema/generation-operation';
import { StoryRevisionHistory } from './StoryRevisionHistory';
import { assistantScrollSurface, useAssistantFooterSize } from './assistant-scroll';

export function StoryAssistantLayer({ controller, document, getDocument, commit, flush, providerMode, shotPlanning, onScenesAccepted }: {
  controller: StoryAssistantController; document: EditorDocument; getDocument: () => EditorDocument;
  commit: (document: EditorDocument, history?: boolean) => void; flush: () => Promise<unknown>;
  providerMode: 'fixture' | 'live' | 'loading'; shotPlanning?: ReactNode;
  onPlanScene?: (nodeId: string) => void;
  onScenesAccepted?: (sceneIds: string[]) => void;
}) {
  const state = controller.assistant!;
  const [quote, setQuote] = useState<StoryQuote | null>(null);
  const [quoteError, setQuoteError] = useState('');
  const quoteSequence = useRef(0);
  const scroll = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLElement>(null);
  useAssistantFooterSize(root);
  const [localDigest, setLocalDigest] = useState('');
  const [editingFacts, setEditingFacts] = useState(false);
  const [questionPage, setQuestionPage] = useState({ key: '', index: 0 });
  const [showHistory, setShowHistory] = useState(false);
  const [manualDirection, setManualDirection] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const project = document.cinema!;
  const manifest = reviewStoryReferenceTransfer(project, { kind: 'story', id: project.projectId }, 'story-development', assistantRefLimits);
  const checkpoint = state.checkpoint;
  const questionKey = `${checkpoint?.runId ?? ''}:${editingFacts}`;
  const questionIndex = questionPage.key === questionKey ? questionPage.index : 0;
  const setQuestionIndex = (next: number | ((index: number) => number)) => setQuestionPage({ key: questionKey, index: typeof next === 'number' ? next : next(questionIndex) });
  const stale = Boolean(state.sourceDigest && localDigest && state.sourceDigest !== localDigest);
  const locked = Boolean(document.nodes.find((node) => node.id === state.premiseNodeId)?.data.locked);
  const latestSession = storyReviewSession(project.storyWorkflow);
  const savedReview = Boolean(project.storyWorkflow?.reviewSessionId && latestSession && latestSession.presentation === 'scene-review');
  const activeSession = savedReview || latestSession?.source.briefVersion === state.confirmedBriefVersion ? latestSession : undefined;
  const accepted = Boolean(activeSession?.accepted.length && activeSession.presentation !== 'scene-review');
  const confirmed = state.state === 'confirmed' && !stale;
  const showPlanning = !accepted && !manualDirection && (savedReview || Boolean(state.confirmedBriefVersion) && confirmed);
  const showQuestions = !accepted && !manualDirection && !showPlanning && checkpoint && !stale && ['needs-input', 'confirm-direction'].includes(state.state);
  const showAnalysis = !accepted && !manualDirection && !showPlanning && !showQuestions;
  const status = accepted ? `${latestSession!.accepted.length} scenes added` : controller.busy ? 'Understanding'
    : activeSession?.stage === 'running' && showPlanning ? 'Drafting outline' : activeSession?.stage === 'proposal-review' && showPlanning ? 'Ready for review'
      : savedReview ? 'Saved draft review' : showQuestions ? 'A quick check' : showPlanning ? 'Direction confirmed' : 'Ready';
  const progressLabels: Record<OperationProgress['step'], string> = { preparing: 'Preparing approved context', model: providerMode === 'fixture' ? 'Reading fixture direction' : 'Understanding your story', validation: 'Checking the structured direction', checkpoint: 'Saving this checkpoint' };
  const hide = () => { controller.change((value) => { value.hidden = true; }); requestAnimationFrame(() => window.document.querySelector<HTMLButtonElement>('button[aria-label="Focus story assistant"]')?.focus()); };
  useEffect(() => { assistantScrollSurface(scroll.current)?.scrollTo({ top: 0 }); }, [state.state, state.checkpoint?.runId, accepted, manualDirection]);
  useEffect(() => { let active = true; void requestDigest(controller.sourceIdentity).then((digest) => { if (active) setLocalDigest(digest); }); return () => { active = false; }; }, [controller.sourceIdentity]);
  const refresh = async () => {
    if (providerMode === 'loading') return;
    const sequence = ++quoteSequence.current; setQuote(null); setQuoteError('');
    try {
      const response = await fetch(`/api/cinema/story-assistant?mode=${providerMode}`);
      if (!response.ok) throw Error('This feature’s availability could not be checked.');
      const value: StoryQuote = await response.json();
      if (sequence === quoteSequence.current) {
        if (value.mode !== providerMode) throw Error('Analysis capability does not match the workspace provider.');
        setQuote(value);
      }
    } catch (error) { if (sequence === quoteSequence.current) setQuoteError((error as Error).message); }
  };
  useEffect(() => {
    if (providerMode === 'loading') return;
    let active = true; const sequence = ++quoteSequence.current;
    void fetch(`/api/cinema/story-assistant?mode=${providerMode}`).then(async (response) => {
      if (!response.ok) throw Error('Analysis availability is currently unknown.');
      const value: StoryQuote = await response.json();
      if (active && sequence === quoteSequence.current) {
        if (value.mode !== providerMode) throw Error('Analysis capability does not match the workspace provider.');
        setQuote(value); setQuoteError('');
      }
    }).catch((error) => { if (active) setQuoteError((error as Error).message); });
    return () => { active = false; };
  }, [providerMode]);
  const correctedQuestions: AssistantQuestion[] = editingFacts && checkpoint ? checkpoint.analysis.facts.filter((fact) => !checkpoint.questions.some((question) => question.field === fact.field)).map((fact) => ({
    ...questionsFor({ version: 1, facts: [], conflicts: [fact.field] }, 3)[0], id: `edit:${fact.field}`, required: false, reason: 'Optional correction. Leave blank to keep the understood value.',
  })) : [];
  const questions = [...correctedQuestions, ...(checkpoint?.questions ?? [])].map((question) => question.field === 'durationSeconds' && project.storyWorkflow?.draft?.mode === 'continue' ? { ...question, label: 'New material (seconds)' } : question);
  const activeQuestion = questions[Math.min(questionIndex, Math.max(0, questions.length - 1))];
  const activeAnswer = state.answers.find((answer) => answer.questionId === activeQuestion?.id)?.value;
  const canAdvance = !activeQuestion?.required || (Array.isArray(activeAnswer) ? activeAnswer.length > 0 : typeof activeAnswer === 'number' ? activeAnswer > 0 : Boolean(activeAnswer?.trim()));
  const lastQuestion = questionIndex >= questions.length - 1;
  const facts = checkpoint?.analysis.facts ?? [];
  const understood = facts.filter((fact) => fact.origin !== 'suggested');
  const contextBrief = (showPlanning || accepted) ? savedReview && latestSession ? project.storyWorkflow?.briefs[latestSession.source.briefVersion - 1] : project.storyWorkflow?.briefs.at(-1) : undefined;
  const newMaterial = contextBrief ? contextBrief.durationScope === 'new-material' : project.storyWorkflow?.draft?.mode === 'continue';
  const contextFacts = contextBrief ? [{ field: 'durationSeconds', value: contextBrief.durationSeconds }, { field: 'aspectRatio', value: contextBrief.aspectRatio },
    { field: 'genres', value: contextBrief.genres ?? [] }] : understood.filter((fact) => ['durationSeconds', 'aspectRatio', 'genres'].includes(fact.field));
  const historyBusy = controller.busy || ['understanding', 'outcome-unknown'].includes(state.state)
    || Boolean(project.storyWorkflow?.sessions.some((item) => ['running', 'outcome-unknown'].includes(item.stage)));
  const reviewHistory = (id?: string) => {
    try { commit(id ? openStorySessionReview(getDocument(), id) : returnToLatestStorySession(getDocument()), false); setManualDirection(false); setHistoryError(''); }
    catch (error) { setHistoryError((error as Error).message); }
  };
  const referenceTitles = manifest.included.map((item) => item.current.title);
  const quoteMatches = quote?.mode === providerMode;
  const approvalCopy = providerMode === 'live' && quoteMatches ? quote.cost > 0 && Number.isFinite(quote.cost) ? `Est. $${quote.cost} · allowance $${quote.ceiling}. Actual charges may differ.` : 'Estimate unavailable — pricing must be configured before approval.'
    : providerMode === 'fixture' ? 'Fixture analysis · no AI or paid calls' : 'Checking analysis availability…';
  const openManual = () => setManualDirection(true);
  return <section ref={root} role="region" aria-label="Story Assistant" className="story-assistant-node assistant-v2 nowheel"
    onKeyDown={(event) => { if (event.key === 'Escape' && !event.nativeEvent.isComposing) { event.preventDefault(); hide(); } event.stopPropagation(); }}
    onDoubleClick={(event) => event.stopPropagation()} onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); }}>
    <Handle type="target" position={Position.Left} id="assistant-target" isConnectable={false} />
    <header className="layer-drag-handle" title="Drag to move this layer"><Sparkles size={17} /><h2>Assistant</h2><span className="assistant-state-badge" data-state={accepted ? 'complete' : 'active'}>{status}</span>
      <button className="nodrag assistant-icon-button" aria-label="Hide story assistant" type="button" onClick={hide}><X size={17} /></button></header>
    {state.collapsed && <div className="assistant-summary nodrag nopan nowheel"><strong>{status}</strong><p>Direction and conversation saved.</p><button onClick={() => controller.change((value) => { value.collapsed = false; })}>Reopen assistant</button></div>}
    <div className="assistant-expanded-content nodrag nopan nowheel" style={{ display: state.collapsed ? 'none' : undefined }}>
      <div className="assistant-context-chips" aria-label="Story context"><span title={storyPremise(document)?.title}><BookOpen size={14} />Story</span>
        {referenceTitles.slice(0, 2).map((title, index) => <span key={`${title}:${index}`} title={`${title} · approved permission, not proof of image analysis`}><ImageIcon size={14} />{title}</span>)}
        {referenceTitles.length > 2 && <span>+{referenceTitles.length - 2} references</span>}
        {contextFacts.filter((fact) => !Array.isArray(fact.value) || fact.value.length).map((fact) => <span key={fact.field}>{fact.field === 'durationSeconds' ? `${newMaterial ? '+' : ''}${fact.value}s ${newMaterial ? 'new material' : 'total'}` : Array.isArray(fact.value) ? fact.value.join(' + ') : fact.value}</span>)}
      </div>
      {Boolean(project.storyWorkflow?.sessions.length || state.previousAnswers?.length) && <button type="button" className="assistant-text-button assistant-history-link" onClick={() => setShowHistory(!showHistory)}>{showHistory ? 'Back to current step' : 'Saved drafts'}</button>}
      {showHistory && project.storyWorkflow && <div className="assistant-stage-scroll"><StoryRevisionHistory flat workflow={project.storyWorkflow} busy={historyBusy} onReview={(id) => { reviewHistory(id); setShowHistory(false); }} onCurrent={() => { reviewHistory(); setShowHistory(false); }} />
        {Boolean(state.previousAnswers?.length) && <section aria-label="Earlier answers"><h3>Earlier answers</h3><p className="assistant-help">Saved for comparison, not applied to your current idea.</p>{state.previousAnswers?.map((saved, index) => <p key={index}>{saved.answers.map((answer) => Array.isArray(answer.value) ? answer.value.join(', ') : answer.value).join(' · ')}</p>)}</section>}
      </div>}
      {historyError && <p className="assistant-shared-notice" role="alert">{historyError}</p>}
      {(controller.error || state.error || locked) && <div className="assistant-shared-notice">{(controller.error || state.error) && <p role="alert">{controller.error || state.error}</p>}{locked && <p role="status">Unlock the Story premise to change its direction.</p>}</div>}
      <div className="assistant-stage-host" style={{ display: showPlanning && !showHistory ? undefined : 'none' }}>
        {(state.confirmedBriefVersion || savedReview) && <StoryDevelopmentPanel embedded planningOnly open document={document} getDocument={getDocument} commit={commit} flush={flush} providerMode={providerMode}
          onClose={hide} owner={{ kind: 'story', id: project.projectId }} onAccepted={(ids) => { controller.change((value) => { value.collapsed = false; }); onScenesAccepted?.(ids ?? []); }} onReviseDirection={openManual} />}
      </div>
      <div className="assistant-stage-host" style={{ display: accepted && !manualDirection && !showHistory ? undefined : 'none' }}>{shotPlanning ?? (accepted && <div className="assistant-stage"><div className="assistant-stage-scroll"><h3>Scenes added</h3><p>Your scenes are saved. Scoped shot planning is not available in this workspace yet.</p></div></div>)}</div>
      {manualDirection && !showHistory && <StoryDevelopmentPanel embedded directionOnly open document={document} getDocument={getDocument} commit={commit} flush={flush} providerMode={providerMode} onClose={() => setManualDirection(false)} onDirectionApproved={() => setManualDirection(false)} owner={{ kind: 'story', id: project.projectId }} />}
      {(showAnalysis || showQuestions) && !manualDirection && !showHistory && <div className="assistant-stage">
        <div ref={scroll} className="assistant-stage-scroll">
          {controller.busy ? <><h3>Understanding your story</h3><p className="assistant-help">Your existing scenes stay unchanged.</p><ol className="assistant-real-progress" aria-label="Analysis progress">{controller.progress.length ? controller.progress.map((step) => <li key={step.step} data-state={step.status}>{step.status === 'completed' ? <Check size={15} /> : <span className="assistant-progress-ring" />}<span>{progressLabels[step.step]}</span></li>) : <li data-state="running"><span className="assistant-progress-ring" /><span>Preparing this approved request</span></li>}</ol></>
              : showQuestions ? <>
                <h3>{checkpoint.questions.length ? 'A quick check before we continue' : 'Here’s what I understood'}</h3>
                {questions.length > 0 && <p className="assistant-question-count">Question {Math.min(questionIndex + 1, questions.length)} of {questions.length}</p>}
                {!checkpoint.questions.length && <div className="assistant-understood-summary">{facts.map((fact) => <p key={fact.field}><strong>{fact.field === 'durationSeconds' && newMaterial ? 'New material (seconds)' : fieldLabels[fact.field]}:</strong> {Array.isArray(fact.value) ? fact.value.join(', ') : fact.value}{fact.origin === 'suggested' && <small> · suggested</small>}</p>)}</div>}
                <StructuredQuestions key={checkpoint.runId} questions={activeQuestion ? [activeQuestion] : []} answers={state.answers} disabled={controller.busy || locked} onChange={(answers) => controller.change((value) => { value.answers = answers; }, true)} />
                {!editingFacts && <button type="button" className="assistant-text-button" onClick={() => setEditingFacts(true)}>Correct understood details</button>}
              </> : <>
                <h3>{stale ? 'Review your updated idea' : state.state === 'cancelled' ? 'Your request was stopped' : 'Let’s shape your story'}</h3>
                <p>{stale ? 'Your idea changed. Review it once more; your earlier draft is saved.' : 'I’ll use your idea and ask only what’s missing.'}</p>
                <p className="assistant-help">{providerMode === 'live' ? 'One AI analysis of your premise, current scenes' : 'Includes your premise, current scenes'}{referenceTitles.length ? ` and ${referenceTitles.join(', ')}` : ' · no references'}. No web research, images or video.</p>
                {quoteError && <p role="alert" className="assistant-alert">{quoteError}</p>}
                {(quoteMatches ? quote.blockers : []).concat(manifest.blockers).map((message) => <p role="alert" className="assistant-alert" key={message}>{message}</p>)}
                {manifest.excluded.map((item) => <p className="assistant-help" key={item.referenceId}>Reference excluded: {item.reason}</p>)}
              </>}
        </div>
        <footer className="assistant-stage-footer">
          {controller.busy ? <><p className="assistant-help">Stopping locally may not cancel dispatched provider work.</p><button type="button" onClick={controller.cancel}>Stop request</button></>
              : showQuestions ? <><div className="assistant-footer-actions">{questionIndex > 0 && <button type="button" onClick={() => setQuestionIndex((index) => index - 1)}>Back</button>}<button className="primary-button" disabled={locked || providerMode === 'loading' || !canAdvance} onClick={() => { if (!lastQuestion) setQuestionIndex((index) => index + 1); else if (providerMode !== 'loading') void controller.execute(providerMode, null, false, controller.sourceIdentity, true); }}>{lastQuestion ? 'Continue' : !activeQuestion?.required && activeAnswer === undefined ? 'Skip' : 'Next'}<ArrowRight size={15} /></button></div><p className="assistant-help">No AI call. Your choices stay editable.</p></>
                : ['understanding', 'outcome-unknown'].includes(state.state) ? <><p className="assistant-help">Check the saved request. No duplicate call.</p><button className="primary-button" onClick={() => void controller.recover()}>Check saved analysis</button></>
                  : <><p className="assistant-help">{approvalCopy}</p>{quoteError || !quoteMatches ? <button type="button" disabled={providerMode === 'loading'} onClick={() => void refresh()}>Refresh availability</button> : <button className="primary-button" disabled={locked || !quote.ready || !manifest.ready} onClick={() => void controller.execute(providerMode, quote, true, controller.sourceIdentity)}>{providerMode === 'live' ? 'Approve & continue' : 'Continue'}<ArrowRight size={15} /></button>}</>}
        </footer>
      </div>}
    </div>
  </section>;
}
