'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { resolveTheme, themes, type CustomTheme, type ThemeName } from 'keyboard-graph';
import { KeyboardGraph, type KeyboardGraphHandle, type SwitchProfile } from 'keyboard-graph/react';
import { htmlSnippet, INSTALL_COMMAND, reactSnippet, type SnippetSettings } from '@/lib/snippet';
import { useTypeToPlay } from '@/lib/useTypeToPlay';
import { CodeTabs, CopyButton } from './CodeBlock';
import {
  ControlRow,
  LevelColors,
  Segmented,
  Stem,
  ThemeSwatches,
  Toggle,
  type SegmentOption,
} from './controls';
import { Footer } from './Footer';
import { Header } from './Header';
import { Keyboard, Moon, Sun, Volume, VolumeOff } from './icons';
import { KeyboardStage } from './KeyboardStage';
import { Reveal } from './Reveal';
import { configureUiSound, uiClick } from './uiSound';
import { UsernameForm, type SubmitStatus } from './UsernameForm';

const DEFAULT_USER = 'Rishabjs03';
const ENDPOINT = '/api/contributions/{username}?y={year}';

type Point = { x: number; y: number };

const SWITCHES: (SegmentOption<SwitchProfile> & { hint: string })[] = [
  { value: 'blue', label: 'Blue', icon: <Stem color="#3b82f6" />, hint: 'Clicky' },
  { value: 'brown', label: 'Brown', icon: <Stem color="#9a5b2f" />, hint: 'Tactile' },
  { value: 'red', label: 'Red', icon: <Stem color="#ef4444" />, hint: 'Linear' },
  { value: 'cream', label: 'Cream', icon: <Stem color="#e9d8b4" />, hint: 'Deep thock' },
];

const SCHEMES: SegmentOption<'light' | 'dark'>[] = [
  { value: 'light', label: 'Light', icon: <Sun width={14} height={14} /> },
  { value: 'dark', label: 'Dark', icon: <Moon width={14} height={14} /> },
];

function SectionTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-8 text-center">
      <div className="text-[12px] font-medium uppercase tracking-[0.18em] text-faint">
        {eyebrow}
      </div>
      <h2 className="mt-2.5 text-[28px] font-semibold tracking-[-0.035em]">{title}</h2>
      {children && (
        <p className="mx-auto mt-2.5 max-w-[52ch] text-[14.5px] leading-relaxed text-muted">
          {children}
        </p>
      )}
    </div>
  );
}

export function Playground() {
  const reduce = useReducedMotion();
  const graph = useRef<KeyboardGraphHandle>(null);

  // ── Data source ───────────────────────────────────────────────────────────
  const [input, setInput] = useState(DEFAULT_USER);
  const [username, setUsername] = useState(DEFAULT_USER);
  const [status, setStatus] = useState<SubmitStatus>('loading');
  const [error, setError] = useState('');
  const successTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── Appearance ────────────────────────────────────────────────────────────
  const [theme, setTheme] = useState<ThemeName>('github');
  const [customLevels, setCustomLevels] = useState<string[] | null>(null);
  const [scheme, setScheme] = useState<'light' | 'dark'>('light');
  const [origin, setOrigin] = useState<Point | null>(null);

  // ── Sound & motion ────────────────────────────────────────────────────────
  const [sound, setSound] = useState<SwitchProfile>('brown');
  const [volume, setVolume] = useState(0.5);
  const [muted, setMuted] = useState(false);
  const [ghost, setGhost] = useState(true);

  const typed = useTypeToPlay(graph);

  useEffect(() => {
    configureUiSound({ sound, volume, muted });
  }, [sound, volume, muted]);
  useEffect(() => () => clearTimeout(successTimer.current), []);

  const themeValue: ThemeName | CustomTheme = useMemo(
    () => (customLevels ? { extends: theme, levels: customLevels } : theme),
    [theme, customLevels],
  );
  const palette = useMemo(() => resolveTheme(themeValue)[scheme], [themeValue, scheme]);

  const submit = useCallback(() => {
    if (!input) return;
    uiClick();
    if (input.toLowerCase() === username.toLowerCase()) {
      setStatus('success');
      clearTimeout(successTimer.current);
      successTimer.current = setTimeout(() => setStatus('idle'), 1200);
      return;
    }
    setStatus('loading');
    setError('');
    setUsername(input);
  }, [input, username]);

  const onLoad = useCallback(() => {
    setStatus('success');
    clearTimeout(successTimer.current);
    successTimer.current = setTimeout(() => setStatus('idle'), 1400);
  }, []);

  const onError = useCallback(
    (err: { code: string; message: string }) => {
      setStatus('error');
      setError(
        err.code === 'not-found'
          ? `No GitHub user called “${username}”.`
          : 'Couldn’t load contributions. Try again in a moment.',
      );
    },
    [username],
  );

  const selectTheme = (name: ThemeName, at: Point) => {
    setOrigin(at);
    setTheme(name);
    setCustomLevels(null);
  };

  const setLevel = (index: number, color: string, at: Point) => {
    setOrigin(at);
    setCustomLevels((current) => {
      const next = [...(current ?? themes[theme][scheme].levels)];
      next[index] = color;
      return next;
    });
  };

  const settings: SnippetSettings = {
    username,
    theme,
    customLevels,
    colorScheme: scheme,
    sound,
    volume,
    muted,
    ghostTyping: ghost,
  };
  const snippets = [
    { id: 'react', label: 'React', code: reactSnippet(settings) },
    { id: 'html', label: 'HTML', code: htmlSnippet(settings) },
  ];

  return (
    <main className="mx-auto flex w-full max-w-[1240px] flex-col items-center px-4 sm:px-8">
      <section className="flex w-full flex-col items-center pt-20 sm:pt-28">
        <Header />
        <motion.div
          className="mt-10 w-full"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
        >
          <UsernameForm
            value={input}
            onChange={setInput}
            onSubmit={submit}
            status={status}
            error={error}
          />
        </motion.div>
      </section>

      <section className="mt-12 w-full max-w-[1200px] sm:mt-16" aria-label="Contribution keyboard">
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <KeyboardStage
            palette={palette}
            scheme={scheme}
            soundOn={!muted}
            ghostOn={ghost}
            typed={typed}
          >
            <KeyboardGraph
              ref={graph}
              username={username}
              endpoint={ENDPOINT}
              theme={themeValue}
              colorScheme={scheme}
              sound={sound}
              volume={volume}
              muted={muted}
              yearSelector
              keySize={20}
              ghostTyping={ghost}
              themeTransition={{ origin }}
              onLoad={onLoad}
              onError={onError}
            />
          </KeyboardStage>
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6, duration: 0.8 }}
          className="mt-12 flex items-center justify-center gap-2 text-[12.5px] text-faint"
        >
          <Keyboard width={14} height={14} />
          Press any key — or just start typing your name.
        </motion.p>
      </section>

      <section className="mt-24 w-full max-w-[880px]" aria-labelledby="customise">
        <Reveal>
          <SectionTitle eyebrow="Customise" title="Make it yours">
            Every option below is a prop. The snippet further down updates as you play.
          </SectionTitle>
        </Reveal>
        <Reveal delay={0.05}>
          <div className="divide-y divide-line rounded-2xl border border-line bg-white px-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_20px_40px_-30px_rgba(0,0,0,0.2)] sm:px-7">
            <ControlRow label="Theme" hint="Eight presets, light & dark">
              <ThemeSwatches value={theme} scheme={scheme} onChange={selectTheme} />
            </ControlRow>
            <ControlRow label="Level colours" hint="Click a keycap to pick">
              <LevelColors
                levels={palette.levels}
                custom={customLevels !== null}
                onChange={setLevel}
                onReset={() => {
                  setOrigin(null);
                  setCustomLevels(null);
                }}
              />
            </ControlRow>
            <ControlRow label="Switch" hint={SWITCHES.find((s) => s.value === sound)?.hint}>
              <Segmented
                label="Switch sound"
                options={SWITCHES}
                value={sound}
                onChange={(value) => {
                  setSound(value);
                  setMuted(false);
                }}
              />
            </ControlRow>
            <ControlRow label="Volume">
              <div className="flex max-w-[340px] items-center gap-3">
                <motion.button
                  type="button"
                  onClick={() => setMuted((m) => !m)}
                  whileTap={{ scale: 0.9 }}
                  aria-label={muted ? 'Unmute' : 'Mute'}
                  aria-pressed={muted}
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors ${
                    muted ? 'bg-neutral-100 text-faint' : 'text-ink hover:bg-neutral-100'
                  }`}
                >
                  {muted ? <VolumeOff /> : <Volume />}
                </motion.button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  onChange={(e) => {
                    setVolume(Number(e.target.value));
                    setMuted(false);
                  }}
                  aria-label="Volume"
                  className="range w-full"
                  style={{ ['--fill' as string]: `${(muted ? 0 : volume) * 100}%` }}
                />
                <span className="w-9 text-right font-mono text-[12px] tabular-nums text-muted">
                  {Math.round((muted ? 0 : volume) * 100)}
                </span>
              </div>
            </ControlRow>
            <ControlRow label="Mode" hint="The graph’s colour scheme">
              <Segmented
                label="Colour scheme"
                options={SCHEMES}
                value={scheme}
                onChange={(value, at) => {
                  setOrigin(at);
                  setScheme(value);
                }}
              />
            </ControlRow>
            <ControlRow
              label="Ghost typing"
              hint="Idle keys press themselves; stops when you interact"
            >
              <Toggle checked={ghost} onChange={setGhost} label="Ghost typing" />
            </ControlRow>
          </div>
        </Reveal>
      </section>

      <section className="mt-24 w-full max-w-[880px]" aria-labelledby="code">
        <Reveal>
          <SectionTitle eyebrow="Get the code" title="One line to drop in">
            Works in React, or anywhere HTML does — Astro, Vue, Svelte, plain pages.
          </SectionTitle>
        </Reveal>
        <Reveal delay={0.05}>
          <div className="mb-4 flex items-center justify-between gap-3 rounded-full border border-line bg-white py-1.5 pl-5 pr-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <code className="truncate font-mono text-[13px]">
              <span className="select-none text-faint">$ </span>
              {INSTALL_COMMAND}
            </code>
            <CopyButton text={INSTALL_COMMAND} />
          </div>
          <CodeTabs tabs={snippets} />
        </Reveal>
      </section>

      <div className="mt-28 w-full">
        <Reveal margin="0px">
          <Footer />
        </Reveal>
      </div>
    </main>
  );
}
