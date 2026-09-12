'use client';

import { useEffect, useState } from 'react';
import { Film, ImageIcon, FileText } from 'lucide-react';
import type { CinemaProjectData, CinemaShotRecord } from '../../domain/cinema/project-data';
import { loadLocalMediaBlob } from '../../editor/persistence';
import { selectShotMediaPreview } from './shot-media-selection';
import './shot-media-preview.css';

/** Read-only local media surface. Dimensions stay fixed while bytes load. */
export function ShotMediaPreview({ cinema, shot, compact = false, emptyDescription = 'Review the image settings below, then generate a storyboard.' }: { cinema: CinemaProjectData; shot: CinemaShotRecord; compact?: boolean; emptyDescription?: string }) {
  const selected = selectShotMediaPreview(cinema, shot);
  // Compact cards show the storyboard thumbnail, never a tiny unusable player.
  // The full expanded node retains the approved clip's real video controls.
  const primary = compact ? selected.image : selected.clip ?? selected.image;
  const key = primary ? `${compact ? 'compact' : 'full'}:${selected.stage}:${primary.id}:${primary.blobHash}` : 'plan';
  const hash = primary?.blobHash ?? null;
  const expectedType = primary?.mimeType ?? null;
  const clipHash = compact ? selected.clip?.blobHash ?? null : null;
  const [loaded, setLoaded] = useState<{ key: string; url: string | null; failed: boolean; clipMissing?: boolean } | null>(null);
  const media = loaded?.key === key ? loaded : null;
  useEffect(() => {
    if (!hash) return;
    let disposed = false;
    let objectUrl: string | null = null;
    void Promise.all([loadLocalMediaBlob(hash), clipHash ? loadLocalMediaBlob(clipHash) : Promise.resolve(null)]).then(([record, clipRecord]) => {
      if (disposed) return;
      const clipMissing = Boolean(clipHash && (!clipRecord || clipRecord.mimeType !== 'video/mp4' || !clipRecord.blob.size));
      if (!record || record.blob.size < 1 || record.mimeType !== expectedType) { setLoaded({ key, url: null, failed: true }); return; }
      objectUrl = URL.createObjectURL(record.blob);
      setLoaded({ key, url: objectUrl, failed: false, clipMissing });
    }).catch(() => { if (!disposed) setLoaded({ key, url: null, failed: true }); });
    return () => { disposed = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [key, hash, expectedType, clipHash]);
  const Icon = selected.stage === 'video' ? Film : selected.stage === 'image' ? ImageIcon : FileText;
  const missing = media?.failed || media?.clipMissing;
  return <section className={`shot-media-preview shot-media-${selected.stage}${compact ? ' shot-media-preview-compact' : ''}`} aria-label={`Media for ${shot.title}`} data-media-stage={selected.stage}>
    <header><Icon size={12} aria-hidden="true" /><span>{missing ? media?.clipMissing ? 'Video · Local file missing' : compact && selected.clip ? 'Video · Thumbnail missing' : `${selected.stage === 'video' ? 'Video' : 'Image'} · Local file missing` : selected.label}</span></header>
    <div className="shot-media-preview-surface">
      {media?.url && selected.clip && !compact ? <video className="nodrag nopan" src={media.url} controls playsInline muted preload="metadata" aria-label={`Approved video take for ${shot.title}`}
        onDoubleClick={(event) => event.stopPropagation()}
        onError={() => setLoaded({ key, url: null, failed: true })} /> : media?.url && selected.image ?
        // An image optimizer would upload local content. Keep the original blob URL.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media.url} alt={`${selected.image.status === 'approved' ? 'Approved' : 'Candidate'} storyboard for ${shot.title}`} draggable={false}
          onError={() => setLoaded({ key, url: null, failed: true })} /> : <span>
          {compact ? <Icon size={19} aria-hidden="true" /> : missing ? 'This browser no longer has the media. Restore or regenerate this take.' : primary ? 'Loading local preview…' : selected.hasPreviousMedia ? 'Previous media is retained in history. Review it against the current plan.' : emptyDescription}
        </span>}
      {compact && selected.clip && media?.url ? <span className="shot-media-video-mark" aria-hidden="true"><Film size={10} /></span> : null}
    </div>
    <small>{missing ? 'Expand to review missing media' : compact && selected.clip ? 'Image thumbnail · expand to play' : selected.clip ? 'Silent clip · original image retained' : selected.image?.status === 'candidate' ? 'Review before animating' : selected.image ? 'Ready to animate this frame' : `${shot.durationSeconds}s planned · no media generated`}</small>
  </section>;
}
