# Contributing to clacky

Thanks for helping! This is a small, focused library, so a quick issue before a large PR saves everyone time.

## Setup

```bash
corepack enable          # uses the pnpm version pinned in package.json
pnpm install
pnpm dev                 # library watcher + demo site on http://localhost:3000
```

Requirements: Node 20.9+ and pnpm 10.

## Project layout

| Path                          | What lives there                                                  |
| ----------------------------- | ----------------------------------------------------------------- |
| `packages/clacky/src/core`    | Framework-agnostic logic: data, layout, themes, CSS, interactions |
| `packages/clacky/src/audio`   | Switch recording loader and Web Audio playback                    |
| `packages/clacky/src/react`   | The React component (Motion animations)                           |
| `packages/clacky/src/element` | The `<clacky-graph>` custom element (WAAPI animations)            |
| `packages/clacky/src/server`  | The GitHub GraphQL proxy helper                                   |
| `apps/demo`                   | The Next.js showcase site                                         |
| `examples`                    | Copy-pasteable integrations                                       |

**Rule of thumb:** behaviour belongs in `core` so both wrappers get it. The wrappers only render DOM
and plug in an animator. Both render the same class names and use the one stylesheet in
`core/styles.ts`.

## Before you open a PR

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

CI runs the same commands. Please also:

- Add or update tests in `packages/clacky/test` for logic changes (layout, data, themes, audio maths).
- Check visual changes in the demo in **light and dark** and with **reduced motion** turned on (DevTools → Rendering → Emulate `prefers-reduced-motion`).
- Keep hot paths cheap: presses must only animate `transform`/`opacity`, and nothing should add per-key listeners.
- Keep the bundle small: `pnpm --filter clacky size` prints the gzip size of every entry.
- Never commit tokens. The demo reads `GITHUB_TOKEN` from the environment (see `apps/demo/.env.example`).

## Adding a theme

Add a preset to `themes` in `packages/clacky/src/core/theme.ts` with a light **and** a dark
palette, then add its name to the `ThemeName` union. Level 0 should read as a neutral, blank cap.

## Adding or replacing a switch profile

Sounds must come from recordings you have the rights to ship under MIT, which in practice means
**CC0**. Slice a recording into a sprite, regenerate the modules, then credit it in
`packages/clacky/sounds/SOURCES.md`:

```bash
python3 packages/clacky/scripts/slice-recordings.py <profile> packages/clacky/sounds path/to/recording.mp3
pnpm --filter clacky sounds
```

A new profile name also needs adding to `SwitchProfile` and the loaders in `src/audio/`.

## Releasing (maintainers)

1. Bump `version` in `packages/clacky/package.json`.
2. Commit, then create a GitHub release with a `v<version>` tag.
3. The **Release** workflow builds, tests and publishes to npm with provenance (requires the `NPM_TOKEN` secret).
