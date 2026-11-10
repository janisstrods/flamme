# Rules specification

> **Status: verified against the rulebooks** in `docs/rules/` (base 2016, Peloton 2017, Meteo 2018,
> Grand Tour v1.0 2024), 2026-11-10. Our own restatement, never quoted text. Citations give the
> rulebook and page: `[B3]` base p.3, `[P2]` Peloton p.2, `[M2]` Meteo p.2, `[G9]` Grand Tour p.9.
> Points the rulebooks leave open are tagged **[HOUSE]** and listed in `RULES_DECISIONS.md`.
>
> Rule ids are stable; tests name the rule they cover, e.g. `it('B-MOV-4: …')`.

Conventions:

- **Lane 0 is the rightmost lane** in the direction of travel. Negative lanes are the verge to the
  right of the road (Nimble only, G-SPC-7).
- **Frontmost rider**: the rider nearest the finish; on the same square, the lower lane. [B3]
- **Pack**: one or more riders with no empty square between them. [B3]

---

## Base game

### Components and setup

- **B-SET-1** Each team has a rouleur and a sprinteur. [B1]
- **B-SET-2** Each rider has a 15-card energy deck. Rouleur: three each of 3, 4, 5, 6, 7.
  Sprinteur: three each of 2, 3, 4, 5, 9. [B1 card art, matches 120 energy cards for 4 teams]
- **B-SET-3** Exhaustion cards have value 2, in two face-up supplies (rouleur and sprinteur).
  Base has 60, Peloton adds 30. Running out is not covered: **[HOUSE]** supplies are unlimited. [B1, P1]
- **B-SET-4** Each rider deck is shuffled face down. [B2]
- **B-SET-5** Placement: a random player places first **[HOUSE: replaces "most recently rode a
  bike"]**, then clockwise, one rider at a time, on any grid square behind the start line that has a
  free lane. A rider placed on an empty square takes lane 0. [B2]
- **B-SET-6 Handicap (optional).** Experienced players add 1 exhaustion card to each of their
  rider decks at setup; very experienced players add 2. [B4]

### Round structure

Energy phase, then movement phase, then end phase. [B1]

### Energy phase (all teams at once)

- **B-ENG-1** Each team picks one rider and draws 4 cards from its deck. [B3]
- **B-ENG-2** It plays 1 card face down and recycles the other 3: face up under the deck. [B3]
- **B-ENG-3** Only then does the team draw for its other rider. A played card is never changed.
  Players may look at their own played and recycled cards; never at face-down cards. [B3]
- **B-ENG-4** If the face-down cards run out mid-draw, shuffle the recycled cards into a new deck
  and keep drawing up to 4. [B3]
- **B-ENG-5** If fewer than 4 cards exist in total, draw them all. [B3]
- **B-ENG-6** If no cards exist at all: **[HOUSE]** the rider plays an exhaustion card from the
  supply. (Not covered by the rulebook.)

### Movement phase

- **B-MOV-1** Reveal all played cards. [B3]
- **B-MOV-2** Riders move one at a time, frontmost first. [B3]
- **B-MOV-3** A rider moves exactly its effective value. It may pass through other riders and
  change lanes freely. [B3]
- **B-MOV-4** It may not end on a full square: it stops on the first square behind with a free
  lane. [B3]
- **B-MOV-5** A rider arriving on an empty square takes lane 0; on a part-filled square it takes
  the lowest free lane. [B2, B3]

### Terrain

- **B-TER-1 Ascent cap.** A rider that starts on, moves onto or passes through any ascent square
  moves at most 5. [B4]
- **B-TER-2 Ascent edge.** If only the 6th or later step would enter the first ascent square, the
  rider instead stops before the ascent (on the last free lane before it starts). [B4]
- **B-TER-3** A rider on an ascent square neither gives nor receives slipstream. Exhaustion is
  normal. [B4]
- **B-TER-4 Descent.** A rider that starts on a descent square moves at least 5. Slipstream is
  normal. [B4]

### Effective value order

- **B-VAL-1** Card value → minimums (descent 5, supply zone 4, Strong Descents 7) → crash recovery
  −2 → ascent cap (5, or 6/7 with Strong Ascents). [M2, G12]

### End phase

- **B-END-1** Remove played cards. A played exhaustion card is gone for the race. [B3]
- **B-END-2 Slipstream.** From the rearmost pack forward: a pack with exactly one empty square
  before the next pack moves up one square, merging with it; then check the merged pack, and so
  on. A rider can slipstream several times in one round. [B3]
- **B-END-3 Exhaustion.** Every rider with an empty square directly ahead takes an exhaustion card
  of its type into its recycled pile. An empty lane ahead does not count. [B3]

### Finish

- **B-FIN-1** Play the round in which a rider first crosses the line to its end. [B1]
- **B-FIN-2** The rider furthest past the line wins; on the same square, the lower lane wins. [B1, B3]

---

## Peloton

- **P-GEN-1** Teams five and six. Squares can have 1, 2 or 3 lanes. [P1]
- **P-COB-1 Cobblestones.** No slipstream to or from a rider on cobblestones. [P1]
- **P-SUP-1 Supply zone.** A rider starting its turn in a supply zone moves at least 4.
  Slipstream is normal. [P1]
- **P-SUP-2 Narrowing slipstream.** When a pack slipstreams from a wider square into a narrower
  one, riders move in lane order until the square is full; a rider that does not fit stays put but
  shifts to the lowest free lane of its square, and riders behind it do not move. [P1]
- **P-BRK-1 Breakaway variant.** The tile after the start is the breakaway tile #2: white side
  for 5–6 players, black side for 1–4. [P2]
- **P-BRK-2** Before round 1, each team picks one rider to bid. Two bidding rounds: draw 4, play 1
  face down, recycle 3, reveal. [P2]
- **P-BRK-3** Highest two-card total wins: 1 rider with 2–4 players, 2 riders with 5–6. The higher
  bid takes the rightmost lane. Ties go to the backmost rider (furthest back, then leftmost). [P2]
- **P-BRK-4** Winners' bid cards leave the game, and each winner recycles 2 exhaustion cards.
  Losers recycle their bid cards. Then every rider shuffles its recycled cards into its deck. [P2]
- **P-TIL-1** Tile #9 (the "bonus tile") is a half-length 3-lane tile added in 5–6 player stages.
  It has no special rule. [P2]
- **P-PEL-1 Peloton dummy team.** At most one. One rouleur deck plus 2 attack cards (front rider 2,
  rear rider 9). One card flipped per round after humans reveal; both riders move by it, in normal
  order. [P3]
- **P-MUS-1 Muscle dummy team.** Any number. Both normal decks; 1 muscle card (value 5) added to
  the sprinteur deck. Each rider flips its own top card. [P1, P3]
- **P-DUM-1** Dummy teams place before humans (Peloton team first), as far forward as possible:
  Peloton riders one in front of the other; Muscle sprinteur in front of its rouleur. They take
  slipstream, never take exhaustion and never bid. [P3]
- **P-SOLO-1** Solo: one Peloton and one Muscle team; the player starts with 3 exhaustion cards
  split between their riders (more for difficulty). [P3]
- **P-ONE-1 One rider each (up to 12).** No player boards; each player picks one rider and races
  its deck; placement as base; breakaway recommended with the black side. [P4]
- **P-DES-1 Stage design.** 9 straight tiles plus all turns; each expansion tile replaces a base
  straight; 2–3 ascent/cobble sections; no supply zone next to the finish; 5–6 players: add tile
  #9 and both supply zones. [P2, G16]

## Meteo

- **M-SET-1** Shuffle 13 tokens (4 weather, 9 fair). Deal one face up to each straight tile except
  start and finish; replace weather tokens with the matching effect. [M1] **[HOUSE]** "straight
  tile" includes Peloton straights.
- **M-CRS-1 Crosswind.** No slipstream to or from a rider on the tile. [M2]
- **M-TAI-1 Tailwind.** A rider starting its turn on the tile draws 5. [M2]
- **M-HEA-1 Headwind.** A rider starting its turn on the tile draws 3. [M2]
- **M-WET-1 Wet.** A rider that ends its move on the tile after losing at least one square to
  blocking crashes (C-rules). [M2]

### Crashes (Meteo wet, Grand Tour sharp corners)

- **C-1** The crashed rider lies in its lane and still occupies it. [M2]
- **C-2** No slipstream to or from a square holding any crashed rider. [M2, G9]
- **C-3** A square with every lane crashed is impassable: a rider that would pass through it stops
  on the closest free lane behind, and crashes too if that square is wet or a sharp corner. [M2, G9]
- **C-4** Next move: stand up and subtract 2 (after minimums, before the ascent cap). A 2 means it
  stands up without moving, and moves to the lowest free lane of its square. [M2, G9]

## Grand Tour

### Tour structure

- **G-TOU-1** 3–21 stages in any order; presets: basic 7-stage tour, full 21-stage tour (needs
  Peloton). 5–6 players always need Peloton. [G3]
- **G-TOU-2** Rest days (optional): one after any stage on shorter tours; on 21 stages, one after
  stage 3, 9 or 10 and one after stage 15 or 16. [G3]
- **G-TOU-3** Stage 1 start order is random. Later stages: least Tour Points places first; if tied,
  the player with the better-placed GC rider loses the tie. [G3]
- **G-TOU-4** Tours always use the wide finish. [G9, G16]

### During a stage

- **G-TOK-1** Major pile 5/3/1 and minor pile 2/1, each on a square, sprint or mountain side up. A
  rider reaching or passing the square takes the top token; several in one round take tokens in
  order of position at the end of the round. Tokens belong to riders and are classification points,
  not Tour Points. [G3, G4]
- **G-TOK-2 Placement procedure.** Major: if any continuous ascent is at least 5 squares, mountain
  side on the first square after the longest one (ties: nearest the finish; on the ascent finish,
  the first square past the line); otherwise sprint side on the first square past the line. Minor:
  sprint side past the line if majors are elsewhere; otherwise mountain side after the longest
  remaining ascent; otherwise sprint side on the first square of a 6-square tile about halfway. [G16]
- **G-POD-1** First three riders across the line: 3, 2, 1 Tour Points to their team. [G4]
- **G-FIN-1** At the end of **every** round in which riders cross the line: (1) slipstream as
  usual; (2) the rider furthest across takes the seconds shown beside its square, and finished
  riders in its pack share them; (3) other finished riders take the seconds of their own pack's
  frontmost rider; (4) every unfinished rider takes a 1-minute time token; (5) exhaustion for
  unfinished riders only; (6) finished riders leave the track. Repeat until all finish. Finish
  time = minutes from tokens + seconds. [G4]
- **G-FIN-2** The ascent finish is all ascent, so no slipstream there. Timing strip: 6 values on
  the flat side, 5 on the ascent side. Values: **owner to read off the tile.** [G3, G4]
- **G-CRD-1** Played exhaustion returns to the supply. Played energy is set aside and returns after
  the stage. [G4]

### Between stages

- **G-BTW-1** Each rider returns half its exhaustion cards (rounded down) to the supply; set-aside
  energy returns to the decks. [G6]
- **G-BTW-2** Jerseys: yellow = lowest total time, green = most sprint points, polka dot = most
  mountain points. One jersey per rider, priority yellow > green > polka dot; the next rider takes
  a displaced jersey. Ties: whoever crossed the line first on the latest stage. [G6]
- **G-BTW-3** Rest day: the GC, SC and MC leaders each earn 1 Tour Point (a rider leading several
  earns each); every other rider repeats G-BTW-1. [G6]
- **G-BTW-4** Then continue, or save and resume later. [G6]

### End of tour

- **G-END-1** Bonus Tour Points by tour length (2 players: always the first column): [G7]

  | Classification                   | 3–7 stages | 8–14 stages | 15–21 stages |
  | -------------------------------- | ---------- | ----------- | ------------ |
  | General (riders, lowest time)    | 3/2/1      | 4/3/2/1     | 5/4/3/2/1    |
  | Team (both riders' times summed) | 1          | 2/1         | 3/2/1        |
  | Sprint (riders)                  | 2/1        | 3/2/1       | 4/3/2/1      |
  | Mountain (riders)                | 2/1        | 3/2/1       | 4/3/2/1      |

- **G-END-2** Score = podium + classification bonus + rest-day points. All ties: whoever crossed the
  line first on the last stage. [G7]

### New tiles

- **G-TIL-1 Wide finish (v/V).** Replaces the normal finish in tours and 5–6 player races; extra
  lanes past the line; v is flat, V is all ascent. [G9]
- **G-TIL-2 Sharp corner (z/Z).** A rider that ends on a marked square after losing at least one
  square to blocking crashes. [G9]
- **G-RND-1 Roundabout (x, y / X, Y).** Three 2-lane squares, then an inner branch of three 1-lane
  squares and an outer branch of five. [G10]
- **G-RND-2** A rider ending where the lanes split goes to the inner branch if possible. Once on a
  branch it stays on it until the tile ends. On arrival at the next tile, normal lane rules. [G10]
- **G-RND-3** A rider must use its exact value; if it cannot, it takes the branch that lets it move
  furthest. [G10]
- **G-RND-4 Order.** Branch riders move first, nearest the tile exit first, inner before outer when
  tied, alternating; then the 2-lane squares in normal order. [G10]
- **G-RND-5 Slipstream.** No slipstream or exhaustion relationship between branches. Riders on the
  last 2-lane square belong to the pack ahead on both branches; resolve the inner branch first; when
  slipstreaming onto the branches, the frontmost rider of that square goes first. [G11]

### Specialists

- **G-SPC-1 Draft.** Before stage 1, random order, snake draft, one specialist per rider. 4–6
  players: two copies of each; 2–3: one. Swaps are applied for the whole tour. [G12]
- **G-SPC-2 Swaps.** Data in `packages/content/src/data/specialists.ts`, transcribed from [G12].
- **G-SPC-3 Strong Ascents.** The ascent cap for this card is 6 or 7 (marked on the card). [G12]
- **G-SPC-4 Strong Descents.** The descent minimum for this card is 7 (not supply zones). [G12]
- **G-SPC-5 Recovery.** On playing it, may return 1 recycled exhaustion card to the supply. [G12]
- **G-SPC-6 Relentless.** The rider takes no exhaustion this round. [G13]
- **G-SPC-7 Nimble.** The rider ends in lane 0 (inner branch on roundabouts), pushing occupants one
  lane left; if the square is full it goes onto the verge to the right (further right for later
  Nimble riders). Moving through an all-crashed square still crashes it. Slipstream places it
  normally. [G13]
- **G-SPC-8 Breakaway.** No rider on this rider's square gives slipstream this round, not even
  within the pack. [G13]
- **G-SPC-9 Chase.** Right after moving: if directly behind a rider whose square has a free lane,
  move into it; if exactly one empty square behind the pack ahead, move up one. Works on ascents,
  cobbles, crosswind and wet. [G13]

### Special stages

- **G-TTT-1 Team time trial.** No tokens. All riders start on the frontmost grid square. Teams
  ignore each other completely (any number of riders per square); slipstream and exhaustion only
  between teammates. Both riders take the slower rider's time; at most one podium place per team.
  [G14]
- **G-ITT-1 Individual time trial.** As TTT, but riders ignore their teammate too: no slipstream
  at all. Each round the rouleur and the sprinteur that played the highest value (all tied) take
  exhaustion. Times separate; podium as usual. [G14]
- **G-EXT-1 Extended stage.** 24 squares longer. The first rider to reach or pass the refresh
  square takes the token (furthest ahead if several). At the end of that round, every rider may take
  back played energy cards up to a total of 24 (25 for the token holder; never exhaustion), then
  shuffles them, its recycled cards and its deck together. [G15]
