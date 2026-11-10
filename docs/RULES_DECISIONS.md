# Rules and design decisions

One line per interpretation, ambiguity or house choice. Status: **verified** (rulebook page
cited), **house** (rulebook silent; our choice), **open** (awaiting owner), **decided** (owner or
engineering choice).

## Rules

| Id    | Topic                    | Decision                                                                                               | Source                         | Status   |
| ----- | ------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------ | -------- |
| D-001 | Starting decks           | Rouleur 3×{3,4,5,6,7}; sprinteur 3×{2,3,4,5,9}                                                         | B1                             | verified |
| D-002 | Exhaustion value         | 2; separate rouleur and sprinteur supplies                                                             | B2, B3                         | verified |
| D-003 | Exhaustion supply        | Unlimited (`exhaustionSupply: null`)                                                                   | rulebooks silent               | house    |
| D-004 | Value modifier order     | Minimums, then crash −2, then ascent cap                                                               | M2, G12                        | verified |
| D-005 | Ascent trigger           | Cap if the move starts on, enters or crosses an ascent; if only step 6+ would enter it, stop before it | B4                             | verified |
| D-006 | Finish tie-break         | Lower lane (rightmost) wins                                                                            | B1, B3                         | verified |
| D-007 | Base-game start order    | Random first placer, then clockwise                                                                    | B2 (replaces bike tie-breaker) | decided  |
| D-008 | Dummy teams in tours     | Allowed as non-scoring pace riders                                                                     | rulebooks silent               | open     |
| D-009 | Handicap                 | Base rule: +1 exhaustion per deck (+2 very experienced); room option                                   | B4                             | verified |
| D-010 | Empty deck               | No cards at all: play an exhaustion card from the supply                                               | rulebooks silent               | house    |
| D-011 | Narrowing slipstream     | Riders move in lane order until full; the rest stay and shift right; riders behind stay                | P1                             | verified |
| D-012 | Breakaway tile side      | White for 5–6 players, black for 1–4 (and for 7–12)                                                    | P2, P4                         | verified |
| D-013 | Weather placement        | Every straight-shaped tile except start and finish, Peloton straights included                         | M1 (literal reading)           | house    |
| D-014 | Wet / sharp corner crash | Only the blocked rider crashes; full-crashed squares are impassable                                    | M2, G9                         | verified |
| D-015 | Crashed rider exhaustion | Normal exhaustion rules apply                                                                          | rulebooks silent               | house    |
| D-016 | Tour finish timing       | Applies at the end of every round with finishers, not only the first                                   | G4                             | verified |
| D-017 | Timing strip values      | Not legible in the PDF; owner to read both faces off the tile                                          | G3                             | open     |
| D-018 | Specialist powers        | Strong Ascents caps at 6 or 7 per card; some cards carry two powers                                    | G12                            | verified |
| D-019 | Bonus tile               | Tile #9 is a half-length tile with no special rule                                                     | P2, G16                        | verified |
| D-020 | Muscle card              | Value 5                                                                                                | P1                             | verified |

## Engineering

| Id    | Topic               | Decision                                                                      | Status  |
| ----- | ------------------- | ----------------------------------------------------------------------------- | ------- |
| E-001 | Lane numbering      | Lane 0 is the rightmost lane; negative lanes are the verge (Nimble)           | decided |
| E-002 | Event privacy       | Every `GameEvent` is public; private data travels only in `GameView.own`      | decided |
| E-003 | Seed privacy        | The seed and RNG state never leave the server (they reveal deck order)        | decided |
| E-004 | Square ids          | `t{tile}.s{segment}.q{square}` (`.b{branch}` inside splits), via `squareIdOf` | decided |
| E-005 | Square index        | Start-line square is 0, grid squares negative, finish square = `finishIndex`  | decided |
| E-006 | RNG                 | sfc32 seeded by xmur3, state stored in `GameState.rng`                        | decided |
| E-007 | TypeScript          | Pinned to 6.0.x: typescript-eslint does not support TS 7 yet                  | decided |
| E-008 | Remaining values    | `PublicRider.remainingValues` keys by value and includes exhaustion cards     | decided |
| E-009 | Rider choice action | `chooseRider` serves both the energy phase (deal first) and breakaway bidding | decided |

## Content and originality

| Id    | Topic                 | Decision                                                                                                                                               | Status                      |
| ----- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| C-001 | App name              | Working title "Velo" until the owner picks one; never the published game's name or logo                                                                | open                        |
| C-002 | Published stage cards | Not transcribed. Original stages, the seeded generator and the editor instead                                                                          | decided (owner, 2026-11-10) |
| C-003 | Help text             | All rule explanations are written fresh; no rulebook text is pasted into the app                                                                       | decided                     |
| C-004 | Specialist names      | Generic cycling role names; mechanics from the rulebook table                                                                                          | decided                     |
| C-005 | Tile catalog source   | Base and Peloton from flamme-rouge-tracks.com's data; Grand Tour tiles from the rulebook pictures. All unverified until checked against physical tiles | open                        |
