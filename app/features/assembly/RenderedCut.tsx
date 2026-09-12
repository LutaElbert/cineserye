'use client';
import { useState } from 'react';

/** Mount keyed by the object URL: a new export starts a new browser decode. */
export function RenderedCut({ url, duration }: { url: string; duration: string }) {
  const [preview, setPreview] = useState<'loading' | 'ready' | 'error'>('loading');
  return <div className="sequence-review-result">
    <strong>Verified silent cut · {duration}s</strong>
    <video src={url} controls playsInline preload="metadata" aria-label="Rendered silent sequence"
      onLoadedMetadata={() => setPreview('ready')} onError={() => setPreview('error')} />
    {preview !== 'ready' ? <p role="status">{preview === 'loading' ? 'Loading the browser preview. The locally verified movie is available to download.'
      : 'This browser could not preview the movie. Download the locally verified MP4 to keep it.'}</p> : null}
    <a href={url} download="cineserye-sequence.mp4">Download verified MP4</a>
    <small>Download to keep this export. It is not stored in the project backup.</small>
  </div>;
}
