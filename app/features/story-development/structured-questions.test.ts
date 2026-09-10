import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StructuredQuestions } from './StructuredQuestions';

describe('question requirement disclosure', () => {
  it('labels optional questions and explains the no-answer Continue behavior', () => {
    const html = renderToStaticMarkup(createElement(StructuredQuestions, { questions: [
      { id: 'ending', field: 'ending', type: 'text', maxLength: 500, required: false, label: 'Final beat', reason: 'Choose an ending.' },
    ], answers: [], onChange: () => undefined }));
    expect(html).toContain('(Optional)');
    expect(html).toContain('Optional questions can be skipped. Continue keeps your current direction.');
  });
  it('clearly labels required questions without offering a skip', () => {
    const html = renderToStaticMarkup(createElement(StructuredQuestions, { questions: [
      { id: 'runtime', field: 'durationSeconds', type: 'number', min: 1, max: 86400, required: true, label: 'Runtime', reason: 'Set total seconds.' },
    ], answers: [], onChange: () => undefined }));
    expect(html).toContain('(Required)');
    expect(html).not.toContain('can be skipped');
  });
});
