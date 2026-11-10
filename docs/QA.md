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

## Every milestone from M2

- [ ] Animation pacing feels readable at normal speed; fast and skip work.
- [ ] Every move that stops short has a visible explanation.
- [ ] Hover hints match what actually happens when the card resolves.
- [ ] Reduced-motion setting gives instant moves and simple fades.
