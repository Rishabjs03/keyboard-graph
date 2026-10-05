import type { ContributionDay, YearSelection } from './types.js';

const DAY_MS = 86_400_000;

/** Parse `YYYY-MM-DD` as a UTC midnight timestamp so local timezones never shift the day. */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return toISODate(new Date(parseISODate(iso).getTime() + days * DAY_MS));
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / DAY_MS);
}

/** Today's date in the viewer's local timezone, as `YYYY-MM-DD`. */
export function localToday(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Intl formatters are comparatively expensive to build, and ~370 labels are
// formatted per render, so they are cached per locale + options.
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function dateFormatter(locale: string | undefined, options: Intl.DateTimeFormatOptions) {
  const key = `${locale ?? ''}|${JSON.stringify(options)}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...options });
    formatterCache.set(key, formatter);
  }
  return formatter;
}

/** "No contributions" / "1 contribution" / "1,204 contributions". */
export function formatCount(count: number, locale?: string): string {
  if (count === 0) return 'No contributions';
  if (count === 1) return '1 contribution';
  return `${count.toLocaleString(locale ?? 'en-US')} contributions`;
}

/** Tooltip text, e.g. "12 contributions on Mon, 12 Aug 2026". */
export function formatTooltipText(day: ContributionDay, locale?: string): string {
  const date = dateFormatter(locale ?? 'en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parseISODate(day.date));
  return `${formatCount(day.count, locale)} on ${date}`;
}

/** Screen-reader label, e.g. "12 contributions on August 12, 2026". */
export function formatAriaLabel(day: ContributionDay, locale?: string): string {
  const date = dateFormatter(locale ?? 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parseISODate(day.date));
  return `${formatCount(day.count, locale)} on ${date}`;
}

export function formatMonth(iso: string, locale?: string): string {
  return dateFormatter(locale ?? 'en-US', { month: 'short' }).format(parseISODate(iso));
}

export function formatWeekday(iso: string, locale?: string): string {
  return dateFormatter(locale ?? 'en-US', { weekday: 'short' }).format(parseISODate(iso));
}

/** "1,576 contributions in the last year" / "No contributions in 2024". */
export function formatTotal(total: number, year: YearSelection | null, locale?: string): string {
  const span = year === null ? '' : year === 'last' ? ' in the last year' : ` in ${year}`;
  return `${formatCount(total, locale)}${span}`;
}

export function formatYearOption(year: YearSelection): string {
  return year === 'last' ? 'Last year' : String(year);
}
