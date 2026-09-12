// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { RenderedCut } from './RenderedCut';

afterEach(cleanup);
it('requests metadata explicitly and distinguishes server verification from browser readiness', () => {
  render(createElement(RenderedCut, { url: 'blob:verified', duration: '6' }));
  const video = screen.getByLabelText('Rendered silent sequence');
  expect(video.getAttribute('preload')).toBe('metadata');
  expect(screen.getByRole('status').textContent).toContain('Loading the browser preview');
  expect(screen.getByRole('link', { name: 'Download verified MP4' }).getAttribute('href')).toBe('blob:verified');
  fireEvent.loadedMetadata(video); expect(screen.queryByRole('status')).toBeNull();
  fireEvent.error(video); expect(screen.getByRole('status').textContent).toContain('could not preview');
});
it('a new keyed export resets preview state without removing the verified download', () => {
  const view = render(createElement(RenderedCut, { key: 'first', url: 'blob:first', duration: '6' }));
  fireEvent.loadedMetadata(screen.getByLabelText('Rendered silent sequence'));
  view.rerender(createElement(RenderedCut, { key: 'second', url: 'blob:second', duration: '7' }));
  expect(screen.getByRole('status').textContent).toContain('Loading the browser preview');
  expect(screen.getByRole('link', { name: 'Download verified MP4' }).getAttribute('href')).toBe('blob:second');
});
