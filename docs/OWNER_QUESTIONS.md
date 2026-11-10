# Open questions for the owner (M0)

M0 closes when the open items are answered. Defaults apply where noted.

## Still open

1. **Timing tile values** (D-017). The rulebook's picture is too blurry to read. Please read the
   seconds off both faces of the physical timing tile (six values on the flat side, five on the
   ascent side), in order from the finish line outwards.
2. **Grand Tour tile check** (C-005). Drafted from the rulebook pictures; please confirm against
   the physical tiles:
   - Wide finish: 1 square before the line, 5 after, with 3 lanes past the line?
   - Sharp corner: 2 two-lane squares, then 3 single-lane squares with the wavy blue line, then 1
     two-lane square? Which side (z or Z) turns left?
3. **Hosting**: which host or VPS, and the room-creation passphrase (stored as an env var, not in git).
4. ~~**Working title**~~: "Tour de Jour" (owner, 2026-11-10). Package scope stays `@velo/*` internally.

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

- Rulebooks: base, Peloton, Meteo and Grand Tour in `docs/rules/`; all rules checked
  (`RULES_SPEC.md`, `RULES_DECISIONS.md`), 2026-11-10.
- Specialists: the rulebook table is complete; transcribed to `packages/content/src/data/specialists.ts`.
- Base and Peloton tiles: imported from flamme-rouge-tracks.com (draft).
- Private repo `janisstrods/flamme`, 2026-11-10.
- Stages: original designs, generator and editor instead of published stage cards (C-002).
