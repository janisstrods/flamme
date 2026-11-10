# Tour de Jour (working title)

Private browser game for a group of friends: a cycling race card-and-board game with online play,
AI opponents and a multi-stage tour mode. Not a public release. Static site on GitHub Pages; the
host's browser runs each game (docs/adr/0001-host-browser-game.md).

```
packages/engine    pure rules engine        packages/host  room runtime (runs in the host's browser)
packages/content   tiles, stages, tours     apps/web     React client
packages/ai        bots                     docs/        rules spec, decisions, ADRs, QA
packages/protocol  shared Zod contracts
```

Play: http://strods.work/flamme/ (deployed from `main` by GitHub Pages).

Setup: `npx -y pnpm@10.34.9 install`, then `npx -y pnpm@10.34.9 check`.
See `CLAUDE.md` for working rules and `docs/OWNER_QUESTIONS.md` for what M0 is waiting on.
