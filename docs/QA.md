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
- [ ] The deployed site works: http://strods.work/flamme/ (GitHub Pages).

## M3 Art and UX

- [ ] Style gate: http://strods.work/flamme/#/gallery shows palette, type, riders (all states and
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
- [ ] `npx -y pnpm@10.34.9 smoke:p2p` passes.

## Every milestone from M2

- [ ] Animation pacing feels readable at normal speed; fast and skip work.
- [ ] Every move that stops short has a visible explanation.
- [ ] Hover hints match what actually happens when the card resolves.
- [ ] Reduced-motion setting gives instant moves and simple fades.
