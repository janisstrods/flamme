# ADR-0001: The host's browser runs the game; the client is a static site on GitHub Pages

**Status:** Accepted
**Date:** 2026-11-10
**Deciders:** Owner (chose this option 2026-11-10); lead implementer

## Context

The implementation plan (sections 3 and 7) puts an authoritative Node server (Fastify, WebSockets,
SQLite) on a small host such as Fly.io. The owner wants to host on GitHub Pages instead, which
serves static files only: no server process, no WebSockets, no database.

Forces:

- **Cost and upkeep.** No server to pay for, patch or keep running.
- **Audience.** A handful of friends, usually on a voice call, playing private rooms.
- **The engine is already pure and deterministic** (M1): it runs anywhere TypeScript runs,
  including a browser, and a game is fully described by config + seed + action log.
- **Hidden information.** Hands and deck order must stay secret from the other players.
- **Persistence.** Tours span several sessions.

## Decision

Ship the client as a static site on GitHub Pages. In each room, the **host's browser** is the
authoritative game: it runs the engine, the room logic (seats, lock-in, timers, AI in a Web Worker)
and persistence. Other players connect browser-to-browser over **WebRTC data channels** and
exchange the same versioned, Zod-validated messages as `packages/protocol` defines. Each guest
receives only `viewFor(state, seat)` and the public event list, exactly as from a server.

## Options considered

### Option A: Pages for the client, plus a small game server (plan as written)

| Dimension   | Assessment                                         |
| ----------- | -------------------------------------------------- |
| Complexity  | Medium: one Node service, one deploy               |
| Cost        | About $4/month on Fly.io (usually waived under $5) |
| Scale       | Far beyond a group of friends                      |
| Familiarity | Standard client–server                             |

**Pros:** hidden information never reaches any player's machine; rooms survive anyone leaving;
any player can resume a tour; no NAT issues.
**Cons:** a server to deploy, monitor and pay for.

### Option B: Pages only; the host's browser is the server (chosen)

| Dimension   | Assessment                                                                |
| ----------- | ------------------------------------------------------------------------- |
| Complexity  | Medium: host runtime in the browser, WebRTC transport, reconnect handling |
| Cost        | Zero hosting cost                                                         |
| Scale       | One room per host browser; fine for 2–12 players                          |
| Familiarity | WebRTC is less common, but the protocol layer is unchanged                |

**Pros:** no infrastructure; the pure engine makes it straightforward; offline-capable solo play.
**Cons:** see trade-offs.

## Trade-off analysis

| Concern                | Effect of Option B                                                                      | Mitigation                                                                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hidden information     | The host's browser holds every hand; a host could peek with developer tools             | Accepted among friends. Guests still receive only redacted views, so only the host could cheat.                                                                  |
| Room lifetime          | The game exists only while the host's tab is open                                       | Save after every action; the host can reopen and resume. Guests reconnect with their seat token.                                                                 |
| Resuming tours         | Saves live in the host's IndexedDB                                                      | Saves are small (config, seed, action log): add "export save" / "import save" so anyone can host the next session.                                               |
| Connecting             | WebRTC needs a signalling channel to introduce peers; some networks need a relay (TURN) | Use a serverless signalling library over public infrastructure (choose in M4, e.g. Trystero or PeerJS). Add an optional TURN setting; document the failure mode. |
| Third-party dependency | Public signalling services can change or vanish                                         | Keep transport behind one interface so it can be swapped.                                                                                                        |
| Privacy of the site    | GitHub Pages sites are public; free plans publish only from public repos                | Room creation needs the room code and invite link; there is no server data to protect. Repo visibility is an open owner decision (see `OWNER_QUESTIONS.md`).     |

## Consequences

- **Easier:** no deploy pipeline beyond building static files; no server costs or patching; solo
  and local play work with no network at all.
- **Harder:** M4 builds a browser "host runtime" and a WebRTC transport instead of a Fastify
  server; reconnects and host refreshes need care; the redaction test now runs against the host
  runtime instead of the server.
- **Unchanged:** the engine, content, protocol schemas and the client's event-driven rendering.
- **Revisit** if the group grows beyond friends, if cheating matters, or if WebRTC connectivity
  proves unreliable for the group (fall back to Option A: the host runtime can run in Node
  behind WebSockets with the same protocol).

## Action items

1. [x] Record the decision (this ADR; `RULES_DECISIONS.md` E-012; owner questions).
2. [ ] M2: build the client for a GitHub Pages base path; deploy job on push to `main`.
3. [ ] M4: `packages/host` (room runtime, runs in browser and in Node for tests) replaces
       `apps/server`; WebRTC transport behind a `Transport` interface; IndexedDB saves with
       export/import; AI in a Web Worker.
4. [ ] M4: redaction, reconnect, host-refresh and save/resume tests against the host runtime.
5. [ ] Before the first deploy: owner decides repo visibility for Pages.
