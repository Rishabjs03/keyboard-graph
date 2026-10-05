# Contributing to keyboard-graph

Thanks for helping! This is a small, focused library, so a quick issue before a large PR saves everyone time.

## Setup

```bash
corepack enable          # uses the pnpm version pinned in package.json
pnpm install
pnpm dev                 # library watcher + demo site on http://localhost:3000
```

Requirements: Node 20.9+ and pnpm 10.

## Project layout

| Path                                  | What lives there                                                  |
| ------------------------------------- | ----------------------------------------------------------------- |
| `packages/keyboard-graph/src/core`    | Framework-agnostic logic: data, layout, themes, CSS, interactions |
| `packages/keyboard-graph/src/audio`   | The switch synthesiser and Web Audio playback                     |
| `packages/keyboard-graph/src/react`   | The React component (Motion animations)                           |
| `packages/keyboard-graph/src/element` | The `<keyboard-graph>` custom element (WAAPI animations)          |
| `packages/keyboard-graph/src/server`  | The GitHub GraphQL proxy helper                                   |
| `apps/demo`                           | The Next.js showcase site                                         |
| `examples`                            | Copy-pasteable integrations                                       |

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

- Add or update tests in `packages/keyboard-graph/test` for logic changes (layout, data, themes, audio maths).
- Check visual changes in the demo in **light and dark** and with **reduced motion** turned on (DevTools → Rendering → Emulate `prefers-reduced-motion`).
- Keep hot paths cheap: presses must only animate `transform`/`opacity`, and nothing should add per-key listeners.
- Keep the bundle small: `pnpm --filter keyboard-graph size` prints the gzip size of every entry.
- Never commit tokens. The demo reads `GITHUB_TOKEN` from the environment (see `apps/demo/.env.example`).

## Adding a theme

Add a preset to `themes` in `packages/keyboard-graph/src/core/theme.ts` with a light **and** a dark
palette, then add its name to the `ThemeName` union. Level 0 should read as a neutral, blank cap.

## Adding a switch profile

Add a recipe to `switchRecipes` in `src/audio/synth.ts`. A recipe is a list of noise and tone layers
with onset times. Keep sounds under 300 ms, and run the audio tests to make sure they render cleanly.

## Releasing (maintainers)

1. Bump `version` in `packages/keyboard-graph/package.json`.
2. Commit, then create a GitHub release with a `v<version>` tag.
3. The **Release** workflow builds, tests and publishes to npm with provenance (requires the `NPM_TOKEN` secret).
