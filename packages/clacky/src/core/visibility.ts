/**
 * Run `callback` once the element is at least partly on screen (immediately when
 * IntersectionObserver is unavailable). Used to start the entrance wave only when
 * the graph is actually visible. Returns a cleanup function.
 */
export function whenVisible(el: Element, callback: () => void, threshold = 0.15): () => void {
  if (typeof IntersectionObserver !== 'function') {
    callback();
    return () => undefined;
  }
  let done = false;
  const observer = new IntersectionObserver(
    (entries) => {
      if (done || !entries.some((e) => e.isIntersecting)) return;
      done = true;
      observer.disconnect();
      callback();
    },
    { threshold },
  );
  observer.observe(el);
  return () => {
    done = true;
    observer.disconnect();
  };
}

/** When the board overflows its scroller, show the most recent weeks (like GitHub on mobile). */
export function scrollToLatest(scroller: HTMLElement | null): void {
  if (scroller && scroller.scrollWidth > scroller.clientWidth + 1) {
    scroller.scrollLeft = scroller.scrollWidth;
  }
}
