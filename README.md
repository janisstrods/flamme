# Tour de Jour (working title)

Private browser game for a group of friends: a cycling race card-and-board game with online play,
AI opponents and a multi-stage tour mode. Not a public release.

```
packages/engine    pure rules engine        apps/server  rooms, sessions, persistence, AI runner
packages/content   tiles, stages, tours     apps/web     React client
packages/ai        bots                     docs/        rules spec, decisions, QA
packages/protocol  shared Zod contracts
```

Setup: `npx -y pnpm@10.34.9 install`, then `npx -y pnpm@10.34.9 check`.
See `CLAUDE.md` for working rules and `docs/OWNER_QUESTIONS.md` for what M0 is waiting on.
