# Manual QA checklist

Run per milestone, on Chrome, Firefox and Safari at 1280×720 and 1920×1080. Record the date and any
issues.

## M0 Foundations

- [ ] `pnpm install && pnpm check` passes on a clean clone.
- [ ] `pnpm dev:web` shows the placeholder page; `pnpm dev:server` answers `GET /health`.

## Every milestone from M2

- [ ] Animation pacing feels readable at normal speed; fast and skip work.
- [ ] Every move that stops short has a visible explanation.
- [ ] Hover hints match what actually happens when the card resolves.
- [ ] Reduced-motion setting gives instant moves and simple fades.
