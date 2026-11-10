# Manual QA checklist

Run per milestone, on Chrome, Firefox and Safari at 1280×720 and 1920×1080. Record the date and any
issues.

## M0 Foundations

- [ ] `pnpm install && pnpm check` passes on a clean clone.
- [ ] `pnpm dev:web` shows the placeholder page; `pnpm dev:server` answers `GET /health`.

## M1 Engine core

- [ ] `npx -y pnpm@10.34.9 selfplay -- --races 1 --seed demo --show` narrates a full race that
      reads correctly: climb caps, blocking, slipstream chains, exhaustion, finish order.
- [ ] `npx -y pnpm@10.34.9 selfplay -- --races 10000` completes with 0 stalls and 0 illegal actions.
- Signed off by the owner, 2026-11-10.

## M2 Playable board

- [ ] Start a race from the home screen on each original stage and on a random stage.
- [ ] Place both riders on the start grid by clicking highlighted squares.
- [ ] Choose a rider, hover cards (ghost shows the landing square), lock in by clicking twice,
      and with keys 1–4 + Enter.
- [ ] Every move, block, slipstream and exhaustion card is visible on the board and in the log.
- [ ] Wheel zooms, drag pans, double-click resets the view.
- [ ] The results screen appears at the finish; Race again and Home both work.
- [ ] The deployed site works: https://strods.work/flamme/ (GitHub Pages).

## M3 Art and UX

- [ ] Style gate: https://strods.work/flamme/#/gallery shows palette, type, riders (all states and
      jerseys), one card of each kind and a track section. Owner approves the direction.
- Style gate approved by the owner, 2026-11-10.
- [ ] Race screen on the final art: scenery, follow camera (Space toggles; pan/zoom turns it off),
      stage strip (click to move the camera), ghost preview and hints, speed Normal/Fast/Skip
      (remembered), sound toggle, Replay last round, Watch the finish again.
- [ ] With the system's reduced-motion setting on, moves are instant and the speed control is
      disabled with an explanation.
- Finished race screen signed off by the owner, 2026-11-10 (after the R/S readability fix).

## M4 Online multiplayer

- [ ] Host a room, copy the invite link, and have two friends in other places join from it.
- [ ] Seats: take, switch and leave seats; the host adds and removes bots and teams.
- [ ] The host starts; three people finish a race. Chat works in the lobby and in the race.
- [ ] A guest closes their tab mid-race and reopens the link: same seat, same cards.
- [ ] The host refreshes mid-race: the room resumes from the save and guests reconnect.
- [ ] Turn timer at 60 s: a player who does not act has a card played for them.
- [ ] Download the save; another person imports it and hosts the next session.
- [x] `npx -y pnpm@10.34.9 smoke:p2p` passes.
- Signed off by the owner, 2026-11-10, with the three-person test with friends still to do.

## M5 AI opponents

- [x] Ladder (`npx -y pnpm@10.34.9 selfplay -- --ladder --races 200`): Easy beats random, Medium
      beats Easy, Hard beats Medium, Medium beats a Muscle team; no stalls or illegal actions.
      Two-team results, 400 races each: Easy 88% vs random, Medium 75% vs Easy, Hard 63% vs
      Medium, Medium 78% vs a Muscle team. Hard decides in about 3 ms on average.
- [ ] Solo race against Hard bots feels like a real race: bots slipstream, avoid needless
      exhaustion and sprint at the end.
- [ ] Easy bots are beatable by a new player; Medium is a fair game; Hard is a challenge.
- [ ] Solo setup: bot level and automatic Peloton / Muscle teams; the lobby's seat menu offers the
      same, and dummy teams flip their cards by themselves.
- [ ] Bots take no more than a moment to play (decision time is printed by the ladder).
- Signed off by the owner, 2026-11-10.

## M6 Peloton

- [x] Peloton rulebook example (three abreast leaving a supply zone) and one test per Peloton
      rule pass (`rulebook.peloton.test.ts`, `breakaway.test.ts`, `bigfields.test.ts`).
- [x] Six-team races with the breakaway play to the end (random play and bots); one-rider-each
      races with 7–12 riders finish.
- [ ] Solo: five bot teams on Grand Peloton or Paving Stones with the breakaway on. Bidding is
      clear (choose a rider, two bids, the winners jump ahead with two exhaustion cards).
- [ ] Cobblestones (single lane, no slipstream) and supply zones (three lanes, at least 4) read
      clearly on the board, and the hints explain them.
- [ ] Lobby: up to six teams, the breakaway and one-rider-each switches, rider choice per seat,
      and a clear message when the stage cannot take the setup.
- [ ] The new stages (Cobble Coast, Feed Station, Paving Stones, Grand Peloton) and the random
      stage look good and race well.
- Signed off by the owner, 2026-11-10.

## M7 Meteo

- [x] Meteo rulebook example (the wet tile, and its fully-crashed variant) and one test per
      weather and crash rule pass (`rulebook.meteo.test.ts`); round simulation matches the engine
      with weather and crashes.
- [x] Bots race with weather: the ladder holds (Medium 73% vs Easy, Hard 66% vs Medium).
- [ ] Weather reads clearly on the board (overlay and badge per tile, band on the stage strip)
      and its effect is clear on hover.
- [ ] Hints: tailwind / headwind hand size, wet road and crosswind landing, standing up for −2.
- [ ] A crash tips the rider over with a sound; it stands up on its next move.
- [ ] Solo and lobby weather switches.
- Signed off by the owner, 2026-11-10.

## M8 Tour core

- [x] Hand-checked scoring example passes (`tour.test.ts`): podium, half the exhaustion back,
      jerseys with a tie and a displaced jersey, rest-day points, all four end bonuses and the
      final ranking. Finish timing (pack fronts, minute penalties) and tokens have their own tests.
- [x] The seven-stage basic tour plays end to end in the engine; a three-stage tour with bots
      plays across two sessions (saved between stages, resumed in a new room) in the host tests;
      a solo tour plays through the screens in the client tests.
- [ ] Solo: start the Tour de Jour (or the Weekend Tour) from the home screen; between stages the
      results, Tour Points, tokens, jerseys and the four standings read clearly.
- [ ] Rest day and the final podium screen; jerseys show on the riders during a stage.
- [ ] Stop between stages, come back later, resume from "Your rooms" and finish the tour.
- [ ] Online: host a tour in the lobby; only the host starts each next stage.

## Every milestone from M2

- [ ] Animation pacing feels readable at normal speed; fast and skip work.
- [ ] Every move that stops short has a visible explanation.
- [ ] Hover hints match what actually happens when the card resolves.
- [ ] Reduced-motion setting gives instant moves and simple fades.
