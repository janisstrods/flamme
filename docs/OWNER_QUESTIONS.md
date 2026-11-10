# Open questions for the owner (M0)

M0 closes when the open items are answered. Defaults apply where noted.

## Still open

1. ~~**Working title**~~: "Tour de Jour" (owner, 2026-11-10). Package scope stays `@velo/*` internally.

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

- Repo public, commits under jstrods@gmail.com; GitHub Pages deploys from `main`, 2026-11-10.

- Hosting: GitHub Pages, with the host's browser running the game (ADR-0001), 2026-11-10.

- Timing tile values and Grand Tour tile layouts: confirmed from BoardGameGeek punchboard photos, 2026-11-10.

- Rulebooks: base, Peloton, Meteo and Grand Tour in `docs/rules/`; all rules checked
  (`RULES_SPEC.md`, `RULES_DECISIONS.md`), 2026-11-10.
- Specialists: the rulebook table is complete; transcribed to `packages/content/src/data/specialists.ts`.
- Base and Peloton tiles: imported from flamme-rouge-tracks.com (draft).
- Private repo `janisstrods/flamme`, 2026-11-10.
- Stages: original designs, generator and editor instead of published stage cards (C-002).
