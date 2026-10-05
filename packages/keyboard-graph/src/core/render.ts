import {
  formatAriaLabel,
  formatCount,
  formatTooltipText,
  formatTotal,
  formatYearOption,
} from './format.js';
import { initialFocusIndex } from './layout.js';
import type { ResolvedOptions } from './options.js';
import type { ContributionDay, GraphLayout, KeyCell, YearSelection } from './types.js';

/**
 * Markup builders for the vanilla renderer (web component). The React wrapper
 * renders the exact same structure and class names with JSX.
 */

export const KEY_PARTS_HTML =
  '<span class="kg-shadow"></span><span class="kg-skirt"></span><span class="kg-cap"></span>';

/** Columns shown while loading (a full year). */
export const SKELETON_COLUMNS = 53;

export function escapeHTML(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function ariaLabelFor(
  day: ContributionDay,
  o: Pick<ResolvedOptions, 'formatAriaLabel' | 'locale'>,
): string {
  return o.formatAriaLabel ? o.formatAriaLabel(day) : formatAriaLabel(day, o.locale);
}

/** Tooltip copy split into an emphasised lead and the rest. */
export function tooltipParts(
  day: ContributionDay,
  o: Pick<ResolvedOptions, 'formatTooltip' | 'locale'>,
): { strong: string; rest: string } {
  if (o.formatTooltip) return { strong: '', rest: o.formatTooltip(day) };
  const lead = formatCount(day.count, o.locale);
  const full = formatTooltipText(day, o.locale);
  return { strong: lead, rest: full.slice(lead.length) };
}

export function totalLabel(
  total: number,
  year: YearSelection | null,
  o: Pick<ResolvedOptions, 'formatTotal' | 'locale'>,
) {
  return o.formatTotal ? o.formatTotal(total, year) : formatTotal(total, year, o.locale);
}

export function gridLabel(username: string | undefined, year: YearSelection | null): string {
  const span = year === null ? '' : year === 'last' ? ' over the last year' : ` in ${year}`;
  return username ? `@${username}'s contributions${span}` : `Contributions${span}`;
}

export const KEYBOARD_HINT =
  'Use the arrow keys to move between days. Press Enter or Space to press a key.';

function keyHTML(cell: KeyCell, tabbable: boolean, label: string): string {
  const future = cell.future ? ' data-future aria-disabled="true"' : '';
  return (
    `<button type="button" class="kg-key" part="key" data-i="${cell.index}" data-level="${cell.level}"${future}` +
    ` style="grid-area:${cell.row + 1}/${cell.col + 1}" tabindex="${tabbable ? 0 : -1}" aria-label="${escapeHTML(label)}">` +
    `${KEY_PARTS_HTML}</button>`
  );
}

interface BoardOptions {
  showMonthLabels: boolean;
  showDayLabels: boolean;
}

function boardOpen(o: BoardOptions) {
  return `<div class="kg-board"${o.showDayLabels ? ' data-days' : ''}${o.showMonthLabels ? ' data-months' : ''}>`;
}

function labelsHTML(layout: GraphLayout, o: BoardOptions): string {
  let html = '';
  if (o.showMonthLabels) {
    html += '<div class="kg-months" aria-hidden="true">';
    for (const m of layout.months)
      html += `<span class="kg-month" style="grid-column:${m.col + 1}">${escapeHTML(m.label)}</span>`;
    html += '</div>';
  }
  if (o.showDayLabels) {
    html += '<div class="kg-weekdays" aria-hidden="true">';
    for (const d of layout.weekdays)
      html += `<span class="kg-weekday" style="grid-row:${d.row + 1}">${escapeHTML(d.label)}</span>`;
    html += '</div>';
  }
  return html;
}

export function boardHTML(
  layout: GraphLayout,
  o: ResolvedOptions,
  a11y: { label: string; hintId: string },
): string {
  const focus = initialFocusIndex(layout);
  let keys = '';
  for (const cell of layout.cells)
    keys += keyHTML(cell, cell.index === focus, ariaLabelFor(cell, o));
  return (
    boardOpen(o) +
    labelsHTML(layout, o) +
    `<div class="kg-grid" part="grid" role="group" aria-label="${escapeHTML(a11y.label)}" aria-describedby="${a11y.hintId}">` +
    `<div class="kg-fx" aria-hidden="true"></div>${keys}</div></div>`
  );
}

/** Placeholder board: blank caps with a diagonal shimmer. */
export function skeletonBoardHTML(o: ResolvedOptions, columns = SKELETON_COLUMNS): string {
  let keys = '';
  for (let col = 0; col < columns; col++) {
    for (let row = 0; row < 7; row++) {
      keys += `<span class="kg-key" data-skeleton style="grid-area:${row + 1}/${col + 1};--d:${(col + row) * 24}ms">${KEY_PARTS_HTML}</span>`;
    }
  }
  return `${boardOpen({ showDayLabels: o.showDayLabels, showMonthLabels: false })}<div class="kg-grid" aria-hidden="true">${keys}</div></div>`;
}

export function legendHTML(): string {
  let caps = '';
  for (let level = 0; level <= 4; level++)
    caps += `<span class="kg-key" data-level="${level}">${KEY_PARTS_HTML}</span>`;
  return `<div class="kg-legend" aria-hidden="true"><span class="kg-legend-label">Less</span>${caps}<span class="kg-legend-label">More</span></div>`;
}

export function yearSelectorHTML(years: readonly YearSelection[], selected: YearSelection): string {
  let html = '<div class="kg-years" role="group" aria-label="Select year">';
  for (const year of years) {
    html += `<button type="button" class="kg-year" part="year" data-year="${year}" aria-pressed="${year === selected}">${formatYearOption(year)}</button>`;
  }
  return `${html}</div>`;
}
