import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  version as reactVersion,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { SwitchAudio } from '../audio/engine.js';
import type { KeyboardGraphError } from '../core/data.js';
import { localToday } from '../core/format.js';
import { createGhostTyper } from '../core/ghost.js';
import type { KeyboardGraphHandle } from '../core/handle.js';
import {
  applyDelays,
  createInteractions,
  entranceDelays,
  sweepDelays,
  type InteractionController,
} from '../core/interactions.js';
import { buildLayout, cellAt, initialFocusIndex, sameGeometry } from '../core/layout.js';
import {
  frameStyleVars,
  rootDataAttributes,
  rootStyleVars,
  themeStyleVars,
  transitionSettings,
  withDefaults,
  yearOptions,
  type KeyboardGraphOptions,
  type ResolvedOptions,
} from '../core/options.js';
import { trackTooltip } from '../core/position.js';
import {
  ariaLabelFor,
  gridLabel,
  KEYBOARD_HINT,
  SKELETON_COLUMNS,
  tooltipParts,
  totalLabel,
} from '../core/render.js';
import { keyboardGraphCSS } from '../core/styles.js';
import { placeTooltip, showInTopLayer } from '../core/tooltip.js';
import { formatYearOption } from '../core/format.js';
import type {
  GraphLayout,
  KeyCell,
  KeyPressDetail,
  LoadDetail,
  YearSelection,
} from '../core/types.js';
import { scrollToLatest, whenVisible } from '../core/visibility.js';
import { createMotionAnimator } from './motionAnimator.js';
import { useContributions } from './useContributions.js';

export interface KeyboardGraphProps
  extends
    KeyboardGraphOptions,
    Omit<
      HTMLAttributes<HTMLDivElement>,
      keyof KeyboardGraphOptions | 'onLoad' | 'onError' | 'onKeyPress' | 'children'
    > {
  /** Fired when a key is pressed (pointer, keyboard, or programmatic). */
  onKeyPress?: (day: KeyPressDetail) => void;
  /** Fired when data has loaded. */
  onLoad?: (detail: LoadDetail) => void;
  onError?: (error: KeyboardGraphError) => void;
  /** Fired when the built-in year selector changes the year. */
  onYearChange?: (year: YearSelection) => void;
}

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;
const supportsHoistedStyles = Number.parseInt(reactVersion, 10) >= 19;

function useLatest<T>(value: T) {
  const ref = useRef(value);
  useIsoLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}

const subscribeMotion = (onChange: () => void) => {
  const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
};
const getMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const getServerMotion = () => null;

const noopSubscribe = () => () => undefined;
const getServerToday = () => undefined;

/** The stylesheet. React 19 hoists and de-duplicates it into <head> (SSR included). */
function Styles() {
  if (supportsHoistedStyles) {
    return (
      <style href="keyboard-graph" precedence="medium">
        {keyboardGraphCSS}
      </style>
    );
  }
  return <style dangerouslySetInnerHTML={{ __html: keyboardGraphCSS }} />;
}

function KeyParts() {
  return (
    <>
      <span className="kg-shadow" />
      <span className="kg-skirt" />
      <span className="kg-cap" />
    </>
  );
}

interface BoardProps {
  layout: GraphLayout;
  labels: string[];
  showMonthLabels: boolean;
  showDayLabels: boolean;
  label: string;
  hintId: string;
  gridRef: (el: HTMLDivElement | null) => void;
}

/** ~370 keys rendered once; presses never re-render React (they are imperative). */
const Board = memo(function Board({
  layout,
  labels,
  showMonthLabels,
  showDayLabels,
  label,
  hintId,
  gridRef,
}: BoardProps) {
  const focus = initialFocusIndex(layout);
  return (
    <div
      className="kg-board"
      data-days={showDayLabels ? '' : undefined}
      data-months={showMonthLabels ? '' : undefined}
    >
      {showMonthLabels && (
        <div className="kg-months" aria-hidden="true">
          {layout.months.map((m) => (
            <span key={m.col} className="kg-month" style={{ gridColumn: m.col + 1 }}>
              {m.label}
            </span>
          ))}
        </div>
      )}
      {showDayLabels && (
        <div className="kg-weekdays" aria-hidden="true">
          {layout.weekdays.map((d) => (
            <span key={d.row} className="kg-weekday" style={{ gridRow: d.row + 1 }}>
              {d.label}
            </span>
          ))}
        </div>
      )}
      <div
        ref={gridRef}
        className="kg-grid"
        role="group"
        aria-label={label}
        aria-describedby={hintId}
      >
        <div className="kg-fx" aria-hidden="true" />
        {layout.cells.map((cell) => (
          <button
            // Keyed by position so a new year with the same shape morphs in place.
            key={`${cell.col}:${cell.row}`}
            type="button"
            className="kg-key"
            data-i={cell.index}
            data-level={cell.level}
            data-future={cell.future ? '' : undefined}
            aria-disabled={cell.future || undefined}
            aria-label={labels[cell.index]}
            tabIndex={cell.index === focus ? 0 : -1}
            style={{ gridArea: `${cell.row + 1} / ${cell.col + 1}` }}
          >
            <KeyParts />
          </button>
        ))}
      </div>
    </div>
  );
});

const Skeleton = memo(function Skeleton({ showDayLabels }: { showDayLabels: boolean }) {
  const keys = [];
  for (let col = 0; col < SKELETON_COLUMNS; col++) {
    for (let row = 0; row < 7; row++) {
      keys.push(
        <span
          key={`${col}:${row}`}
          className="kg-key"
          data-skeleton=""
          style={
            { gridArea: `${row + 1} / ${col + 1}`, '--d': `${(col + row) * 24}ms` } as CSSProperties
          }
        >
          <KeyParts />
        </span>,
      );
    }
  }
  return (
    <div className="kg-board" data-days={showDayLabels ? '' : undefined}>
      <div className="kg-grid" aria-hidden="true">
        {keys}
      </div>
    </div>
  );
});

function Legend() {
  return (
    <div className="kg-legend" aria-hidden="true">
      <span className="kg-legend-label">Less</span>
      {[0, 1, 2, 3, 4].map((level) => (
        <span key={level} className="kg-key" data-level={level}>
          <KeyParts />
        </span>
      ))}
      <span className="kg-legend-label">More</span>
    </div>
  );
}

interface TooltipState {
  cell: KeyCell;
  key: HTMLElement;
}

function Tooltip({
  state,
  options,
  reduced,
  onLost,
}: {
  state: TooltipState;
  options: ResolvedOptions;
  reduced: boolean;
  onLost: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onLostRef = useLatest(onLost);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    showInTopLayer(el);
    placeTooltip(el, state.key);
    return trackTooltip(el, state.key, () => onLostRef.current());
  }, [state, onLostRef]);

  const { strong, rest } = tooltipParts(state.cell, options);
  return (
    <motion.div
      ref={ref}
      className="kg-tooltip"
      // Top layer: never clipped by overflow and immune to transformed ancestors.
      popover="manual"
      aria-hidden="true"
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={
        reduced
          ? { opacity: 0 }
          : { opacity: 0, scale: 0.97, transition: { duration: 0.12, ease: 'easeIn' } }
      }
      transition={reduced ? { duration: 0.15 } : { type: 'spring', stiffness: 520, damping: 30 }}
    >
      {strong && <b>{strong}</b>}
      {rest}
      <span className="kg-tooltip-arrow" />
    </motion.div>
  );
}

/**
 * Your GitHub contribution graph as a grid of mechanical keycaps.
 *
 * ```tsx
 * <KeyboardGraph username="octocat" theme="ocean" sound="blue" />
 * ```
 */
export const KeyboardGraph = forwardRef<KeyboardGraphHandle, KeyboardGraphProps>(
  function KeyboardGraph(props, ref) {
    const {
      username,
      year: yearProp,
      data,
      fetcher,
      endpoint,
      theme,
      colorScheme,
      sound,
      volume,
      muted,
      keySize,
      gap,
      radius,
      minKeySize,
      responsive,
      showMonthLabels,
      showDayLabels,
      showTotal,
      showLegend,
      yearSelector,
      weekStart,
      plate,
      entrance,
      ripple,
      tooltip,
      ghostTyping,
      themeTransition,
      reducedMotion,
      locale,
      formatTooltip,
      formatAriaLabel,
      formatTotal,
      onKeyPress,
      onLoad,
      onError,
      onYearChange,
      className,
      style,
      ...rest
    } = props;

    const o = withDefaults({
      username,
      year: yearProp,
      data,
      fetcher,
      endpoint,
      theme,
      colorScheme,
      sound,
      volume,
      muted,
      keySize,
      gap,
      radius,
      minKeySize,
      responsive,
      showMonthLabels,
      showDayLabels,
      showTotal,
      showLegend,
      yearSelector,
      weekStart,
      plate,
      entrance,
      ripple,
      tooltip,
      ghostTyping,
      themeTransition,
      reducedMotion,
      locale,
      formatTooltip,
      formatAriaLabel,
      formatTotal,
    });

    // ── Year (controlled via `year`, or internal when using the built-in selector) ─
    const [internalYear, setInternalYear] = useState<YearSelection>(o.year);
    const year = yearProp ?? internalYear;
    const onYearChangeRef = useLatest(onYearChange);
    const selectYear = useCallback(
      (next: YearSelection) => {
        setInternalYear(next);
        onYearChangeRef.current?.(next);
      },
      [onYearChangeRef],
    );

    // ── Environment (SSR-safe: server snapshots are inert) ─────────────────────
    const prefersReduced = useSyncExternalStore(subscribeMotion, getMotion, getServerMotion);
    const reduced =
      o.reducedMotion === 'always' || (o.reducedMotion === 'user' && prefersReduced === true);
    const reducedRef = useLatest(reduced);
    const today = useSyncExternalStore(noopSubscribe, localToday, getServerToday);

    // ── Data ───────────────────────────────────────────────────────────────────
    const contributions = useContributions({
      username,
      year,
      data,
      fetcher,
      endpoint,
      onLoad,
      onError,
    });
    const { status, days, busy, retry } = contributions;
    const layout = useMemo(
      () =>
        status === 'ready' && days
          ? buildLayout(days, { weekStart: o.weekStart, locale, today })
          : null,
      [status, days, o.weekStart, locale, today],
    );
    const labels = useMemo(
      () =>
        layout ? layout.cells.map((cell) => ariaLabelFor(cell, { locale, formatAriaLabel })) : [],
      [layout, locale, formatAriaLabel],
    );

    // ── Refs & long-lived instances ────────────────────────────────────────────
    const rootRef = useRef<HTMLDivElement>(null);
    const scrollerRef = useRef<HTMLDivElement>(null);
    const [grid, setGrid] = useState<HTMLDivElement | null>(null);
    const controllerRef = useRef<InteractionController | null>(null);
    const layoutRef = useLatest(layout);
    const optionsRef = useLatest(o);
    const onKeyPressRef = useLatest(onKeyPress);
    const animator = useMemo(
      () => createMotionAnimator({ reducedMotion: () => reducedRef.current }),
      [reducedRef],
    );
    const audio = useMemo(() => new SwitchAudio(), []);
    const [tip, setTip] = useState<TooltipState | null>(null);
    const hintId = `${useId()}-hint`;

    // ── Audio ──────────────────────────────────────────────────────────────────
    useEffect(() => {
      audio.update({ sound: o.sound, volume: o.volume, muted: o.muted });
    }, [audio, o.sound, o.volume, o.muted]);
    useEffect(() => {
      audio.preload();
      return () => audio.dispose();
    }, [audio]);

    // ── Interactions (one controller per grid element) ─────────────────────────
    useIsoLayoutEffect(() => {
      const current = layoutRef.current;
      if (!grid || !current) return;
      const controller = createInteractions({
        grid,
        fx: grid.querySelector<HTMLElement>('.kg-fx'),
        layout: current,
        animator,
        audio,
        ripple: optionsRef.current.ripple,
        tooltip: optionsRef.current.tooltip,
        onPress: (detail) => onKeyPressRef.current?.(detail),
        onTooltip: (cell, key) => setTip(cell && key ? { cell, key } : null),
      });
      controllerRef.current = controller;
      return () => {
        controller.destroy();
        controllerRef.current = null;
        animator.cancelAll();
        setTip(null);
      };
    }, [grid, animator, audio, layoutRef, optionsRef, onKeyPressRef]);

    useEffect(() => {
      controllerRef.current?.update({ ripple: o.ripple, tooltip: o.tooltip });
    }, [o.ripple, o.tooltip, grid]);

    // ── Layout changes: morph in place, or rebuild + entrance wave ─────────────
    const previousLayout = useRef<GraphLayout | null>(null);
    const stopEntrance = useRef<(() => void) | null>(null);
    const playEntrance = useCallback(
      (waitForVisibility: boolean) => {
        const root = rootRef.current;
        const controller = controllerRef.current;
        const current = layoutRef.current;
        stopEntrance.current?.();
        if (!root || !controller || !current) return;
        if (reducedRef.current) {
          root.removeAttribute('data-entrance');
          return;
        }
        const start = () => {
          stopEntrance.current = null;
          animator.entrance(controller.keyElements(), entranceDelays(current));
          root.removeAttribute('data-entrance');
        };
        if (!waitForVisibility) return start();
        root.setAttribute('data-entrance', 'waiting');
        stopEntrance.current = whenVisible(root, start);
      },
      [animator, layoutRef, reducedRef],
    );

    useIsoLayoutEffect(() => {
      const controller = controllerRef.current;
      if (!layout || !controller) {
        previousLayout.current = null;
        return;
      }
      const previous = previousLayout.current;
      previousLayout.current = layout;
      controller.setLayout(layout);
      const transition = transitionSettings(optionsRef.current.themeTransition);
      if (previous && sameGeometry(previous, layout)) {
        // Same shape, new data: recolour as a left-to-right wave (pure math, no DOM reads,
        // so the browser applies the delays and the new levels in one style pass).
        if (transition && !reducedRef.current) {
          applyDelays(
            controller.keyElements(),
            layout.cells.map((c) => Math.round((c.col + c.row * 0.6) * transition.stagger)),
          );
        }
        return;
      }
      scrollToLatest(scrollerRef.current);
      if (optionsRef.current.entrance) playEntrance(true);
      else rootRef.current?.removeAttribute('data-entrance');
    }, [layout, grid, playEntrance, optionsRef, reducedRef]);

    useEffect(() => () => stopEntrance.current?.(), []);

    // ── Theme + colour scheme: applied imperatively so the sweep can be primed ──
    const themeKey = JSON.stringify(o.theme ?? null);
    const themeVars = useMemo(() => themeStyleVars(o.theme), [themeKey]); // eslint-disable-line react-hooks/exhaustive-deps
    const [initial] = useState(() => ({
      themeVars,
      scheme: o.colorScheme,
      entrance: o.entrance && layout ? 'pending' : undefined,
    }));
    const appliedTheme = useRef(`${themeKey}|${o.colorScheme}`);
    useIsoLayoutEffect(() => {
      const root = rootRef.current;
      if (!root) return;
      const key = `${themeKey}|${o.colorScheme}`;
      if (key === appliedTheme.current) return;
      appliedTheme.current = key;
      const transition = transitionSettings(optionsRef.current.themeTransition);
      const controller = controllerRef.current;
      const current = layoutRef.current;
      if (transition && controller && current && grid && !reducedRef.current) {
        // Measure while the old colours are still applied, then change them.
        applyDelays(
          controller.keyElements(),
          sweepDelays(current, grid.getBoundingClientRect(), transition.origin, transition.stagger),
        );
      }
      for (const [name, value] of Object.entries(themeVars)) root.style.setProperty(name, value);
      root.setAttribute('data-scheme', o.colorScheme);
    }, [themeKey, themeVars, o.colorScheme, grid, optionsRef, layoutRef, reducedRef]);

    // ── Ghost typing ───────────────────────────────────────────────────────────
    const ghostKey = o.ghostTyping === false || reduced ? '' : JSON.stringify(o.ghostTyping);
    useEffect(() => {
      const root = rootRef.current;
      if (!ghostKey || !grid || !root) return;
      const settings = optionsRef.current.ghostTyping;
      const ghost = createGhostTyper(
        root,
        (index) => controllerRef.current?.press(index, { soft: true, sound: false, notify: false }),
        () =>
          layoutRef.current
            ? layoutRef.current.cells.filter((c) => !c.future).map((c) => c.index)
            : [],
        typeof settings === 'object' ? settings : {},
      );
      return () => ghost.stop();
    }, [ghostKey, grid, optionsRef, layoutRef]);

    // ── Imperative handle ──────────────────────────────────────────────────────
    useImperativeHandle(ref, (): KeyboardGraphHandle => {
      const indexOf = (target: string | number) => {
        const current = layoutRef.current;
        if (!current) return -1;
        if (typeof target === 'number')
          return target >= 0 && target < current.cells.length ? target : -1;
        return current.cells.findIndex((c) => c.date === target);
      };
      return {
        press: (target, options) => {
          const index = indexOf(target);
          if (index >= 0) controllerRef.current?.press(index, options);
        },
        pressAt: (col, row, options) => {
          const current = layoutRef.current;
          const index = current ? cellAt(current, col, row) : -1;
          if (index >= 0) controllerRef.current?.press(index, options);
        },
        focusDay: (target) => {
          const index = indexOf(target);
          if (index >= 0) controllerRef.current?.focus(index);
        },
        replayEntrance: () => playEntrance(false),
        getDays: () =>
          layoutRef.current
            ? layoutRef.current.cells.map(({ date, count, level }) => ({ date, count, level }))
            : [],
        getColumns: () => layoutRef.current?.columns ?? 0,
      };
    }, [layoutRef, playEntrance]);

    // ── Render ─────────────────────────────────────────────────────────────────
    const loadedYear = contributions.year;
    const years = yearOptions(o.yearSelector);
    const columns = layout?.columns ?? SKELETON_COLUMNS;
    const rootStyle = { ...initial.themeVars, ...rootStyleVars(o), ...style } as CSSProperties;
    const frameStyle = frameStyleVars(columns, o) as CSSProperties;
    const attributes = rootDataAttributes(o, status, reduced);
    const liveText =
      status === 'loading'
        ? 'Loading contributions…'
        : status === 'error'
          ? (contributions.error?.message ?? '')
          : layout
            ? totalLabel(layout.total, loadedYear, o)
            : '';

    let message: ReactNode = null;
    if (status === 'error' && contributions.error) {
      const notFound = contributions.error.code === 'not-found';
      message = (
        <div className="kg-message" role="alert">
          <p>
            {notFound ? (
              <>
                Couldn&apos;t find <b>@{username}</b> on GitHub.
              </>
            ) : contributions.error.code === 'rate-limited' ? (
              'The contributions API is busy right now.'
            ) : (
              "Couldn't load contributions."
            )}
          </p>
          {!notFound && (
            <button type="button" className="kg-retry" onClick={retry}>
              Try again
            </button>
          )}
        </div>
      );
    } else if (status === 'empty') {
      message = (
        <div className="kg-message">
          <p>
            {username || fetcher ? (
              'No contributions to show.'
            ) : (
              <>
                Pass a <code>username</code> or <code>data</code> to render a graph.
              </>
            )}
          </p>
        </div>
      );
    }

    const showHeader = (o.showTotal && layout) || years.length > 0;

    return (
      <div
        {...rest}
        ref={rootRef}
        className={className ? `kg-root ${className}` : 'kg-root'}
        style={rootStyle}
        {...attributes}
        data-scheme={initial.scheme}
        data-entrance={initial.entrance}
        data-busy={busy ? '' : undefined}
      >
        <Styles />
        <div className="kg-frame" style={frameStyle}>
          {showHeader && (
            <div className="kg-header">
              {o.showTotal && layout ? (
                <p className="kg-total">{totalLabel(layout.total, loadedYear, o)}</p>
              ) : (
                <span />
              )}
              {years.length > 0 && (
                <div className="kg-years" role="group" aria-label="Select year">
                  {years.map((y) => (
                    <button
                      key={String(y)}
                      type="button"
                      className="kg-year"
                      aria-pressed={y === year}
                      onClick={() => selectYear(y)}
                    >
                      {formatYearOption(y)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="kg-scroller" ref={scrollerRef}>
            <div className="kg-plate">
              {layout ? (
                <Board
                  layout={layout}
                  labels={labels}
                  showMonthLabels={o.showMonthLabels}
                  showDayLabels={o.showDayLabels}
                  label={gridLabel(username, loadedYear)}
                  hintId={hintId}
                  gridRef={setGrid}
                />
              ) : (
                <Skeleton showDayLabels={o.showDayLabels} />
              )}
              {message}
            </div>
          </div>
          {o.showLegend && (
            <div className="kg-footer">
              <Legend />
            </div>
          )}
        </div>
        <AnimatePresence>
          {tip && o.tooltip && (
            <Tooltip
              key="tooltip"
              state={tip}
              options={o}
              reduced={reduced}
              onLost={() => setTip(null)}
            />
          )}
        </AnimatePresence>
        <div className="kg-sr" aria-live="polite">
          {liveText}
        </div>
        <p className="kg-sr" id={hintId}>
          {KEYBOARD_HINT}
        </p>
      </div>
    );
  },
);

KeyboardGraph.displayName = 'KeyboardGraph';
