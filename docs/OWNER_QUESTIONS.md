# Open questions for the owner (M0)

M0 closes when the open items are answered. Defaults apply where noted.

## Still open

1. **Hosting** and the room-creation passphrase (env var, not in git). Researched 2026-11-10:

   | Host                 | Smallest setup per month                                              | Notes                                                                                    |
   | -------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
   | Fly.io (recommended) | about $3.84 (512 MB + 1 GB volume); bills under $5 are usually waived | Deploys the Dockerfile; idle WebSockets drop after about 60 s, so the client sends pings |
   | Railway              | $5 flat (usage included)                                              | Easiest deploy; long-lived WebSockets can drop after 1–2 h                               |
   | Render               | about $7.25 (Starter + 1 GB disk)                                     | A disk limits it to one instance, no zero-downtime deploys                               |
   | Hetzner VPS          | €5.49 (CPX02, Helsinki)                                               | No limits, but you run the OS, Docker, TLS, updates and backups                          |

   Whichever host: the client sends heartbeats and reconnects automatically (planned for M4).

2. ~~**Working title**~~: "Tour de Jour" (owner, 2026-11-10). Package scope stays `@velo/*` internally.

## House rules (the rulebooks are silent; these defaults apply unless you say otherwise)

| Topic                         | Default                                                       |
| ----------------------------- | ------------------------------------------------------------- |
| Exhaustion supply runs out    | Never: supplies are unlimited                                 |
| A rider with no cards at all  | Plays an exhaustion card from the supply                      |
| Weather on Peloton straights  | Yes: every straight tile except start and finish gets a token |
| Crashed riders and exhaustion | Normal exhaustion rules apply                                 |
| Dummy teams in tours          | Allowed as non-scoring pace riders                            |

## Defaults to confirm

| Decision                            | Default                             |
| ----------------------------------- | ----------------------------------- |
| Base-game start order               | Random first placer, then clockwise |
| Handicap (base-game rule)           | Available as a room option          |
| Show remaining opponent card values | On, as a room option                |
| Turn timer                          | Off                                 |
| Spectators                          | Allowed                             |

## Done

- Timing tile values and Grand Tour tile layouts: confirmed from BoardGameGeek punchboard photos, 2026-11-10.

- Rulebooks: base, Peloton, Meteo and Grand Tour in `docs/rules/`; all rules checked
  (`RULES_SPEC.md`, `RULES_DECISIONS.md`), 2026-11-10.
- Specialists: the rulebook table is complete; transcribed to `packages/content/src/data/specialists.ts`.
- Base and Peloton tiles: imported from flamme-rouge-tracks.com (draft).
- Private repo `janisstrods/flamme`, 2026-11-10.
- Stages: original designs, generator and editor instead of published stage cards (C-002).
