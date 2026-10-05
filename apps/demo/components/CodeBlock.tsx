'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { highlight } from 'sugar-high';
import { Check, Copy } from './icons';

function useCopy() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API blocked (e.g. insecure context): fall back to a hidden textarea.
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  }, []);
  return { copied, copy };
}

export function CopyButton({ text, className = '' }: { text: string; className?: string }) {
  const { copied, copy } = useCopy();
  return (
    <motion.button
      type="button"
      onClick={() => void copy(text)}
      whileTap={{ scale: 0.94 }}
      aria-label={copied ? 'Copied' : 'Copy to clipboard'}
      className={`relative flex h-8 items-center gap-1.5 overflow-hidden rounded-full px-3 text-[12.5px] font-medium transition-colors ${
        copied ? 'bg-emerald-50 text-emerald-700' : 'text-muted hover:bg-sand hover:text-ink'
      } ${className}`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={copied ? 'check' : 'copy'}
          initial={{ opacity: 0, y: 8, scale: 0.6 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.6 }}
          transition={{ type: 'spring', stiffness: 600, damping: 30 }}
          className="flex"
        >
          {copied ? <Check width={14} height={14} /> : <Copy width={14} height={14} />}
        </motion.span>
      </AnimatePresence>
      <motion.span layout="position">{copied ? 'Copied' : 'Copy'}</motion.span>
    </motion.button>
  );
}

interface Tab {
  id: string;
  label: string;
  code: string;
}

export function CodeTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]!.id);
  const tab = tabs.find((t) => t.id === active) ?? tabs[0]!;
  const html = useMemo(() => highlight(tab.code), [tab.code]);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_1px_2px_rgba(60,42,18,0.04),0_20px_40px_-28px_rgba(60,42,18,0.2)]">
      <div className="flex items-center justify-between border-b border-line px-2.5 py-2">
        <div role="tablist" aria-label="Snippet language" className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === active}
              onClick={() => setActive(t.id)}
              className={`relative rounded-full px-3.5 py-1.5 text-[13px] transition-colors ${
                t.id === active ? 'text-ink' : 'text-muted hover:text-ink'
              }`}
            >
              {t.id === active && (
                <motion.span
                  layoutId="code-tab"
                  className="absolute inset-0 rounded-full bg-sand"
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                />
              )}
              <span className="relative">{t.label}</span>
            </button>
          ))}
        </div>
        <CopyButton text={tab.code} />
      </div>
      <div className="code relative max-h-[460px] overflow-auto bg-surface/60">
        <AnimatePresence mode="wait" initial={false}>
          <motion.pre
            key={tab.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="px-5 py-5 font-mono text-[12.75px] leading-[1.7]"
          >
            <code dangerouslySetInnerHTML={{ __html: html }} />
          </motion.pre>
        </AnimatePresence>
      </div>
    </div>
  );
}
