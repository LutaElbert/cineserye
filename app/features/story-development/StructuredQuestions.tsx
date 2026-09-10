'use client';
import { useState } from 'react';
import type { AssistantAnswer, AssistantQuestion } from '../../domain/cinema/story-assistant';

const customLines = (text: string) => text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => line.slice(0, 500)).slice(0, 30);

export function StructuredQuestions({ questions, answers, onChange, disabled = false }: {
  questions: AssistantQuestion[]; answers: AssistantAnswer[]; onChange: (answers: AssistantAnswer[]) => void; disabled?: boolean;
}) {
  const [customDrafts, setCustomDrafts] = useState<Record<string, string>>({});
  const set = (questionId: string, value: AssistantAnswer['value'] | null) => onChange([
    ...answers.filter((answer) => answer.questionId !== questionId), ...(value === null ? [] : [{ questionId, value }]),
  ]);
  return <div className="assistant-questions">
    {questions.some((question) => !question.required) && <p className="assistant-help">Optional questions can be skipped. Continue keeps your current direction.</p>}
    {questions.map((question) => {
    const value = answers.find((answer) => answer.questionId === question.id)?.value;
    const customValues = question.type === 'multi-choice' && Array.isArray(value) ? value.filter((item) => !question.choices.some((choice) => choice.label === item)) : [];
    const rawCustom = customDrafts[question.id];
    const customLabel = question.field === 'genres' ? 'Other genres (one per line)' : 'Other constraints (one per line)';
    // Preserve a trailing newline while typing, but reflect external undo/reset values.
    const customText = rawCustom !== undefined && JSON.stringify(customLines(rawCustom)) === JSON.stringify(customValues) ? rawCustom : customValues.join('\n');
    return <fieldset key={question.id} disabled={disabled}>
      <legend>{question.label} <span className="assistant-help">{question.required ? '(Required)' : '(Optional)'}</span></legend>
      {question.required && question.reason && <p className="assistant-help">{question.reason}</p>}
      {question.type === 'single-choice' && <div className="assistant-answer-cards" role="radiogroup" aria-label={question.label}>
        {question.choices.map((choice) => <label key={choice.id} className="assistant-answer-card" data-selected={value === choice.label}>
          <input type="radio" name={question.id} value={choice.label} checked={value === choice.label} onChange={() => set(question.id, choice.label)} />
          <span>{choice.label}</span>{choice.recommended && <small>Suggested</small>}
        </label>)}
      </div>}
      {question.type === 'number' && <>
        {question.field === 'durationSeconds' && <div className="assistant-duration-choices">{[15, 30, 60].filter((seconds) => seconds >= question.min && seconds <= question.max).map((seconds) => <button type="button" key={seconds} aria-pressed={value === seconds} onClick={() => set(question.id, seconds)}>{seconds}s</button>)}</div>}
        <label>Custom seconds<input aria-label={question.label} type="number" min={question.min} max={question.max} value={typeof value === 'number' ? value : ''}
        onChange={(event) => { if (!event.target.value) set(question.id, null); else if (event.target.validity.valid) set(question.id, Number(event.target.value)); }} /></label>
      </>}
      {question.type === 'text' && <label><textarea aria-label={question.label} maxLength={question.maxLength} value={typeof value === 'string' ? value : ''}
        onChange={(event) => set(question.id, event.target.value.trim() ? event.target.value : null)} /></label>}
      {question.type === 'multi-choice' && <>
        {question.field === 'genres' && <p className="assistant-help">Choose up to 5 genres.</p>}
        <div className="assistant-answer-cards">{question.choices.map((choice) => <label key={choice.id} className="assistant-answer-card" data-selected={Array.isArray(value) && value.includes(choice.label)}><input type="checkbox" checked={Array.isArray(value) && value.includes(choice.label)}
          onChange={(event) => {
            const next = Array.isArray(value) ? value : [];
            set(question.id, event.target.checked ? choice.label === 'No restrictions' ? ['No restrictions'] : [...next.filter((item) => item !== 'No restrictions'), choice.label] : next.filter((item) => item !== choice.label));
          }} /><span>{choice.label}</span>{choice.recommended && <small>Suggested</small>}</label>)}</div>
        <label>{customLabel}<textarea aria-label={customLabel} maxLength={2000} value={customText}
          onChange={(event) => {
            const text = event.target.value; setCustomDrafts((drafts) => ({ ...drafts, [question.id]: text }));
            set(question.id, [...(Array.isArray(value) ? value.filter((item) => question.choices.some((choice) => choice.label === item) && item !== 'No restrictions') : []), ...customLines(text)].slice(0, 30));
          }} /></label>
      </>}
    </fieldset>;
  })}</div>;
}
