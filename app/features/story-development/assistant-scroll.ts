/** Short nodes share one outer scroller; normal nodes scroll their active stage. */
export function assistantScrollSurface(element: HTMLElement | null): HTMLElement | null {
  let current = element;
  while (current && !current.classList.contains('story-assistant-node')) {
    if (current.clientHeight > 0 && /auto|scroll/.test(getComputedStyle(current).overflowY)) return current;
    current = current.parentElement;
  }
  return element;
}

/** Reserve the measured action row, without changing graph or React state. */
export function useAssistantFooterSize(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let frame = 0;
    const measured = new Set<Element>();
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const visible = [...node.querySelectorAll<HTMLElement>('.assistant-stage-footer')].find((footer) => footer.getClientRects().length);
        const value = `${visible?.offsetHeight ?? 0}px`;
        if (node.style.getPropertyValue('--assistant-footer-size') !== value) node.style.setProperty('--assistant-footer-size', value);
      });
    };
    const size = new ResizeObserver(update);
    const observe = () => {
      for (const footer of node.querySelectorAll('.assistant-stage-footer')) {
        if (!measured.has(footer)) { measured.add(footer); size.observe(footer); }
      }
      for (const footer of measured) { if (!node.contains(footer)) { measured.delete(footer); size.unobserve(footer); } }
      update();
    };
    const changes = new MutationObserver(observe);
    changes.observe(node, { childList: true, subtree: true });
    observe();
    return () => { cancelAnimationFrame(frame); changes.disconnect(); size.disconnect(); };
  }, [ref]);
}
import { useEffect, type RefObject } from 'react';
