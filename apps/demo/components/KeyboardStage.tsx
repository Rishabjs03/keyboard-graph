'use client';

import { AnimatePresence, motion } from 'motion/react';
import type { CSSProperties, ReactNode } from 'react';
import type { ThemePalette } from 'clacky';

interface Props {
  palette: ThemePalette;
  scheme: 'light' | 'dark';
  soundOn: boolean;
  ghostOn: boolean;
  typed: string;
  children: ReactNode;
}

function Led({ on, color, label }: { on: boolean; color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <motion.span
        className="block h-1.5 w-1.5 rounded-full"
        initial={false}
        animate={{
          backgroundColor: on ? color : 'rgba(127,127,127,0.35)',
          boxShadow: on ? `0 0 6px 1px ${color}` : '0 0 0 0 rgba(60,42,18,0)',
        }}
        transition={{ duration: 0.35 }}
      />
      <span>{label}</span>
    </span>
  );
}

/**
 * The keyboard "case" the graph sits in: a body tinted from the theme's plate
 * colour, a brand engraving, two lock-light LEDs and a soft ground shadow.
 */
export function KeyboardStage({ palette, scheme, soundOn, ghostOn, typed, children }: Props) {
  const dark = scheme === 'dark';
  const style = {
    '--case': dark
      ? `color-mix(in oklab, ${palette.plate} 92%, white)`
      : `color-mix(in oklab, ${palette.plate} 45%, white)`,
    '--case-edge': dark
      ? `color-mix(in oklab, ${palette.plate} 70%, black)`
      : `color-mix(in oklab, ${palette.plate} 70%, #d4d4d8)`,
    color: palette.text,
  } as CSSProperties;

  return (
    <div className="relative w-full">
      {/* Floating bubble that echoes what you type (the easter egg). */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-12 flex justify-center"
        aria-hidden="true"
      >
        <AnimatePresence>
          {typed && (
            <motion.div
              key="typed"
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 500, damping: 32 }}
              className="rounded-full bg-ink px-3.5 py-1.5 font-mono text-[13px] tracking-wide text-white shadow-lg"
            >
              {typed}
              <span className="ml-0.5 inline-block w-[7px] animate-pulse">▍</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div
        style={style}
        className="relative rounded-[26px] bg-[var(--case)] p-3 pt-2.5 transition-[background-color,color] duration-700 sm:p-4 sm:pt-3"
      >
        {/* Case bevel + layered shadow so the keyboard sits on the page. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[26px] transition-shadow duration-700"
          style={{
            boxShadow: dark
              ? 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -2px 0 rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.6), 0 30px 60px -30px rgba(40,26,8,0.6), 0 16px 32px -20px rgba(40,26,8,0.4)'
              : 'inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -2px 0 var(--case-edge), 0 0 0 1px rgba(60,42,18,0.06), 0 30px 60px -32px rgba(60,42,18,0.28), 0 14px 28px -20px rgba(60,42,18,0.16)',
          }}
        />
        <div className="relative mb-1.5 flex items-center justify-between px-2 text-[9.5px] font-medium uppercase tracking-[0.22em] opacity-70">
          <span>clacky</span>
          <span className="flex items-center gap-3.5 tracking-[0.16em]">
            <Led on={soundOn} color={palette.levels[3]} label="Sound" />
            <Led on={ghostOn} color={palette.levels[3]} label="Idle" />
          </span>
        </div>
        <div className="relative">{children}</div>
      </div>

      {/* Ground shadow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[6%] -bottom-7 -z-10 h-12 rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(60,42,18,0.3),transparent_70%)] blur-md"
      />
    </div>
  );
}
