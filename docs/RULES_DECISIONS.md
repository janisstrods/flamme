# Rules and design decisions

One line per interpretation, ambiguity or house choice. Status: **open** (awaiting rulebook or
owner), **decided**, or **verified** (checked against the official rulebook, page cited).

## Rules

| Id    | Topic                   | Decision                                                                      | Source           | Status  |
| ----- | ----------------------- | ----------------------------------------------------------------------------- | ---------------- | ------- |
| D-001 | Starting decks          | Rouleur 3×{3,4,5,6,7}; sprinteur 3×{2,3,4,5,9}                                | Plan §4          | open    |
| D-002 | Exhaustion value        | 2                                                                             | Plan §4          | open    |
| D-003 | Exhaustion supply       | Treated as unlimited (`exhaustionSupply: null`) until verified                | —                | open    |
| D-004 | Value modifier order    | Minimums, then crash penalty, then ascent cap                                 | Plan §4          | open    |
| D-005 | Ascent trigger          | Cap applies if the move starts on, passes through or ends on an ascent square | Plan §13         | open    |
| D-006 | Finish tie-break        | Lane 0 (rightmost) wins                                                       | Plan §4          | open    |
| D-007 | Base-game start order   | Random (the rulebook's real-world tie-breaker is not used)                    | Plan §13 default | decided |
| D-008 | Dummy teams in tours    | Allowed as non-scoring pace riders                                            | Plan §13 default | open    |
| D-009 | Champion Edition extras | Handicaps only; solo riders, traffic, achievements out of scope               | Plan §13 default | open    |

## Engineering

| Id    | Topic            | Decision                                                                      | Status  |
| ----- | ---------------- | ----------------------------------------------------------------------------- | ------- |
| E-001 | Lane numbering   | Lane 0 is the rightmost lane in the direction of travel                       | decided |
| E-002 | Event privacy    | Every `GameEvent` is public; private data travels only in `GameView.own`      | decided |
| E-003 | Seed privacy     | The seed and RNG state never leave the server (they reveal deck order)        | decided |
| E-004 | Square ids       | `t{tile}.s{segment}.q{square}` (`.b{branch}` inside splits), via `squareIdOf` | decided |
| E-005 | Square index     | Start-line square is 0, grid squares negative, finish square = `finishIndex`  | decided |
| E-006 | RNG              | sfc32 seeded by xmur3, state stored in `GameState.rng`                        | decided |
| E-007 | TypeScript       | Pinned to 6.0.x: typescript-eslint does not support TS 7 yet                  | decided |
| E-008 | Remaining values | `PublicRider.remainingValues` keys by value and includes exhaustion cards     | decided |

## Content and originality

| Id    | Topic                 | Decision                                                                                    | Status                  |
| ----- | --------------------- | ------------------------------------------------------------------------------------------- | ----------------------- |
| C-001 | App name              | Working title "Velo" until the owner picks one; never the published game's name or logo     | open                    |
| C-002 | Published stage cards | Not transcribed. The app ships original stages, the seeded generator and the editor instead | open (owner to confirm) |
| C-003 | Help text             | All rule explanations are written fresh; no rulebook text is pasted into the app            | decided                 |
| C-004 | Specialist names      | Our own display names; mechanics only from the rulebook table                               | decided                 |
