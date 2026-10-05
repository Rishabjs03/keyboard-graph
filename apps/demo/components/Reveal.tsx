'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

/** Subtle fade-up when a section scrolls into view. */
export function Reveal({
  children,
  delay = 0,
  className,
  margin = '0px 0px -12% 0px',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  /** IntersectionObserver root margin. Use '0px' for content at the very bottom of the page. */
  margin?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18, filter: 'blur(4px)' }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
