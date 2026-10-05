'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { GitHub, Star } from './icons';

export const REPO_URL = 'https://github.com/Rishabjs03/3d-git';
const REPO_API = 'https://api.github.com/repos/Rishabjs03/3d-git';

function useStars() {
  const [stars, setStars] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(REPO_API, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { stargazers_count?: number } | null) => {
        if (typeof json?.stargazers_count === 'number') setStars(json.stargazers_count);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  return stars;
}

const fadeUp = (reduce: boolean | null, delay: number) => ({
  initial: reduce ? { opacity: 0 } : { opacity: 0, y: 14, filter: 'blur(6px)' },
  animate: reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' },
  transition: { duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] as const },
});

function LogoKey() {
  return (
    <span
      className="mk h-[18px] w-[18px] rounded-[5px]"
      style={{ ['--c' as string]: '#40c463', ['--travel' as string]: '3px' }}
    >
      <span className="mk-skirt" />
      <span className="mk-cap" />
    </span>
  );
}

export function Header() {
  const reduce = useReducedMotion();
  const stars = useStars();
  return (
    <header className="flex flex-col items-center text-center">
      <motion.div
        {...fadeUp(reduce, 0)}
        className="flex items-center gap-2 rounded-full border border-line bg-white py-1.5 pl-2 pr-3.5 text-[13px] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
      >
        <LogoKey />
        <span>keyboard-graph</span>
      </motion.div>

      <motion.h1
        {...fadeUp(reduce, 0.08)}
        className="mt-7 max-w-[17ch] text-balance text-[clamp(2.2rem,5.4vw,3.6rem)] font-semibold leading-[1.02] tracking-[-0.045em]"
      >
        Your GitHub graph, as a mechanical keyboard.
      </motion.h1>

      <motion.p
        {...fadeUp(reduce, 0.16)}
        className="mt-5 max-w-[46ch] text-pretty text-[15.5px] leading-relaxed text-muted"
      >
        Every day is a keycap. Press one to feel it travel, hear the switch, and see what you
        shipped. Drop it into your portfolio in one line.
      </motion.p>

      <motion.a
        {...fadeUp(reduce, 0.24)}
        href={REPO_URL}
        target="_blank"
        rel="noreferrer"
        whileHover={{ y: -1 }}
        whileTap={{ y: 1, scale: 0.98 }}
        className="group mt-7 inline-flex items-center overflow-hidden rounded-full border border-line bg-white text-[13px] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.05),0_4px_12px_-6px_rgba(0,0,0,0.12)] transition-shadow hover:shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_20px_-8px_rgba(0,0,0,0.18)]"
      >
        <span className="flex items-center gap-2 py-2 pl-3.5 pr-3">
          <GitHub />
          Star on GitHub
        </span>
        <AnimatePresence initial={false}>
          {stars !== null && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              className="flex items-center gap-1 overflow-hidden whitespace-nowrap border-l border-line py-2 pl-2.5 pr-3.5 tabular-nums text-muted transition-colors group-hover:text-ink"
            >
              <Star className="text-amber-400" />
              {stars.toLocaleString('en-US')}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.a>
    </header>
  );
}
