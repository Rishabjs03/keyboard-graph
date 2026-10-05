'use client';

import { AnimatePresence, motion, useAnimate, useReducedMotion } from 'motion/react';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Check, Spinner } from './icons';

export type SubmitStatus = 'idle' | 'loading' | 'success' | 'error';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  status: SubmitStatus;
  error?: string;
}

const icon = {
  initial: { opacity: 0, scale: 0.5, rotate: -45, filter: 'blur(2px)' },
  animate: { opacity: 1, scale: 1, rotate: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, scale: 0.5, rotate: 45, filter: 'blur(2px)' },
  transition: { type: 'spring', stiffness: 520, damping: 30 },
} as const;

export function UsernameForm({ value, onChange, onSubmit, status, error }: Props) {
  const [scope, animate] = useAnimate<HTMLFormElement>();
  const reduce = useReducedMotion();
  const [focused, setFocused] = useState(false);

  // A small, physical "nope" shake when the user can't be found.
  useEffect(() => {
    if (status === 'error' && !reduce && scope.current) {
      void animate(scope.current, { x: [0, -7, 6, -4, 3, 0] }, { duration: 0.42, ease: 'easeOut' });
    }
  }, [status, reduce, animate, scope]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (value.trim()) onSubmit();
  };

  return (
    <div className="flex w-full flex-col items-center">
      <motion.form
        ref={scope}
        onSubmit={handleSubmit}
        animate={{
          boxShadow: focused
            ? '0 0 0 4px rgba(10,10,10,0.06), 0 1px 2px rgba(0,0,0,0.06), 0 10px 30px -12px rgba(0,0,0,0.25)'
            : '0 0 0 0px rgba(10,10,10,0), 0 1px 2px rgba(0,0,0,0.05), 0 6px 20px -12px rgba(0,0,0,0.18)',
        }}
        transition={{ duration: 0.25 }}
        className={`flex h-12 w-full max-w-[400px] items-center rounded-full border bg-white pl-5 pr-1.5 transition-colors ${
          status === 'error' ? 'border-red-300' : focused ? 'border-neutral-300' : 'border-line'
        }`}
      >
        <label htmlFor="username" className="select-none whitespace-nowrap text-[15px] text-faint">
          github.com/
        </label>
        <input
          id="username"
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          aria-invalid={status === 'error'}
          aria-describedby={error ? 'username-error' : undefined}
          placeholder="username"
          className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-ink outline-none placeholder:text-faint [&:focus-visible]:outline-none"
        />
        <motion.button
          type="submit"
          aria-label="Show contributions"
          disabled={status === 'loading'}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.92, y: 1 }}
          animate={{ backgroundColor: status === 'success' ? '#16a34a' : '#0a0a0a' }}
          className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_0_rgba(0,0,0,0.25)] disabled:cursor-wait"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {status === 'loading' ? (
              <motion.span key="spin" {...icon} className="absolute">
                <Spinner className="animate-spin" />
              </motion.span>
            ) : status === 'success' ? (
              <motion.span key="check" {...icon} className="absolute">
                <Check />
              </motion.span>
            ) : (
              <motion.span key="arrow" {...icon} className="absolute">
                <ArrowRight />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </motion.form>
      <div className="h-7 pt-2.5" aria-live="polite">
        <AnimatePresence>
          {status === 'error' && error && (
            <motion.p
              id="username-error"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="text-[13px] text-red-600"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
