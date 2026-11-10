Hand-written contract fixtures, frozen with the contracts at the end of M0.

- `round1.events.json`: the public event log of grid placement plus round 1 of a two-team race on
  `FIXTURE_STAGE` (from `@velo/content`). Square ids follow `squareIdOf`.
- `seat0.view.json`: the redacted view seat-0 receives after that round.

The client builds against these before the engine exists. When M1 lands, an engine test replays the
same actions and must reproduce this event log exactly (given a deck order that deals these hands).
