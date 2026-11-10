# Velo (working title)

A private, browser-based implementation of the mechanics of a cycling race board game, with online
multiplayer, AI and a campaign mode. The full plan lives in the owner's Claude Doc
"Flamme Rouge Online: Implementation Plan for Claude Code" (https://claude.ai/artifact/3pysjnHYXgPirYtwst2A5r).

## Commands

pnpm is not installed globally; run it through npx with the pinned version:

- `npx -y pnpm@10.34.9 install`
- `npx -y pnpm@10.34.9 check` (lint, typecheck, test)
- `npx -y pnpm@10.34.9 dev:web` / `dev:server`

## Hard rules

- Original art and text only. Never copy, trace or imitate the published game's art, layouts, icons,
  logo, typography, stage cards or rulebook text. No images fetched from the web.
- Stages are our own designs (decision C-002): a hand-made set covering flat sprints, climbs,
  cobbles, mountain finishes, time trials and 3–21-stage tours, plus the generator and editor.
  This replaces "transcribe every stage card" (plan §5, M0) and "all 21 stage cards" (M9).
- `packages/engine`, `packages/content` and `packages/ai` are pure: no I/O, no `Date`, no
  `Math.random` (ESLint enforces this). Randomness comes from the seeded RNG in state.
- Server is authoritative. Every `GameEvent` is public; private data only in `GameView.own`.
- Lane 0 is the rightmost lane.
- Rules: `docs/RULES_SPEC.md` (our restatement), `docs/RULES_DECISIONS.md` (one line per
  interpretation). Ambiguous rule not covered there: stop and ask the owner.

## Contracts (frozen at end of M0, lead-owned)

- `packages/content/src/schema.ts`: tiles, stages, compiled track, specialists, tours.
- `packages/protocol/src/{config,game,messages}.ts`: config, actions, events, views, wire messages.
- `packages/engine/src/{api,hooks}.ts`: engine API signatures and rule-module hook points.
- Fixtures: `packages/protocol/src/fixtures/`, `packages/content/src/fixtures/`.
  A worker track that needs a contract change asks the lead; it never edits these directly.

## Path ownership (plan §14)

Lead: contracts, `packages/protocol`, `docs/`. Rules: `packages/engine`. Client and art: `apps/web`.
Server: `apps/server`. Content: `packages/content` (data). AI: `packages/ai`.
