import type { SwitchAudio } from '../audio/engine.js';
import type { KeyAnimator, KeyParts } from './animator.js';
import { cellAt, initialFocusIndex, navigate, type NavigationKey } from './layout.js';
import type { GraphLayout, KeyCell, KeyPressDetail } from './types.js';

export interface ProgrammaticPress {
  /** Play the switch sound (only audible once the user has interacted with the page). Default true. */
  sound?: boolean;
  /** Show the tooltip. Default false. */
  tooltip?: boolean;
  /** Half-travel, quieter press (used by ghost typing). Default false. */
  soft?: boolean;
  /** Fire `onKeyPress`. Default true. */
  notify?: boolean;
  /** How long the key is held down, in ms. Default 90. */
  hold?: number;
}

export interface InteractionSettings {
  ripple: boolean;
  tooltip: boolean;
}

export interface InteractionOptions extends InteractionSettings {
  grid: HTMLElement;
  fx: HTMLElement | null;
  layout: GraphLayout;
  animator: KeyAnimator;
  audio: SwitchAudio | null;
  onPress?: (detail: KeyPressDetail) => void;
  /** Show (cell + key element) or hide (null) the tooltip. */
  onTooltip?: (cell: KeyCell | null, key: HTMLElement | null) => void;
}

export interface InteractionController {
  /** Call after keys were re-rendered or morphed to a new layout. */
  setLayout(layout: GraphLayout): void;
  update(
    settings: Partial<InteractionSettings> & { audio?: SwitchAudio | null; animator?: KeyAnimator },
  ): void;
  press(index: number, options?: ProgrammaticPress): void;
  focus(index: number): void;
  keyElements(): readonly HTMLElement[];
  destroy(): void;
}

const NAV_KEYS = new Set<string>([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]);
const TOOLTIP_LINGER_MS = 2600;
const RIPPLE_RADIUS = 2.3;
const SOFT_DEPTH = 0.55;

function isActivationKey(key: string) {
  return key === 'Enter' || key === ' ' || key === 'Spacebar';
}

/**
 * Wire up a rendered grid: a handful of delegated listeners on the grid element
 * (never one per key), the press lifecycle, roving-tabindex keyboard navigation,
 * sounds, ripples and tooltip requests. Rendering is left to the caller.
 */
export function createInteractions(options: InteractionOptions): InteractionController {
  const { grid, fx } = options;
  let { layout, animator, audio } = options;
  const settings: InteractionSettings = { ripple: options.ripple, tooltip: options.tooltip };

  let keys: HTMLElement[] = [];
  const parts = new WeakMap<HTMLElement, KeyParts>();
  let active = -1;
  const pointers = new Map<number, number>();
  /** Active holds per key (pointer, keyboard and programmatic presses can overlap). */
  const holds = new Map<number, number>();
  let keyboardHeld = -1;
  let lastKeyboardActivation = 0;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  const programTimers = new Set<ReturnType<typeof setTimeout>>();

  const indexKeys = () => {
    keys = [];
    const found = grid.querySelectorAll<HTMLElement>('.kg-key[data-i]');
    for (const el of found) keys[Number(el.dataset.i)] = el;
  };

  const partsOf = (index: number): KeyParts | null => {
    const key = keys[index];
    if (!key) return null;
    let p = parts.get(key);
    if (!p) {
      const cap = key.querySelector<HTMLElement>('.kg-cap');
      const shadow = key.querySelector<HTMLElement>('.kg-shadow');
      if (!cap || !shadow) return null;
      p = { key, cap, shadow };
      parts.set(key, p);
    }
    return p;
  };

  const usable = (index: number) => {
    const cell = layout.cells[index];
    return cell !== undefined && !cell.future;
  };

  const setActive = (index: number) => {
    if (index === active || !keys[index]) return;
    if (keys[active]) keys[active]!.tabIndex = -1;
    keys[index]!.tabIndex = 0;
    active = index;
  };

  const syncRovingTabIndex = () => {
    // Exactly one key is tabbable; keep the previous one if it still exists.
    const target = usable(active) ? active : initialFocusIndex(layout);
    for (let i = 0; i < keys.length; i++) {
      const el = keys[i];
      if (el) el.tabIndex = i === target ? 0 : -1;
    }
    active = target;
  };

  const clearHide = () => {
    if (hideTimer !== undefined) clearTimeout(hideTimer);
    hideTimer = undefined;
  };

  const hideTooltip = () => {
    clearHide();
    options.onTooltip?.(null, null);
  };

  const showTooltip = (index: number) => {
    if (!settings.tooltip) return;
    clearHide();
    const cell = layout.cells[index];
    const key = keys[index];
    if (cell && key) options.onTooltip?.(cell, key);
  };

  const ripple = (cell: KeyCell, key: HTMLElement, depth: number) => {
    if (fx) {
      const x = key.offsetLeft + key.offsetWidth / 2;
      const y = key.offsetTop + key.offsetHeight / 2;
      animator.glow(fx, x, y, `var(--_level-${cell.level === 0 ? 2 : cell.level})`);
    }
    const r = Math.ceil(RIPPLE_RADIUS);
    for (let dc = -r; dc <= r; dc++) {
      for (let dr = -r; dr <= r; dr++) {
        if (dc === 0 && dr === 0) continue;
        const distance = Math.hypot(dc, dr);
        if (distance > RIPPLE_RADIUS) continue;
        const index = cellAt(layout, cell.col + dc, cell.row + dr);
        if (!usable(index)) continue;
        const p = partsOf(index);
        if (p)
          animator.nudge(p, depth * 0.32 * (1 - distance / (RIPPLE_RADIUS + 1)), distance * 30);
      }
    }
  };

  interface DownOptions {
    source: KeyPressDetail['source'];
    depth: number;
    sound: boolean;
    tooltip: boolean;
    notify: boolean;
    velocity: number;
  }

  const down = (index: number, o: DownOptions) => {
    const cell = layout.cells[index];
    const p = partsOf(index);
    if (!cell || cell.future || !p) return false;
    const held = holds.get(index) ?? 0;
    holds.set(index, held + 1);
    if (held === 0) {
      animator.press(p, o.depth);
      if (settings.ripple) ripple(cell, p.key, o.depth);
    }
    if (o.sound) audio?.play('down', o.velocity);
    if (o.tooltip) showTooltip(index);
    if (o.notify) {
      options.onPress?.({
        date: cell.date,
        count: cell.count,
        level: cell.level,
        col: cell.col,
        row: cell.row,
        source: o.source,
      });
    }
    return true;
  };

  const up = (index: number, depth: number, sound: boolean, velocity = 1) => {
    const p = partsOf(index);
    if (!p) return;
    const remaining = (holds.get(index) ?? 1) - 1;
    if (remaining > 0) {
      // Still held by another input: keep the key down.
      holds.set(index, remaining);
      return;
    }
    holds.delete(index);
    animator.release(p, depth);
    if (sound) audio?.play('up', velocity);
  };

  const keyIndexFrom = (target: EventTarget | null): number => {
    if (!(target instanceof Element)) return -1;
    const key = target.closest<HTMLElement>('.kg-key[data-i]');
    if (!key || !grid.contains(key)) return -1;
    return Number(key.dataset.i);
  };

  // ── Pointer ────────────────────────────────────────────────────────────────
  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const index = keyIndexFrom(event.target);
    if (index < 0 || pointers.has(event.pointerId)) return;
    audio?.unlock();
    if (
      !down(index, {
        source: 'pointer',
        depth: 1,
        sound: true,
        tooltip: true,
        notify: true,
        velocity: 1,
      })
    )
      return;
    pointers.set(event.pointerId, index);
    setActive(index);
    if (pointers.size === 1) {
      window.addEventListener('pointerup', onPointerUp, true);
      window.addEventListener('pointercancel', onPointerCancel, true);
    }
  };

  const finishPointer = (event: PointerEvent, sound: boolean) => {
    const index = pointers.get(event.pointerId);
    if (index === undefined) return;
    pointers.delete(event.pointerId);
    // Touch only grants audio permission on pointerup, so unlock again here.
    if (sound) audio?.unlock();
    up(index, 1, sound);
    if (settings.tooltip) {
      clearHide();
      hideTimer = setTimeout(hideTooltip, TOOLTIP_LINGER_MS);
    }
    if (pointers.size === 0) {
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('pointercancel', onPointerCancel, true);
    }
  };
  const onPointerUp = (event: PointerEvent) => finishPointer(event, true);
  const onPointerCancel = (event: PointerEvent) => finishPointer(event, false);

  // ── Keyboard ───────────────────────────────────────────────────────────────
  const onKeyDown = (event: KeyboardEvent) => {
    const index = keyIndexFrom(event.target);
    if (index < 0) return;

    if (NAV_KEYS.has(event.key)) {
      event.preventDefault();
      const next = navigate(
        layout,
        index,
        event.key as NavigationKey,
        event.ctrlKey || event.metaKey,
      );
      if (next !== index) {
        if (keyboardHeld >= 0) {
          up(keyboardHeld, 1, false);
          keyboardHeld = -1;
        }
        controller.focus(next);
      }
      return;
    }

    if (isActivationKey(event.key)) {
      event.preventDefault();
      lastKeyboardActivation = Date.now();
      if (event.repeat || keyboardHeld >= 0) return;
      audio?.unlock();
      if (
        down(index, {
          source: 'keyboard',
          depth: 1,
          sound: true,
          tooltip: true,
          notify: true,
          velocity: 1,
        })
      ) {
        keyboardHeld = index;
      }
      return;
    }

    if (event.key === 'Escape') hideTooltip();
  };

  const onKeyUp = (event: KeyboardEvent) => {
    if (!isActivationKey(event.key)) return;
    event.preventDefault();
    lastKeyboardActivation = Date.now();
    if (keyboardHeld < 0) return;
    up(keyboardHeld, 1, true);
    keyboardHeld = -1;
  };

  // Screen readers activate buttons with a synthetic click (detail === 0) and no
  // key/pointer events — give them the full press too.
  const onClick = (event: MouseEvent) => {
    if (event.detail !== 0 || Date.now() - lastKeyboardActivation < 600) return;
    const index = keyIndexFrom(event.target);
    if (index >= 0) controller.press(index, { tooltip: true });
  };

  const onFocusIn = (event: FocusEvent) => {
    const index = keyIndexFrom(event.target);
    if (index < 0) return;
    setActive(index);
    let keyboardFocus = true;
    try {
      keyboardFocus = (event.target as Element).matches(':focus-visible');
    } catch {
      // :focus-visible unsupported — assume keyboard.
    }
    if (keyboardFocus) showTooltip(index);
  };

  const onFocusOut = (event: FocusEvent) => {
    if (event.relatedTarget instanceof Node && grid.contains(event.relatedTarget)) return;
    if (keyboardHeld >= 0) {
      up(keyboardHeld, 1, false);
      keyboardHeld = -1;
    }
    hideTooltip();
  };

  const onContextMenu = (event: Event) => {
    // Long-press on touch would open the callout menu over the keys.
    if (keyIndexFrom(event.target) >= 0 && (event as PointerEvent).pointerType !== 'mouse')
      event.preventDefault();
  };

  grid.addEventListener('pointerdown', onPointerDown);
  grid.addEventListener('keydown', onKeyDown);
  grid.addEventListener('keyup', onKeyUp);
  grid.addEventListener('click', onClick);
  grid.addEventListener('focusin', onFocusIn);
  grid.addEventListener('focusout', onFocusOut);
  grid.addEventListener('contextmenu', onContextMenu);

  const controller: InteractionController = {
    setLayout(next) {
      layout = next;
      holds.clear();
      indexKeys();
      syncRovingTabIndex();
    },

    update(next) {
      if (next.ripple !== undefined) settings.ripple = next.ripple;
      if (next.tooltip !== undefined) {
        settings.tooltip = next.tooltip;
        if (!next.tooltip) hideTooltip();
      }
      if (next.audio !== undefined) audio = next.audio;
      if (next.animator) animator = next.animator;
    },

    press(index, o = {}) {
      const soft = o.soft ?? false;
      const depth = soft ? SOFT_DEPTH : 1;
      const velocity = soft ? 0.35 : 1;
      const sound = o.sound ?? true;
      // Inside a user gesture (e.g. a global keydown) this enables audio. Outside one,
      // unlock() refuses to create an AudioContext, so nothing gets queued.
      if (sound) audio?.unlock();
      const pressed = down(index, {
        source: 'program',
        depth,
        sound,
        tooltip: o.tooltip ?? false,
        notify: o.notify ?? true,
        velocity,
      });
      if (!pressed) return;
      const timer = setTimeout(() => {
        programTimers.delete(timer);
        up(index, depth, sound, velocity);
        if (o.tooltip) {
          clearHide();
          hideTimer = setTimeout(hideTooltip, TOOLTIP_LINGER_MS);
        }
      }, o.hold ?? 90);
      programTimers.add(timer);
    },

    focus(index) {
      if (!usable(index)) return;
      setActive(index);
      keys[index]?.focus();
    },

    keyElements: () => keys,

    destroy() {
      grid.removeEventListener('pointerdown', onPointerDown);
      grid.removeEventListener('keydown', onKeyDown);
      grid.removeEventListener('keyup', onKeyUp);
      grid.removeEventListener('click', onClick);
      grid.removeEventListener('focusin', onFocusIn);
      grid.removeEventListener('focusout', onFocusOut);
      grid.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('pointercancel', onPointerCancel, true);
      for (const timer of programTimers) clearTimeout(timer);
      programTimers.clear();
      clearHide();
      pointers.clear();
      holds.clear();
    },
  };

  controller.setLayout(layout);
  return controller;
}

/** Diagonal entrance wave: top-left first, sweeping to bottom-right. */
export function entranceDelays(layout: GraphLayout, msPerStep = 9): number[] {
  return layout.cells.map((cell) => Math.round((cell.col + cell.row * 1.6) * msPerStep));
}

/**
 * Per-key delays for a colour sweep radiating from a point in viewport coordinates
 * (e.g. the theme swatch that was clicked). Defaults to the grid's left edge.
 */
export function sweepDelays(
  layout: GraphLayout,
  gridRect: DOMRect | { left: number; top: number; width: number; height: number },
  origin: { x: number; y: number } | null,
  msPerKey = 12,
): number[] {
  const pitch = layout.columns > 0 ? gridRect.width / layout.columns : 1;
  const rowPitch = gridRect.height / 7;
  const ox = origin?.x ?? gridRect.left;
  const oy = origin?.y ?? gridRect.top + gridRect.height / 2;
  return layout.cells.map((cell) => {
    const cx = gridRect.left + (cell.col + 0.5) * pitch;
    const cy = gridRect.top + (cell.row + 0.5) * rowPitch;
    return Math.round((Math.hypot(cx - ox, cy - oy) / Math.max(1, pitch)) * msPerKey);
  });
}

/** Write sweep delays onto key elements (`--kg-delay`, read by the colour transition). */
export function applyDelays(
  keys: readonly (HTMLElement | undefined)[],
  delays: readonly number[],
): void {
  for (let i = 0; i < keys.length; i++) {
    keys[i]?.style.setProperty('--kg-delay', `${delays[i] ?? 0}ms`);
  }
}
