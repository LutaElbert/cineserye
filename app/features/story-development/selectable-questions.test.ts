// @vitest-environment jsdom
import { useState, createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { StructuredQuestions } from './StructuredQuestions';
import type { AssistantAnswer, AssistantQuestion } from '../../domain/cinema/story-assistant';

afterEach(cleanup);
function Harness({ questions }: { questions: AssistantQuestion[] }) {
  const [answers, setAnswers] = useState<AssistantAnswer[]>([]);
  return createElement(StructuredQuestions, { questions, answers, onChange: setAnswers });
}
describe('direct question choices', () => {
  it('uses radio cards without preselecting recommendations or exposing a dropdown', () => {
    const questions: AssistantQuestion[] = [{ id: 'format', field: 'aspectRatio', type: 'single-choice', required: true, label: 'Frame', reason: '', choices: [
      { id: 'vertical', label: '9:16', recommended: true }, { id: 'wide', label: '16:9', recommended: false },
    ] }];
    const view = render(createElement(Harness, { questions }));
    expect(view.container.querySelectorAll('select, details, input:checked').length).toBe(0);
    fireEvent.click(screen.getByText('9:16'));
    expect((screen.getByRole('radio', { name: /9:16/ }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByText('16:9'));
    expect((screen.getByRole('radio', { name: /9:16/ }) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByRole('radio', { name: '16:9' }) as HTMLInputElement).checked).toBe(true);
  });
  it('preserves custom multi-choice constraints while selecting another card', () => {
    render(createElement(Harness, { questions: [{ id: 'limits', field: 'constraints', type: 'multi-choice', required: false, label: 'Limits', reason: '', choices: [
      { id: 'none', label: 'No restrictions', recommended: false }, { id: 'room', label: 'One room', recommended: false },
    ] }] }));
    fireEvent.change(screen.getByLabelText('Other constraints (one per line)'), { target: { value: 'All four survive' } });
    fireEvent.click(screen.getByText('One room'));
    expect((screen.getByLabelText('Other constraints (one per line)') as HTMLTextAreaElement).value).toBe('All four survive');
    fireEvent.click(screen.getByText('No restrictions'));
    expect((screen.getByRole('checkbox', { name: 'One room' }) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText('Other constraints (one per line)') as HTMLTextAreaElement).value).toBe('');
  });
  it('allows a duration preset and a custom duration without submitting', () => {
    render(createElement(Harness, { questions: [{ id: 'time', field: 'durationSeconds', type: 'number', min: 1, max: 86400, required: true, label: 'Runtime', reason: '' }] }));
    fireEvent.click(screen.getByRole('button', { name: '30s' }));
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('30');
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '12' } });
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('12');
    expect(screen.getByRole('button', { name: '30s' }).getAttribute('aria-pressed')).toBe('false');
  });
});
