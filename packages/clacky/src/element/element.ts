import { parseSoundAttribute, SwitchAudio } from '../audio/engine.js';
import { createWaapiAnimator, type KeyAnimator } from '../core/animator.js';
import {
  ClackyError,
  loadContributions,
  normalizeContributions,
  parseYear,
  sumContributions,
} from '../core/data.js';
import { localToday } from '../core/format.js';
import { createGhostTyper, type GhostTyper } from '../core/ghost.js';
import type { ClackyHandle } from '../core/handle.js';
import {
  applyDelays,
  createInteractions,
  entranceDelays,
  sweepDelays,
  type InteractionController,
  type ProgrammaticPress,
} from '../core/interactions.js';
import { buildLayout, cellAt, sameGeometry } from '../core/layout.js';
import {
  frameStyleVars,
  rootDataAttributes,
  rootStyleVars,
  shouldReduceMotion,
  themeStyleVars,
  transitionSettings,
  withDefaults,
  yearOptions,
  type ClackyOptions,
  type ResolvedOptions,
  type RootState,
} from '../core/options.js';
import { trackTooltip } from '../core/position.js';
import {
  ariaLabelFor,
  boardHTML,
  escapeHTML,
  gridLabel,
  KEYBOARD_HINT,
  legendHTML,
  skeletonBoardHTML,
  SKELETON_COLUMNS,
  tooltipParts,
  totalLabel,
  yearSelectorHTML,
} from '../core/render.js';
import { clackyCSS } from '../core/styles.js';
import { parseThemeAttribute } from '../core/theme.js';
import { hideFromTopLayer, placeTooltip, showInTopLayer } from '../core/tooltip.js';
import type {
  ContributionDay,
  GraphLayout,
  KeyCell,
  KeyPressDetail,
  LoadDetail,
  YearSelection,
} from '../core/types.js';
import { scrollToLatest, whenVisible } from '../core/visibility.js';

type Parser = (value: string | null) => unknown;

const str: Parser = (v) => (v === null || v === '' ? undefined : v);
const bool: Parser = (v) => (v === null ? undefined : v !== 'false');
const num: Parser = (v) => {
  if (v === null || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const oneOf =
  <T extends string>(...values: T[]): Parser =>
  (v) =>
    values.includes(v as T) ? v : undefined;

/** attribute name → [option key, parser] */
const ATTRIBUTES: Record<string, [keyof ClackyOptions, Parser]> = {
  username: ['username', str],
  year: ['year', (v) => (v === null ? undefined : parseYear(v))],
  endpoint: ['endpoint', str],
  data: [
    'data',
    (v) => {
      if (!v) return undefined;
      try {
        const parsed: unknown = JSON.parse(v);
        return Array.isArray(parsed) ? parsed : undefined;
      } catch {
        return undefined;
      }
    },
  ],
  theme: ['theme', parseThemeAttribute],
  'color-scheme': ['colorScheme', oneOf('light', 'dark', 'auto')],
  sound: ['sound', (v) => (v === null ? undefined : parseSoundAttribute(v))],
  volume: ['volume', num],
  muted: ['muted', bool],
  'key-size': ['keySize', num],
  gap: ['gap', num],
  radius: ['radius', num],
  'min-key-size': ['minKeySize', num],
  responsive: ['responsive', oneOf('scale', 'scroll')],
  'show-month-labels': ['showMonthLabels', bool],
  'show-day-labels': ['showDayLabels', bool],
  'show-total': ['showTotal', bool],
  'show-legend': ['showLegend', bool],
  'year-selector': [
    'yearSelector',
    (v) => {
      if (v === null) return undefined;
      if (v === '' || v === 'true') return true;
      if (v === 'false') return false;
      return v.split(',').map((s) => parseYear(s.trim()));
    },
  ],
  'week-start': [
    'weekStart',
    (v) => (v === null ? undefined : v === '1' || v.toLowerCase() === 'monday' ? 1 : 0),
  ],
  plate: ['plate', bool],
  entrance: ['entrance', bool],
  ripple: ['ripple', bool],
  tooltip: ['tooltip', bool],
  'ghost-typing': ['ghostTyping', bool],
  'theme-transition': ['themeTransition', bool],
  'reduced-motion': ['reducedMotion', oneOf('user', 'always', 'never')],
  locale: ['locale', str],
};

const OPTION_KEYS: (keyof ClackyOptions)[] = [
  'username',
  'year',
  'data',
  'fetcher',
  'endpoint',
  'theme',
  'colorScheme',
  'sound',
  'volume',
  'muted',
  'keySize',
  'gap',
  'radius',
  'minKeySize',
  'responsive',
  'showMonthLabels',
  'showDayLabels',
  'showTotal',
  'showLegend',
  'yearSelector',
  'weekStart',
  'plate',
  'entrance',
  'ripple',
  'tooltip',
  'ghostTyping',
  'themeTransition',
  'reducedMotion',
  'locale',
  'formatTooltip',
  'formatAriaLabel',
  'formatTotal',
];

const HOST_CSS = ':host{display:block;min-width:0}:host([hidden]){display:none}';

let sharedSheet: CSSStyleSheet | null = null;

function adoptStyles(shadow: ShadowRoot) {
  const css = HOST_CSS + clackyCSS;
  try {
    if (!sharedSheet) {
      sharedSheet = new CSSStyleSheet();
      sharedSheet.replaceSync(css);
    }
    shadow.adoptedStyleSheets = [sharedSheet];
  } catch {
    // Constructable stylesheets unsupported: fall back to a <style> tag.
    const style = document.createElement('style');
    style.textContent = css;
    shadow.appendChild(style);
  }
}

// Extending HTMLElement at module scope would throw during SSR (no DOM), so fall back
// to an inert base class there. The element is only ever defined in the browser.
const Base = (typeof HTMLElement !== 'undefined' ? HTMLElement : class {}) as typeof HTMLElement;

export interface ClackyEventMap {
  'clacky-keypress': CustomEvent<KeyPressDetail>;
  'clacky-load': CustomEvent<LoadDetail>;
  'clacky-error': CustomEvent<{ error: ClackyError }>;
  'clacky-yearchange': CustomEvent<{ year: YearSelection }>;
}

/**
 * `<clacky-graph>`: the contribution keyboard as a framework-free custom element.
 *
 * Primitive options are attributes (`username`, `theme`, `sound`, `key-size`, …);
 * every option is also a property (`el.data = [...]`, `el.fetcher = fn`,
 * `el.theme = { levels: [...] }`). Listen for `clacky-keypress`, `clacky-load`, `clacky-error`
 * and `clacky-yearchange` events.
 */
// Options are exposed as accessors defined at runtime (see below), typed via the
// merged interface at the bottom of this file.
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class ClackyElement extends Base implements ClackyHandle {
  static get observedAttributes(): string[] {
    return Object.keys(ATTRIBUTES);
  }

  #props: Partial<ClackyOptions> = {};
  #shadow: ShadowRoot | null = null;
  #root!: HTMLDivElement;
  #frame!: HTMLDivElement;
  #header!: HTMLDivElement;
  #scroller!: HTMLDivElement;
  #plate!: HTMLDivElement;
  #footer!: HTMLDivElement;
  #tooltip!: HTMLDivElement;
  #live!: HTMLDivElement;

  #options: ResolvedOptions = withDefaults({});
  #state: RootState = 'loading';
  #days: ContributionDay[] | null = null;
  #layout: GraphLayout | null = null;
  #error: ClackyError | null = null;
  #selectedYear: YearSelection | null = null;
  #loadedYear: YearSelection | null = null;
  #sourceKey = '';
  #boardKey = '';
  #themeKey = '';
  #abort: AbortController | null = null;
  #queued = false;
  #connected = false;

  #animator: KeyAnimator = createWaapiAnimator({ reducedMotion: () => this.#reduced });
  #audio = new SwitchAudio();
  #controller: InteractionController | null = null;
  #ghost: GhostTyper | null = null;
  #ghostKey = '';
  #reduced = false;
  #motionQuery: MediaQueryList | null = null;
  #stopEntranceWatch: (() => void) | null = null;
  #stopTooltipTracking: (() => void) | null = null;
  #tooltipOpen = false;
  #tooltipOut: Animation | null = null;

  connectedCallback(): void {
    if (!this.#shadow) {
      this.#upgradeProperties();
      this.#build();
    }
    this.#connected = true;
    if (typeof window.matchMedia === 'function') {
      this.#motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.#motionQuery.addEventListener('change', this.#onMotionChange);
    }
    this.#audio.preload();
    this.#update();
  }

  disconnectedCallback(): void {
    this.#connected = false;
    this.#abort?.abort();
    this.#controller?.destroy();
    this.#controller = null;
    this.#ghost?.stop();
    this.#ghost = null;
    this.#ghostKey = '';
    this.#stopEntranceWatch?.();
    this.#stopTooltipTracking?.();
    this.#animator.cancelAll();
    this.#motionQuery?.removeEventListener('change', this.#onMotionChange);
    this.#audio.dispose();
    this.#audio = new SwitchAudio(this.#audioOptions());
    // Force a full re-render if the element is re-attached.
    this.#sourceKey = '';
    this.#boardKey = '';
  }

  attributeChangedCallback(): void {
    this.#schedule();
  }

  /** Set several options at once. */
  set options(value: Partial<ClackyOptions>) {
    this.#props = { ...this.#props, ...value };
    this.#schedule();
  }

  get options(): Partial<ClackyOptions> {
    return { ...this.#readAttributes(), ...this.#props };
  }

  // ── Imperative API ─────────────────────────────────────────────────────────
  press(target: string | number, options?: ProgrammaticPress): void {
    const index = this.#indexOf(target);
    if (index >= 0) this.#controller?.press(index, options);
  }

  pressAt(col: number, row: number, options?: ProgrammaticPress): void {
    if (!this.#layout) return;
    const index = cellAt(this.#layout, col, row);
    if (index >= 0) this.#controller?.press(index, options);
  }

  focusDay(target: string | number): void {
    const index = this.#indexOf(target);
    if (index >= 0) this.#controller?.focus(index);
  }

  replayEntrance(): void {
    if (this.#layout && this.#controller) this.#playEntrance(true);
  }

  getDays(): ContributionDay[] {
    return this.#days ? [...this.#days] : [];
  }

  getColumns(): number {
    return this.#layout?.columns ?? 0;
  }

  // ── Internals ──────────────────────────────────────────────────────────────
  #indexOf(target: string | number): number {
    if (!this.#layout) return -1;
    if (typeof target === 'number')
      return target >= 0 && target < this.#layout.cells.length ? target : -1;
    return this.#layout.cells.findIndex((c) => c.date === target);
  }

  #onMotionChange = () => this.#schedule();

  /**
   * A property set before `customElements.define` ran (e.g. `el.data = …` from a
   * framework or a lazily loaded script) is an own property that shadows the
   * prototype accessor. Re-assign it through the accessor.
   */
  #upgradeProperties() {
    const self = this as unknown as Record<string, unknown>;
    for (const key of [...OPTION_KEYS, 'options']) {
      if (!Object.prototype.hasOwnProperty.call(this, key)) continue;
      const value = self[key];
      delete self[key];
      self[key] = value;
    }
  }

  #schedule() {
    if (this.#queued || !this.#connected) return;
    this.#queued = true;
    queueMicrotask(() => {
      this.#queued = false;
      if (this.#connected) this.#update();
    });
  }

  #dataAttribute: { raw: string | null; parsed: unknown } = { raw: null, parsed: undefined };

  #readAttributes(): Partial<ClackyOptions> {
    const out: Record<string, unknown> = {};
    for (const [attr, [key, parse]] of Object.entries(ATTRIBUTES)) {
      const raw = this.getAttribute(attr);
      let value: unknown;
      if (attr === 'data') {
        // Re-parsing would create a new array (and a reload) on every update.
        if (raw !== this.#dataAttribute.raw) this.#dataAttribute = { raw, parsed: parse(raw) };
        value = this.#dataAttribute.parsed;
      } else {
        value = parse(raw);
      }
      if (value !== undefined) out[key] = value;
    }
    return out as Partial<ClackyOptions>;
  }

  #audioOptions() {
    const o = this.#options;
    return { sound: o.sound, volume: o.volume, muted: o.muted };
  }

  #build() {
    this.#shadow = this.attachShadow({ mode: 'open' });
    adoptStyles(this.#shadow);
    const root = document.createElement('div');
    root.className = 'clacky-root';
    root.setAttribute('part', 'root');
    root.innerHTML =
      '<div class="clacky-frame"><div class="clacky-header"></div><div class="clacky-scroller"><div class="clacky-plate" part="plate"></div></div>' +
      `<div class="clacky-footer"></div></div><div class="clacky-tooltip" part="tooltip" popover="manual" aria-hidden="true"></div>` +
      `<div class="clacky-sr" aria-live="polite"></div><p class="clacky-sr" id="clacky-hint">${KEYBOARD_HINT}</p>`;
    this.#shadow.appendChild(root);
    this.#root = root;
    this.#frame = root.querySelector('.clacky-frame')!;
    this.#header = root.querySelector('.clacky-header')!;
    this.#scroller = root.querySelector('.clacky-scroller')!;
    this.#plate = root.querySelector('.clacky-plate')!;
    this.#footer = root.querySelector('.clacky-footer')!;
    this.#tooltip = root.querySelector('.clacky-tooltip')!;
    this.#live = root.querySelectorAll<HTMLDivElement>('.clacky-sr')[0]!;
    if (typeof this.#tooltip.showPopover !== 'function') this.#tooltip.hidden = true;
    this.#header.addEventListener('click', this.#onHeaderClick);
    this.#plate.addEventListener('click', this.#onPlateClick);
  }

  #onHeaderClick = (event: Event) => {
    const button = (event.target as Element).closest<HTMLElement>('.clacky-year');
    if (!button?.dataset.year) return;
    const year = parseYear(button.dataset.year);
    this.#selectedYear = year;
    if (this.#props.year !== undefined) this.#props = { ...this.#props, year };
    else if (this.hasAttribute('year')) this.setAttribute('year', String(year));
    this.dispatchEvent(
      new CustomEvent('clacky-yearchange', { detail: { year }, bubbles: true, composed: true }),
    );
    this.#schedule();
  };

  #onPlateClick = (event: Event) => {
    if ((event.target as Element).closest('.clacky-retry')) {
      this.#sourceKey = '';
      this.#schedule();
    }
  };

  #effectiveYear(o: ResolvedOptions): YearSelection {
    const controlled = this.hasAttribute('year') || this.#props.year !== undefined;
    return controlled ? o.year : (this.#selectedYear ?? o.year);
  }

  #update() {
    if (!this.#shadow) return;
    const o = withDefaults(this.options);
    this.#options = o;
    this.#reduced = shouldReduceMotion(o.reducedMotion);
    this.#audio.update(this.#audioOptions());
    this.#controller?.update({ ripple: o.ripple, tooltip: o.tooltip });

    this.#applyRoot(o);
    this.#applyTheme(o);

    const year = this.#effectiveYear(o);
    const sourceKey =
      JSON.stringify([o.username ?? '', year, o.endpoint ?? '', o.weekStart]) +
      (o.data ? `#${this.#dataId(o.data)}` : '') +
      (o.fetcher ? `#f${this.#fnId(o.fetcher)}` : '');
    if (sourceKey !== this.#sourceKey) {
      this.#sourceKey = sourceKey;
      this.#load(o, year);
    } else {
      this.#render(o);
    }
  }

  #ids = new WeakMap<object, number>();
  #nextId = 1;
  #dataId(data: object) {
    let id = this.#ids.get(data);
    if (!id) this.#ids.set(data, (id = this.#nextId++));
    return id;
  }
  #fnId(fn: object) {
    return this.#dataId(fn);
  }

  #applyRoot(o: ResolvedOptions) {
    const attrs = rootDataAttributes(o, this.#state, this.#reduced);
    for (const [name, value] of Object.entries(attrs)) this.#root.setAttribute(name, value);
    for (const [name, value] of Object.entries(rootStyleVars(o)))
      this.#root.style.setProperty(name, value);
  }

  #applyTheme(o: ResolvedOptions) {
    const key = JSON.stringify(o.theme) + o.colorScheme;
    if (key === this.#themeKey) return;
    const first = this.#themeKey === '';
    this.#themeKey = key;
    const transition = transitionSettings(o.themeTransition);
    const grid = this.#plate.querySelector<HTMLElement>('.clacky-grid[role="group"]');
    if (!first && transition && grid && this.#layout && this.#controller && !this.#reduced) {
      // Measure before the colours change so the browser sees the new delays and
      // the new colours in the same style pass.
      const delays = sweepDelays(
        this.#layout,
        grid.getBoundingClientRect(),
        transition.origin,
        transition.stagger,
      );
      applyDelays(this.#controller.keyElements(), delays);
    }
    for (const [name, value] of Object.entries(themeStyleVars(o.theme)))
      this.#root.style.setProperty(name, value);
  }

  async #load(o: ResolvedOptions, year: YearSelection) {
    this.#abort?.abort();
    const controller = new AbortController();
    this.#abort = controller;
    this.#root.removeAttribute('data-busy');

    if (o.data) {
      try {
        const calendarYear = typeof year === 'number' ? year : null;
        const days = normalizeContributions(o.data, { year: calendarYear });
        this.#setData(days, sumContributions(days), o, calendarYear);
      } catch (error) {
        this.#setError(error, o);
      }
      return;
    }

    if (!o.username && !o.fetcher) {
      this.#days = null;
      this.#state = 'empty';
      this.#render(o);
      return;
    }

    this.#error = null;
    if (this.#state === 'ready' && this.#days) {
      // Keep the current board on screen (dimmed) so the new data can morph into it.
      this.#root.setAttribute('data-busy', '');
    } else {
      this.#state = 'loading';
      this.#render(o);
    }
    this.#live.textContent = 'Loading contributions…';
    try {
      const result = await loadContributions({
        username: o.username ?? '',
        year,
        endpoint: o.endpoint,
        fetcher: o.fetcher,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      this.#setData(result.days, result.total, o, year);
    } catch (error) {
      if (controller.signal.aborted || (error instanceof ClackyError && error.code === 'aborted'))
        return;
      this.#setError(error, o);
    } finally {
      if (this.#abort === controller) this.#root.removeAttribute('data-busy');
    }
  }

  #setData(days: ContributionDay[], total: number, o: ResolvedOptions, year: YearSelection | null) {
    this.#days = days;
    this.#loadedYear = year;
    this.#error = null;
    this.#state = days.length === 0 ? 'empty' : 'ready';
    this.#render(o);
    this.#live.textContent = totalLabel(total, year, o);
    this.dispatchEvent(
      new CustomEvent('clacky-load', {
        detail: { days, total, year, username: o.username ?? null },
        bubbles: true,
        composed: true,
      }),
    );
  }

  #setError(error: unknown, o: ResolvedOptions) {
    this.#error =
      error instanceof ClackyError
        ? error
        : new ClackyError('network', error instanceof Error ? error.message : String(error));
    this.#state = 'error';
    this.#days = null;
    this.#render(o);
    this.#live.textContent = this.#error.message;
    this.dispatchEvent(
      new CustomEvent('clacky-error', {
        detail: { error: this.#error },
        bubbles: true,
        composed: true,
      }),
    );
  }

  #render(o: ResolvedOptions) {
    this.#root.setAttribute('data-state', this.#state);
    const year = this.#loadedYear;
    const days = this.#state === 'ready' ? this.#days : null;
    const previous = this.#layout;
    const layout = days
      ? buildLayout(days, { weekStart: o.weekStart, locale: o.locale, today: localToday() })
      : null;
    this.#layout = layout;

    const columns = layout?.columns ?? SKELETON_COLUMNS;
    for (const [name, value] of Object.entries(frameStyleVars(columns, o)))
      this.#frame.style.setProperty(name, value);

    this.#renderHeader(o, layout, year);
    this.#renderFooter(o);

    if (!layout) {
      this.#teardownGrid();
      const key = `${this.#state}|${o.showDayLabels}`;
      if (this.#boardKey !== key) {
        this.#boardKey = key;
        this.#plate.innerHTML = skeletonBoardHTML(o) + this.#messageHTML(o);
      }
      return;
    }

    const boardKey = JSON.stringify([
      o.showDayLabels,
      o.showMonthLabels,
      o.locale,
      !!o.formatAriaLabel,
    ]);
    const grid = this.#plate.querySelector<HTMLElement>('.clacky-grid[role="group"]');
    if (grid && this.#controller && boardKey === this.#boardKey && sameGeometry(previous, layout)) {
      if (!this.#sameDays(previous!, layout)) this.#morph(grid, layout, o);
      this.#syncGhost(o);
      return;
    }

    this.#boardKey = boardKey;
    this.#teardownGrid();
    this.#plate.innerHTML = boardHTML(layout, o, {
      label: gridLabel(o.username, year),
      hintId: 'clacky-hint',
    });
    const newGrid = this.#plate.querySelector<HTMLElement>('.clacky-grid')!;
    this.#controller = createInteractions({
      grid: newGrid,
      fx: newGrid.querySelector('.clacky-fx'),
      layout,
      animator: this.#animator,
      audio: this.#audio,
      ripple: o.ripple,
      tooltip: o.tooltip,
      onPress: (detail) =>
        this.dispatchEvent(
          new CustomEvent('clacky-keypress', { detail, bubbles: true, composed: true }),
        ),
      onTooltip: (cell, key) => (cell && key ? this.#showTooltip(cell, key) : this.#hideTooltip()),
    });
    scrollToLatest(this.#scroller);
    if (o.entrance) this.#playEntrance(false);
    this.#syncGhost(o);
  }

  #sameDays(a: GraphLayout, b: GraphLayout) {
    return (
      a.start === b.start &&
      a.end === b.end &&
      a.cells.every((c, i) => c.count === b.cells[i]!.count && c.level === b.cells[i]!.level)
    );
  }

  /** Same grid shape, new data (e.g. another year): recolour keys in place with a left-to-right wave. */
  #morph(grid: HTMLElement, layout: GraphLayout, o: ResolvedOptions) {
    const keys = this.#controller!.keyElements();
    const transition = transitionSettings(o.themeTransition);
    if (transition && !this.#reduced) {
      applyDelays(
        keys,
        sweepDelays(layout, grid.getBoundingClientRect(), null, transition.stagger),
      );
    }
    for (const cell of layout.cells) {
      const key = keys[cell.index];
      if (!key) continue;
      key.dataset.level = String(cell.level);
      key.setAttribute('aria-label', ariaLabelFor(cell, o));
      key.toggleAttribute('data-future', cell.future);
      if (cell.future) key.setAttribute('aria-disabled', 'true');
      else key.removeAttribute('aria-disabled');
    }
    const months = this.#plate.querySelector('.clacky-months');
    if (months) {
      months.innerHTML = layout.months
        .map(
          (m) =>
            `<span class="clacky-month" style="grid-column:${m.col + 1}">${escapeHTML(m.label)}</span>`,
        )
        .join('');
    }
    this.#controller!.setLayout(layout);
    const label = gridLabel(o.username, this.#loadedYear);
    grid.setAttribute('aria-label', label);
  }

  #playEntrance(force: boolean) {
    const layout = this.#layout;
    const controller = this.#controller;
    if (!layout || !controller) return;
    this.#stopEntranceWatch?.();
    if (this.#reduced) {
      this.#root.removeAttribute('data-entrance');
      return;
    }
    const start = () => {
      this.#stopEntranceWatch = null;
      this.#animator.entrance(controller.keyElements(), entranceDelays(layout));
      this.#root.removeAttribute('data-entrance');
    };
    if (force) return start();
    // Hide the keys until the graph scrolls into view, then drop them in.
    this.#root.setAttribute('data-entrance', 'waiting');
    this.#stopEntranceWatch = whenVisible(this.#root, start);
  }

  #teardownGrid() {
    this.#controller?.destroy();
    this.#controller = null;
    this.#stopEntranceWatch?.();
    this.#stopEntranceWatch = null;
    this.#root.removeAttribute('data-entrance');
    this.#hideTooltip(true);
  }

  #messageHTML(o: ResolvedOptions): string {
    if (this.#state === 'error' && this.#error) {
      const text =
        this.#error.code === 'not-found'
          ? `Couldn't find <b>@${escapeHTML(o.username ?? '')}</b> on GitHub.`
          : this.#error.code === 'rate-limited'
            ? 'The contributions API is busy right now.'
            : "Couldn't load contributions.";
      return `<div class="clacky-message" role="alert"><p>${text}</p>${this.#error.code === 'not-found' ? '' : '<button type="button" class="clacky-retry">Try again</button>'}</div>`;
    }
    if (this.#state === 'empty') {
      return `<div class="clacky-message"><p>${o.username || o.fetcher ? 'No contributions to show.' : 'Set a <code>username</code> or pass <code>data</code> to render a graph.'}</p></div>`;
    }
    return '';
  }

  #yearsKey = '';

  /** Updated in place (never re-created) so a focused year button keeps focus. */
  #renderHeader(o: ResolvedOptions, layout: GraphLayout | null, year: YearSelection | null) {
    const years = yearOptions(o.yearSelector);
    const showTotal = Boolean(o.showTotal && layout);
    this.#header.hidden = !showTotal && years.length === 0;
    if (this.#header.hidden) return;

    let total = this.#header.querySelector<HTMLParagraphElement>('.clacky-total');
    if (!total) {
      total = document.createElement('p');
      total.className = 'clacky-total';
      total.setAttribute('part', 'total');
      this.#header.prepend(total);
    }
    total.textContent = showTotal && layout ? totalLabel(layout.total, year, o) : '';

    const selected = this.#effectiveYear(o);
    const key = years.join(',');
    if (key !== this.#yearsKey) {
      this.#yearsKey = key;
      this.#header.querySelector('.clacky-years')?.remove();
      if (years.length > 0)
        this.#header.insertAdjacentHTML('beforeend', yearSelectorHTML(years, selected));
    }
    for (const button of this.#header.querySelectorAll<HTMLElement>('.clacky-year')) {
      button.setAttribute('aria-pressed', String(button.dataset.year === String(selected)));
    }
  }

  #renderFooter(o: ResolvedOptions) {
    this.#footer.hidden = !o.showLegend;
    if (o.showLegend && !this.#footer.firstChild) this.#footer.innerHTML = legendHTML();
  }

  #showTooltip(cell: KeyCell, key: HTMLElement) {
    const tip = this.#tooltip;
    const { strong, rest } = tooltipParts(cell, this.#options);
    tip.innerHTML = `${strong ? `<b>${escapeHTML(strong)}</b>` : ''}${escapeHTML(rest)}<span class="clacky-tooltip-arrow"></span>`;
    this.#tooltipOut?.cancel();
    this.#tooltipOut = null;
    showInTopLayer(tip);
    placeTooltip(tip, key);
    this.#stopTooltipTracking?.();
    this.#stopTooltipTracking = trackTooltip(tip, key, () => this.#hideTooltip());
    if (!this.#tooltipOpen && typeof tip.animate === 'function') {
      tip.animate(
        this.#reduced
          ? [{ opacity: 0 }, { opacity: 1 }]
          : [
              {
                opacity: 0,
                transform: `translateY(${tip.dataset.placement === 'bottom' ? -4 : 4}px) scale(.94)`,
              },
              { opacity: 1, transform: 'none' },
            ],
        { duration: 170, easing: 'cubic-bezier(.2,.9,.25,1.15)' },
      );
    }
    this.#tooltipOpen = true;
  }

  #hideTooltip(immediate = false) {
    if (!this.#tooltipOpen) return;
    this.#tooltipOpen = false;
    this.#stopTooltipTracking?.();
    this.#stopTooltipTracking = null;
    const tip = this.#tooltip;
    if (immediate || typeof tip.animate !== 'function') {
      hideFromTopLayer(tip);
      return;
    }
    const out = tip.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.97)' }], {
      duration: 120,
      easing: 'ease-in',
    });
    this.#tooltipOut = out;
    out.addEventListener('finish', () => {
      if (this.#tooltipOut === out) hideFromTopLayer(tip);
    });
  }

  #syncGhost(o: ResolvedOptions) {
    const enabled = o.ghostTyping !== false && !this.#reduced && !!this.#controller;
    const key = enabled ? JSON.stringify(o.ghostTyping) : '';
    if (key === this.#ghostKey) return;
    this.#ghost?.stop();
    this.#ghost = null;
    this.#ghostKey = key;
    if (!enabled) return;
    this.#ghost = createGhostTyper(
      this.#root,
      (index) => this.#controller?.press(index, { soft: true, sound: false, notify: false }),
      () => (this.#layout ? this.#layout.cells.filter((c) => !c.future).map((c) => c.index) : []),
      typeof o.ghostTyping === 'object' ? o.ghostTyping : {},
    );
  }
}

// Every option is also a property: `el.theme = {...}`, `el.data = [...]`, `el.fetcher = fn`.
for (const key of OPTION_KEYS) {
  Object.defineProperty(ClackyElement.prototype, key, {
    configurable: true,
    enumerable: true,
    get(this: ClackyElement) {
      return this.options[key];
    },
    set(this: ClackyElement, value: unknown) {
      this.options = { [key]: value };
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface ClackyElement extends ClackyOptions {
  addEventListener<K extends keyof ClackyEventMap>(
    type: K,
    listener: (this: ClackyElement, event: ClackyEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener<K extends keyof ClackyEventMap>(
    type: K,
    listener: (this: ClackyElement, event: ClackyEventMap[K]) => void,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
}

/** Register the custom element (no-op on the server or if already defined). */
export function defineClacky(tagName = 'clacky-graph'): void {
  if (typeof customElements === 'undefined' || customElements.get(tagName)) return;
  customElements.define(
    tagName,
    tagName === 'clacky-graph' ? ClackyElement : class extends ClackyElement {},
  );
}
