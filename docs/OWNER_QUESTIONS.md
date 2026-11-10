# Open questions for the owner (M0)

M0 closes when these are answered. Defaults apply where noted.

## Materials needed

1. **Rulebook PDFs** for base, Peloton, Meteo and Grand Tour in `docs/rules/` (git-ignored).
2. **Tile photos**, both sides of every track tile and the timing tile, in `docs/tiles/`.
3. **Specialist cards**: photos, or confirmation that the rulebook's specialist table is complete.
4. **Hosting**: which host or VPS, and the room-creation passphrase (stored as an env var, not in git).
5. **Working title**: placeholder is "Velo".
6. **Git remote**: should this live in a private GitHub repo so the CI workflow runs?

## Content decision

7. ~~**Stages.**~~ Answered 2026-11-10: original stages, plus the seeded generator and the
   editor, instead of transcribing the published stage cards. (Decision C-002.)

## Rules to verify (I'll read these from the PDFs once they're in; answer here if you know)

8. Starting deck contents and exhaustion card value.
9. Exactly when the ascent cap applies, including a high card that only reaches the first ascent square.
10. Order of value modifiers: minimums, crash penalty, ascent cap.
11. Finish tie-break by lane.
12. Whether exhaustion cards can run out, and what happens then.
13. Slipstream from a 3-lane square into a 2-lane square.
14. Breakaway bidding ties and card handling.
15. Timing strip values on both faces of the finish.
16. Whether dummy teams take part in tour scoring, and how.
17. Full roundabout rules: movement order, slipstream and exhaustion.

## Defaults to confirm

| Decision                            | Default                            |
| ----------------------------------- | ---------------------------------- |
| Base-game start order               | Random                             |
| Champion Edition extras             | Handicaps only                     |
| Show remaining opponent card values | On, as a room option               |
| Dummy teams in tours                | Allowed as non-scoring pace riders |
| Turn timer                          | Off                                |
| Spectators                          | Allowed                            |
