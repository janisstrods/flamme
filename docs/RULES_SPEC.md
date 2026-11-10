# Rules specification

> **Status: DRAFT, unverified.** Written in our own words from the implementation plan before the
> official rulebooks arrived in `docs/rules/`. Every rule tagged **[VERIFY]** must be checked against
> the PDFs, and the result recorded in `RULES_DECISIONS.md`. Where this file and a rulebook
> disagree, the rulebook wins.
>
> Rule ids (`B-…`, `P-…`, `M-…`, `T-…`) are stable. Tests name the rule they cover, e.g.
> `it('B-MOV-4: blocked rider drops to nearest free square behind', …)`.

Conventions used throughout:

- **Lane 0 is the rightmost lane** in the direction of travel.
- **Ahead / behind** follow the track direction. "Front of the race" is the rider with the highest
  square index; ties broken by lane 0 first.
- A **pack** is a maximal run of occupied squares with no empty square between them.

---

## Base game

### Components and setup

- **B-SET-1** Each team has two riders: a rouleur and a sprinteur, in the team's colour.
- **B-SET-2** Each rider has its own 15-card energy deck. Rouleur: three each of 3, 4, 5, 6, 7.
  Sprinteur: three each of 2, 3, 4, 5, 9. **[VERIFY]**
- **B-SET-3** Exhaustion cards have value 2 and come from a shared supply. Whether the supply can
  run out, and what happens then, is **[VERIFY]**.
- **B-SET-4** Decks are shuffled face down at the start of the race.
- **B-SET-5** Teams place riders on the start grid one rider at a time, in turn order, on any free
  lane of a grid square. Turn order: see open decision "base-game start order" (default random).
  **[VERIFY]** whether all riders must be placed as far forward as possible.

### Round structure

A round has three phases, played in order: energy, movement, end.

### Energy phase

- **B-ENG-1** All teams act at the same time. Each team picks which of its riders to deal for
  first.
- **B-ENG-2** For that rider: draw 4 cards, choose 1 and place it face down, then put the other 3
  face up at the bottom of the rider's deck area (the recycled pile). Only then draw for the second
  rider.
- **B-ENG-3** A chosen card cannot be changed once placed.
- **B-ENG-4** When a rider must draw and its face-down pile is empty, shuffle its recycled pile to
  form a new face-down pile.
- **B-ENG-5** If fewer than 4 cards exist across both piles, draw all of them.
- **B-ENG-6** If no cards exist at all, the rider plays an exhaustion card from the supply.
  **[VERIFY]**

### Movement phase

- **B-MOV-1** All chosen cards are revealed together.
- **B-MOV-2** Riders resolve one at a time from the front of the race to the back. On the same
  square, lane 0 resolves first.
- **B-MOV-3** A rider moves forward exactly its effective card value (after terrain modifiers).
  It may pass through squares holding other riders.
- **B-MOV-4** A rider may not end on a square whose lanes are all occupied. It stops instead on the
  nearest square behind its target that has a free lane, taking the lowest-numbered (rightmost)
  free lane.
- **B-MOV-5** On a square with a free lane, the arriving rider takes the rightmost free lane.

### Terrain

- **B-TER-1 Ascent.** A rider whose move starts on an ascent square, or would pass through or end
  on one, moves at most 5. Higher cards are reduced to 5. **[VERIFY]** the exact trigger, in
  particular a high card that only just reaches the first ascent square.
- **B-TER-2 Descent.** A rider that starts its move on a descent square moves at least 5. Lower
  cards are raised to 5. **[VERIFY]**
- **B-TER-3** Riders on ascent squares neither give nor receive slipstream. **[VERIFY]** the exact
  rule for packs that straddle an ascent.
- **B-TER-4 Modifier order.** Minimums (descent, supply zone) first, then the crash-recovery
  penalty, then the ascent cap. **[VERIFY]**

### End phase

- **B-END-1** Played cards are removed from the race (single race) — see T-CRD for tours.
- **B-END-2 Slipstream.** Starting from the rearmost pack and working forward: if exactly one
  empty square separates a pack from the next pack ahead, every rider in the rear pack moves up one
  square, keeping its lane. The merged pack is then checked against the next pack ahead, so
  slipstream can chain. **[VERIFY]** lane handling when moving from a 3-lane into a 2-lane square.
- **B-END-3 Exhaustion.** After slipstream, every rider with an empty square directly ahead takes
  one exhaustion card into its recycled pile.

### Finish

- **B-FIN-1** The round in which the first rider crosses the finish line is completed in full.
- **B-FIN-2** The rider furthest past the line wins. Ties go to lane 0. **[VERIFY]**
- **B-FIN-3** Places after the winner follow the same ordering.
- **B-FIN-4** In a single race the game ends after that round. In a tour, play continues until
  every rider has finished (T-TIM).

---

## Peloton

- **P-TEAM-1** Adds teams five and six.
- **P-COB-1 Cobblestones.** Single-lane squares. No slipstream onto, from or across cobblestones.
  **[VERIFY]**
- **P-SUP-1 Supply zone.** Three-lane squares. A rider starting its move in a supply zone moves at
  least 4. **[VERIFY]**
- **P-BRK-1 Breakaway bidding (variant).** Before the race, teams bid cards for a breakaway
  position. Tie handling and what happens to bid cards are **[VERIFY]**.
- **P-BON-1** Bonus tile and wide start. **[VERIFY]** exact effect.
- **P-ONE-1 One rider each.** 7–12 players, each controlling one rider. **[VERIFY]** setup changes.
- **P-DUM-1 Peloton dummy team.** One shared deck: a rouleur deck plus two attack cards. Each round
  flip the top card; both riders move by it. On an attack card the front rider moves 2 and the rear
  rider moves 9. At most one per race.
- **P-DUM-2 Muscle dummy team.** Two normal decks plus one extra card in the sprinteur deck
  **[VERIFY value]**. Each rider flips its own top card.
- **P-DUM-3** Dummy teams take slipstream, never take exhaustion and never bid. They are placed on
  the grid in the order the rulebook gives. **[VERIFY]**

## Meteo

- **M-SET-1** Weather tiles are placed on straight track tiles during setup: 13 tiles, 9 of them
  clear. **[VERIFY]** placement procedure.
- **M-CRS-1 Crosswind.** No slipstream on affected squares.
- **M-TAI-1 Tailwind.** A rider starting its turn there draws 5 cards instead of 4. **[VERIFY]**
  trigger square.
- **M-HEA-1 Headwind.** A rider starting there draws 3 instead of 4. **[VERIFY]**
- **M-RAI-1 Rain.** A rider that is blocked (B-MOV-4) and stops on a rain square crashes, along with
  riders it collides with **[VERIFY]**. Crashed riders stand up next round with a −2 penalty.
  **[VERIFY]** full crash rules.

## Grand Tour

### Tour structure

- **T-TOU-1** A tour is 3–21 stages; the team with the most Tour Points at the end wins.
- **T-TOU-2** Stage 1 start order is random. From stage 2 the team with the fewest Tour Points
  places first. **[VERIFY]** tie rule.

### During a stage

- **T-POD-1** The first three riders across the line earn their team 3, 2 and 1 Tour Points.
- **T-TOK-1** A major pile (5, 3, 1) and a minor pile (2, 1) sit beside set squares as sprint or
  mountain points. A rider reaching or passing the square takes the top token. If several pass in
  one round, the rider furthest ahead at the end of that round takes the best one.
- **T-TIM-1** In the first round a rider finishes, riders in the leader's pack share the leader's
  seconds from the timing strip. Other finishers take their own pack leader's seconds.
- **T-TIM-2** Each round after that, every rider still on the road takes a one-minute penalty.
  **[VERIFY]**
- **T-CRD-1** Played exhaustion cards return to the supply; played energy cards are set aside and
  return to the deck after the stage.

### Between stages

- **T-BTW-1** Update standings: Tour Points per team; time, sprint and mountain points per rider.
- **T-BTW-2** Each rider returns half the exhaustion cards in its deck to the supply, rounded down.
- **T-BTW-3** Jerseys: yellow (lowest time), green (most sprint points), polka dot (most mountain
  points). One jersey per rider, priority yellow > green > polka dot; a displaced jersey goes to the
  next best. Ties go to whoever finished ahead in the latest stage.
- **T-BTW-4** Rest day: each classification leader earns 1 Tour Point; every rider repeats T-BTW-2.

### End of tour

- **T-END-1** Bonus Tour Points for general, team, sprint and mountain classifications; places paid
  depend on tour length, with a two-player rule. **[VERIFY]** table.
- **T-END-2** Final score = podium + bonus + rest-day points. Ties go to the team ahead in the last
  stage.

### Sub-modules

- **T-NEW-1 Wide finish.** Replaces the normal finish and carries the timing strip.
- **T-NEW-2 Sharp corners.** A blocked rider stopping on a marked square crashes, as in rain.
- **T-NEW-3 Roundabouts.** Split into a short inner and a long outer single lane. **[VERIFY]**
  movement order, lane choice, slipstream and exhaustion.
- **T-SPC-1 Specialists.** Twelve, six per rider type, each swapping listed cards. Powers: strong
  ascents, strong descents, recovery, relentless, breakaway, chase, nimble. Snake draft, one per
  rider, before stage 1. **[VERIFY]** every card swap and power.
- **T-STG-1 Team time trial.** Teams ignore each other; both riders take the slower rider's time;
  at most one podium place per team.
- **T-STG-2 Individual time trial.** No slipstream; each round the rouleur and the sprinteur that
  played the highest values take exhaustion. **[VERIFY]** ties.
- **T-STG-3 Extended stage.** 24 squares longer, with a refresh token that triggers a one-time phase
  where every rider recovers played energy cards up to a value limit. **[VERIFY]** limit.
