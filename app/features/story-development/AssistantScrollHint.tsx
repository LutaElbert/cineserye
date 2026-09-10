'use client';
import { useEffect, useState, type RefObject } from 'react';
import { assistantScrollSurface } from './assistant-scroll';

/** Visual scroll affordance only: never resizes, pans or zooms the graph. */
export function AssistantScrollHint({ target, stage }: { target: RefObject<HTMLDivElement | null>; stage: string }) {
  const [more, setMore] = useState(false);
  useEffect(() => {
    const content = target.current;
    if (!content) return;
    let frame = 0;
    const surface = assistantScrollSurface(content) ?? content;
    const update = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => setMore(surface.scrollHeight - surface.scrollTop - surface.clientHeight > 12)); };
    const size = new ResizeObserver(update);
    size.observe(surface); size.observe(content);
    const mutation = new MutationObserver(update);
    mutation.observe(content, { childList: true, subtree: true, characterData: true });
    surface.addEventListener('scroll', update, { passive: true }); update();
    return () => { cancelAnimationFrame(frame); size.disconnect(); mutation.disconnect(); surface.removeEventListener('scroll', update); };
  }, [target, stage]);
  return more ? <span className="assistant-scroll-hint" aria-hidden="true">Scroll for more ↓</span> : null;
}
