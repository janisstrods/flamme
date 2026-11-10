# Open questions for the owner (M0)

M0 closes when these are answered. Defaults apply where noted.

## Materials needed

1. **Rulebook PDFs** in `docs/rules/` (git-ignored).
   - Base and Peloton: downloaded 2026-11-10 (original English editions, from 1jour-1jeu's archive).
   - Grand Tour: the publisher's PDF downloads only in a browser; please save it into `docs/rules/`.
   - Meteo: no public PDF found. A photo or scan of your copy would do; otherwise I'll check the
     Meteo rules against RulesPal's online transcription.
2. **Tiles**: base and Peloton tile data imported from flamme-rouge-tracks.com (draft, unverified).
   Still needed: Grand Tour tiles (wide finish and timing strip, sharp corners, roundabouts), as
   photos in `docs/tiles/`.
3. **Specialist cards**: photos, or confirmation that the rulebook's specialist table is complete.
4. **Hosting**: which host or VPS, and the room-creation passphrase (stored as an env var, not in git).
5. **Working title**: placeholder is "Velo".
6. ~~**Git remote**~~: private repo `janisstrods/flamme` created 2026-11-10.

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
