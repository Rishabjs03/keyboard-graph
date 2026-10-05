export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface TooltipPosition {
  x: number;
  y: number;
  placement: 'top' | 'bottom';
  /** Arrow position from the tooltip's left edge, in px. */
  arrowX: number;
}

export interface TooltipPositionOptions {
  /** Distance between key and tooltip. */
  offset?: number;
  /** Minimum distance from the viewport edges. */
  margin?: number;
}

/**
 * Place the tooltip above the key (or below when there is no room), centred on it
 * and clamped so it never leaves the viewport. The arrow keeps pointing at the key
 * even when the body is shifted by the clamp.
 */
export function computeTooltipPosition(
  anchor: Rect,
  tooltip: { width: number; height: number },
  viewport: { width: number; height: number },
  { offset = 10, margin = 8 }: TooltipPositionOptions = {},
): TooltipPosition {
  const centerX = anchor.left + anchor.width / 2;
  const spaceAbove = anchor.top - margin;
  const spaceBelow = viewport.height - (anchor.top + anchor.height) - margin;
  const needed = tooltip.height + offset;

  const placement: TooltipPosition['placement'] =
    spaceAbove >= needed || spaceAbove >= spaceBelow ? 'top' : 'bottom';

  let y = placement === 'top' ? anchor.top - offset - tooltip.height : anchor.top + anchor.height + offset;
  y = Math.max(margin, Math.min(y, viewport.height - margin - tooltip.height));

  const maxX = Math.max(margin, viewport.width - margin - tooltip.width);
  const x = Math.max(margin, Math.min(centerX - tooltip.width / 2, maxX));

  const arrowInset = Math.min(12, tooltip.width / 2);
  const arrowX = Math.max(arrowInset, Math.min(centerX - x, tooltip.width - arrowInset));

  return { x: Math.round(x), y: Math.round(y), placement, arrowX: Math.round(arrowX) };
}

/** Position a rendered tooltip element next to a key. Shared by both wrappers. */
export function placeTooltip(tooltip: HTMLElement, key: Element): TooltipPosition {
  const anchor = key.getBoundingClientRect();
  const position = computeTooltipPosition(
    anchor,
    { width: tooltip.offsetWidth, height: tooltip.offsetHeight },
    { width: document.documentElement.clientWidth, height: window.innerHeight },
  );
  tooltip.style.left = `${position.x}px`;
  tooltip.style.top = `${position.y}px`;
  tooltip.style.setProperty('--_ax', `${position.arrowX}px`);
  tooltip.dataset.placement = position.placement;
  return position;
}

export function supportsPopover(el: HTMLElement): boolean {
  return typeof el.showPopover === 'function';
}

/** Promote to the top layer (immune to overflow clipping and transformed ancestors). */
export function showInTopLayer(el: HTMLElement): void {
  if (supportsPopover(el)) {
    if (!el.matches(':popover-open')) {
      try {
        el.showPopover();
      } catch {
        // Element not connected yet, or popover unsupported in this context.
      }
    }
  } else {
    el.hidden = false;
  }
}

export function hideFromTopLayer(el: HTMLElement): void {
  if (supportsPopover(el)) {
    try {
      if (el.matches(':popover-open')) el.hidePopover();
    } catch {
      // Already hidden.
    }
  } else {
    el.hidden = true;
  }
}
