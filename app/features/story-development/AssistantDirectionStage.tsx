'use client';
import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { fieldLabels, questionsFor, type AssistantFieldKey, type AssistantQuestion } from '../../domain/cinema/story-assistant';
import type { StoryWorkflowData } from '../../domain/cinema/story-workflow';
import { StructuredQuestions } from './StructuredQuestions';

type Draft = NonNullable<StoryWorkflowData['draft']>;
const fields = ['aspectRatio', 'durationSeconds', 'tone', 'ending', 'constraints', 'genres'] as const;

/** Local corrections only. The owner validates and records approval; no provider access here. */
export function AssistantDirectionStage({ draft, error, busy, onChange, onConfirm, onBack }: {
  draft: Draft; error: string; busy: boolean; onChange: (patch: Partial<Draft>) => void;
  onConfirm: () => void; onBack: () => void;
}) {
  const [field, setField] = useState<AssistantFieldKey | null>(null);
  const question: AssistantQuestion | undefined = field ? questionsFor({ version: 1, facts: [], conflicts: [field] }, 3)[0] : undefined;
  const value = field ? draft[field as typeof fields[number]] : undefined;
  return <div className="assistant-stage">
    <div className="assistant-stage-scroll">
      <h3>Edit direction</h3><p className="assistant-help">Choose a detail to change. Everything else stays as it is.</p>
      {error && <p role="alert" className="assistant-alert">{error}</p>}
      {question ? <StructuredQuestions questions={[question]} answers={value == null ? [] : [{ questionId: question.id, value }]}
        disabled={busy} onChange={(answers) => onChange({ [question.field]: answers[0]?.value ?? (question.type === 'multi-choice' ? [] : question.type === 'number' ? null : '') })} />
        : <div className="assistant-direction-list">{fields.map((key) => <button type="button" key={key} disabled={busy} onClick={() => setField(key)}>
          <span><small>{key === 'durationSeconds' && draft.mode === 'continue' ? 'New material (seconds)' : fieldLabels[key]}</small><strong>{Array.isArray(draft[key]) ? draft[key].join(' · ') || 'Not set' : draft[key] || 'Not set'}</strong></span><Pencil size={14} />
        </button>)}</div>}
    </div>
    <footer className="assistant-stage-footer"><div className="assistant-footer-actions">
      <button type="button" disabled={busy} onClick={() => field ? setField(null) : onBack()}>Back</button>
      <button type="button" className="primary-button" disabled={busy} onClick={() => field ? setField(null) : onConfirm()}>{field ? 'Done' : 'Confirm direction'}</button>
    </div><p className="assistant-help">Saved locally · no AI call</p></footer>
  </div>;
}
