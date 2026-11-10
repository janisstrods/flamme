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

## Every milestone from M2

- [ ] Animation pacing feels readable at normal speed; fast and skip work.
- [ ] Every move that stops short has a visible explanation.
- [ ] Hover hints match what actually happens when the card resolves.
- [ ] Reduced-motion setting gives instant moves and simple fades.
