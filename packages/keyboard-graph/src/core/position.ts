import { placeTooltip } from './tooltip.js';

/**
 * Keep a visible tooltip glued to its key while the page or the graph scrolls, or
 * the viewport resizes. Updates are rAF-throttled. Hides via `onLost` when the key
 * scrolls fully out of view. Returns a cleanup function.
 */
export function trackTooltip(tooltip: HTMLElement, key: Element, onLost: () => void): () => void {
  let frame = 0;
  const update = () => {
    frame = 0;
    if (!key.isConnected) return onLost();
    const rect = key.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
      return onLost();
    }
    placeTooltip(tooltip, key);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  window.addEventListener('scroll', schedule, { capture: true, passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  return () => {
    if (frame) cancelAnimationFrame(frame);
    window.removeEventListener('scroll', schedule, true);
    window.removeEventListener('resize', schedule);
  };
}
