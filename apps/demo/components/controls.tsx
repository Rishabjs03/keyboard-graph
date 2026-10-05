'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useId, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { themeNames, themes, type ThemeName } from 'clacky';
import { uiClick } from './uiSound';

type Point = { x: number; y: number };

export const centerOf = (el: Element): Point => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

/** Label + control row used throughout the panel. */
export function ControlRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:gap-8">
      <div className="w-40 shrink-0">
        <div className="text-[13.5px] font-medium text-ink">{label}</div>
        {hint && <div className="mt-0.5 text-[12.5px] leading-snug text-faint">{hint}</div>}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

const vars = (v: Record<string, string>) => v as CSSProperties;

/** Theme presets as mini keycaps whose top face shows the palette. */
export function ThemeSwatches({
  value,
  scheme,
  onChange,
}: {
  value: ThemeName;
  scheme: 'light' | 'dark';
  onChange: (name: ThemeName, origin: Point) => void;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-4" role="radiogroup" aria-label="Theme preset">
      {themeNames.map((name) => {
        const palette = themes[name][scheme];
        const [, l1, l2, l3, l4] = palette.levels;
        const selected = name === value;
        return (
          <motion.button
            key={name}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={(e: MouseEvent<HTMLButtonElement>) => {
              uiClick();
              onChange(name, centerOf(e.currentTarget));
            }}
            whileHover={reduce ? undefined : 'hover'}
            whileTap={reduce ? undefined : 'tap'}
            initial={false}
            animate={selected ? 'selected' : 'rest'}
            className="group flex min-w-[60px] flex-col items-center gap-2 outline-none"
          >
            <span
              className="mk h-[44px] w-[56px] rounded-[12px] transition-[outline-color] group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-4 group-focus-visible:outline-ink"
              style={vars({
                '--c': l3,
                '--skirt': `color-mix(in oklab, ${l3}, ${palette.side} 34%)`,
                '--face': `linear-gradient(135deg, ${l1} 0%, ${l2} 34%, ${l3} 67%, ${l4} 100%)`,
              })}
            >
              <motion.span
                className="mk-shadow"
                variants={{
                  rest: { opacity: 1, y: 0 },
                  hover: { opacity: 1, y: 1 },
                  tap: { opacity: 0.5 },
                  selected: { opacity: 0.45 },
                }}
              />
              <span className="mk-skirt" />
              <motion.span
                className="mk-cap"
                variants={{
                  rest: { y: 0 },
                  hover: { y: -1.5 },
                  tap: { y: 3.5 },
                  selected: { y: 3 },
                }}
                transition={{ type: 'spring', stiffness: 700, damping: 26 }}
              />
            </span>
            <span
              className={`whitespace-nowrap text-[11.5px] transition-colors ${selected ? 'font-medium text-ink' : 'text-muted group-hover:text-ink'}`}
            >
              {themes[name].label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

function legendColor(hex: string) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
  if (!m) return '#16120d';
  const [r, g, b] = [m[1], m[2], m[3]].map((v) => Number.parseInt(v!, 16) / 255);
  const lum = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  return lum > 0.6 ? 'rgba(22,18,13,0.55)' : 'rgba(255,255,255,0.85)';
}

/** One keycap per level; clicking opens the native colour picker. */
export function LevelColors({
  levels,
  custom,
  onChange,
  onReset,
}: {
  levels: readonly string[];
  custom: boolean;
  onChange: (index: number, color: string, origin: Point) => void;
  onReset: () => void;
}) {
  const id = useId();
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-wrap items-center gap-3">
      {levels.map((color, i) => (
        <motion.label
          key={i}
          htmlFor={`${id}-${i}`}
          whileHover={reduce ? undefined : { y: -1.5 }}
          whileTap={reduce ? undefined : { y: 2 }}
          className="relative cursor-pointer"
          title={`Level ${i} colour`}
        >
          <span className="mk h-10 w-10 rounded-[10px]" style={vars({ '--c': color })}>
            <span className="mk-shadow" />
            <span className="mk-skirt" />
            <span className="mk-cap" />
            <span className="mk-legend" style={{ color: legendColor(color) }}>
              {i}
            </span>
          </span>
          <input
            id={`${id}-${i}`}
            type="color"
            value={color}
            onChange={(e) => onChange(i, e.target.value, centerOf(e.currentTarget.parentElement!))}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={`Level ${i} colour`}
          />
        </motion.label>
      ))}
      <motion.button
        type="button"
        onClick={onReset}
        initial={false}
        animate={{
          opacity: custom ? 1 : 0,
          x: custom ? 0 : -6,
          pointerEvents: custom ? 'auto' : 'none',
        }}
        className="ml-1 rounded-full px-2.5 py-1 text-[12.5px] text-muted transition-colors hover:bg-sand hover:text-ink"
        aria-hidden={!custom}
        tabIndex={custom ? 0 : -1}
      >
        Reset
      </motion.button>
    </div>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

/** Segmented control with a sliding pill. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T, origin: Point) => void;
  label: string;
}) {
  const id = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex flex-wrap rounded-full bg-sand p-1 shadow-[inset_0_1px_2px_rgba(60,42,18,0.06)]"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <motion.button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={(e: MouseEvent<HTMLButtonElement>) => {
              uiClick();
              onChange(option.value, centerOf(e.currentTarget));
            }}
            whileTap={{ scale: 0.96 }}
            className={`relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] transition-colors ${
              active ? 'text-ink' : 'text-muted hover:text-ink'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`${id}-pill`}
                className="absolute inset-0 rounded-full bg-paper shadow-[0_1px_2px_rgba(60,42,18,0.1),0_0_0_0.5px_rgba(60,42,18,0.06)]"
                transition={{ type: 'spring', stiffness: 500, damping: 36 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {option.icon}
              {option.label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

/** iOS-style switch with a springy thumb. */
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        uiClick();
        onChange(!checked);
      }}
      className={`relative flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors duration-300 ${
        checked ? 'justify-end bg-ink' : 'justify-start bg-line-strong'
      }`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 700, damping: 34 }}
        className="h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(60,42,18,0.25)]"
      />
    </button>
  );
}

/** A tiny cross-shaped switch stem in the switch's colour (like an MX stem). */
export function Stem({ color }: { color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <rect x="4.5" y="1" width="3" height="10" rx="1" fill={color} />
      <rect x="1" y="4.5" width="10" height="3" rx="1" fill={color} />
    </svg>
  );
}
