'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import type { ClackyHandle } from 'clacky/react';

/** Physical QWERTY rows, their stagger, and the graph row each one plays on. */
const ROWS = ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const STAGGER = [0, 0.5, 0.8, 1.3];
const GRAPH_ROWS = [0, 2, 4, 6];
const SPAN = 9.5;

export function keyToCell(key: string, columns: number): { col: number; row: number } | null {
  const k = key.toLowerCase();
  for (let r = 0; r < ROWS.length; r++) {
    const i = ROWS[r]!.indexOf(k);
    if (i < 0) continue;
    const x = (i + STAGGER[r]!) / SPAN;
    return { col: Math.round(x * (columns - 1)), row: GRAPH_ROWS[r]! };
  }
  return null;
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

/**
 * Easter egg: typing on your physical keyboard presses the matching region of the
 * graph, laid out like a QWERTY board. Returns the recently typed text.
 */
export function useTypeToPlay(graph: RefObject<ClackyHandle | null>, enabled = true) {
  const [typed, setTyped] = useState('');
  const clearTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.repeat ||
        isTypingTarget(event.target)
      )
        return;
      const handle = graph.current;
      if (!handle) return;
      const columns = handle.getColumns();
      if (!columns) return;

      let pressed = false;
      if (event.key === ' ' && !(event.target instanceof HTMLButtonElement)) {
        // The space bar plays a quick run across the bottom row.
        const start = Math.round(columns * 0.32);
        const end = Math.round(columns * 0.68);
        for (let col = start; col <= end; col++) {
          setTimeout(
            () => handle.pressAt(col, 6, { sound: col === start, notify: false }),
            (col - start) * 14,
          );
        }
        pressed = true;
      } else {
        const cell = keyToCell(event.key, columns);
        if (cell) {
          handle.pressAt(cell.col, cell.row, { notify: false, hold: 110 });
          pressed = true;
        }
      }
      if (!pressed) return;
      if (event.key === ' ') event.preventDefault();
      setTyped((t) => (t + (event.key === ' ' ? ' ' : event.key)).slice(-18));
      clearTimeout(clearTimer.current);
      clearTimer.current = setTimeout(() => setTyped(''), 1600);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      clearTimeout(clearTimer.current);
    };
  }, [graph, enabled]);

  return typed;
}
