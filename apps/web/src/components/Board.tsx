/**
 * The board: scenery, track art and riders on the final style, a follow camera that keeps the
 * action in view (Space toggles; manual pan or zoom turns it off), a ghost for the hovered card,
 * placement targets, revealed cards and short effects (slipstream trails, exhaustion, bumps).
 */
import { tourStages } from '@velo/content';
import type { StageLayout } from '@velo/content';
import { previewFromView } from '@velo/engine';
import type { Position, RiderId, TeamColor } from '@velo/protocol';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent, WheelEvent } from 'react';
import { RiderArt } from '../art/Rider';
import { SceneryDefs, SceneryGround, SceneryOverlay } from '../art/Scenery';
import { ArtDefs, TrackArt } from '../art/TrackArt';
import { TEAM_STYLES } from '../art/teams';
import { describeRider, describeSquare } from '../game/describe';
import { isTyping, modalOpen } from '../game/keys';
import { nameBook } from '../game/names';
import { useSettings } from '../game/settings';
import { useRace } from '../game/store';
import { trialPose } from '../game/trialSpread';

interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MIN_W = 14;
/** Widest view (in squares) the follow camera uses before it narrows to your riders. */
const MAX_FOLLOW_W = 24;

function boxAround(points: [number, number][], aspect: number, margin = 3.5): View {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x0 = Math.min(...xs) - margin;
  const x1 = Math.max(...xs) + margin;
  const y0 = Math.min(...ys) - margin;
  const y1 = Math.max(...ys) + margin;
  let w = Math.max(x1 - x0, MIN_W);
  let h = y1 - y0;
  if (w / h < aspect) w = h * aspect;
  else h = w / aspect;
  return { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - h / 2, w, h };
}

function fitAll(layout: StageLayout, aspect: number): View {
  const { minX, minY, maxX, maxY } = layout.bounds;
  return boxAround(
    [
      [minX, minY],
      [maxX, maxY],
    ],
    aspect,
    2,
  );
}

/** Rider heading in degrees, unwrapped so turns never spin the long way round. */
function useUnwrapped() {
  const last = useRef(new Map<RiderId, number>());
  return (id: RiderId, radians: number) => {
    const deg = (radians * 180) / Math.PI;
    const prev = last.current.get(id);
    if (prev === undefined) {
      last.current.set(id, deg);
      return deg;
    }
    const d = ((((deg - prev + 180) % 360) + 360) % 360) - 180;
    last.current.set(id, prev + d);
    return prev + d;
  };
}

export function Board() {
  const {
    layout,
    track,
    room,
    seat,
    legal,
    view: game,
    display,
    moveMs,
    effects,
    downed,
    revealed,
    hoverCard,
    selectedCard,
    placingRider,
    animating,
    focus,
    act,
  } = useRace();
  const { follow, reducedMotion, setFollow, pauseFollow, resumeFollow } = useSettings();
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const [aspect, setAspect] = useState(16 / 9);
  const [view, setView] = useState<View | null>(null);
  /** What the pointer is over (for the hover card), with its screen position. */
  const [hover, setHover] = useState<{
    kind: 'rider' | 'square';
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const viewRef = useRef<View | null>(null);
  const target = useRef<View | null>(null);
  const unwrap = useUnwrapped();

  /** Point the camera somewhere; jump straight there if animation frames are paused (hidden tab). */
  const aim = (next: View) => {
    target.current = next;
    if (typeof document !== 'undefined' && document.hidden) {
      viewRef.current = next;
      setView(next);
    }
  };

  // Track the board's aspect ratio so camera boxes fill it.
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const r = e!.contentRect;
      if (r.width > 0 && r.height > 0) setAspect(r.width / r.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const lanePoint = (p: Position): [number, number] => {
    const g = layout?.squares[p.square];
    if (!g) return [0, 0];
    const pt = g.lanes[Math.min(Math.max(p.lane, 0), g.lanes.length - 1)]!;
    if (p.lane >= 0) return [pt[0], pt[1]];
    // The verge (Nimble, G-SPC-7): further right of the rightmost lane, one lane width per place.
    const right: [number, number] = [-Math.sin(g.heading), Math.cos(g.heading)];
    const step =
      g.lanes.length > 1 ? Math.hypot(pt[0] - g.lanes[1]![0], pt[1] - g.lanes[1]![1]) : 0.7;
    return [pt[0] + right[0] * step * -p.lane, pt[1] + right[1] * step * -p.lane];
  };
  const labels = useSettings((x) => x.labels);
  const teamMarks = useSettings((x) => x.teamMarks);
  const book = nameBook(room?.config);
  // Time trials (G-TTT-1, G-ITT-1): teams share squares and lanes, so spread them along the road.
  const stageType =
    room?.config.mode.kind === 'tour'
      ? tourStages(room.config.mode.schedule)[(game?.stageNumber ?? 1) - 1]?.type
      : undefined;
  const trial = stageType === 'teamTimeTrial' || stageType === 'individualTimeTrial';
  const teamIndex = (team: string) => game?.teams.findIndex((t) => t.team === team) ?? 0;
  const trialPoseOf = (id: string, p: Position) => {
    const g = layout?.squares[p.square];
    // Off the road (the verge) there is no pile-up to spread out.
    if (!trial || !game || !g || p.lane < 0) return null;
    const lane = Math.min(p.lane, g.lanes.length - 1);
    return trialPose(g, lane, teamIndex(id.split(':')[0]!), game.teams.length);
  };
  const riderPoint = (id: string, p: Position): [number, number] =>
    trialPoseOf(id, p)?.point ?? lanePoint(p);
  /** Which way the rider faces, radians: along the road where it is drawn. */
  const riderHeading = (id: string, p: Position): number =>
    trialPoseOf(id, p)?.heading ?? layout?.squares[p.square]?.heading ?? 0;

  // Each stage opens on the whole course and then moves in on the start grid, with the follow
  // camera back to the player's choice (panning only pauses it for one stage). A target left over
  // from the previous stage would otherwise point at empty grass on the new course.
  useEffect(() => {
    if (!layout || !track) return;
    resumeFollow();
    const start = fitAll(layout, aspect);
    viewRef.current = start;
    setView(start);
    target.current = boxAround(
      track.startGrid.map((id) => [...layout.squares[id]!.center] as [number, number]),
      aspect,
    );
    // Only on a new course: a resize alone keeps the current view.
  }, [layout, track]);
  // Camera target: riders (follow), a focused square, or the start grid before anyone is placed.
  const riderPoints = useMemo(
    () =>
      Object.values(display)
        .filter((p): p is Position => !!p)
        .map(lanePoint),
    [display, layout],
  );
  useEffect(() => {
    if (!layout || !track || !game || !follow) return;
    const pts =
      riderPoints.length > 0
        ? riderPoints
        : track.startGrid.map((id) => [...layout.squares[id]!.center] as [number, number]);
    let box = boxAround(pts, aspect);
    // When the field is too spread out to stay readable, frame your own riders instead.
    if (box.w > MAX_FOLLOW_W) {
      const mine = game.riders
        .filter((r) => r.team === seat && display[r.id])
        .map((r) => lanePoint(display[r.id]!));
      if (mine.length > 0) box = boxAround(mine, aspect);
      // Still too wide: follow the rider you are choosing for, or your front rider.
      if (box.w > MAX_FOLLOW_W) {
        const choosing = game.own?.riders.find((r) => r.hand)?.rider;
        const ordered = game.riders
          .filter((r) => r.team === seat && display[r.id])
          .sort(
            (a, b) =>
              (b.id === choosing ? 1 : 0) - (a.id === choosing ? 1 : 0) ||
              track.squares[display[b.id]!.square]!.index -
                track.squares[display[a.id]!.square]!.index,
          );
        const focusRider = ordered[0];
        if (focusRider) box = boxAround([lanePoint(display[focusRider.id]!)], aspect);
      }
    }
    aim(box);
  }, [follow, riderPoints, aspect, layout, track, game, seat]);
  // Only a new focus request moves the camera: a resize or the next stage's layout must not
  // re-aim at a square that was clicked earlier.
  const focusEnv = useRef({ layout, aspect });
  focusEnv.current = { layout, aspect };
  useEffect(() => {
    const { layout, aspect } = focusEnv.current;
    if (!focus || !layout) return;
    const g = layout.squares[focus.square];
    if (!g) return;
    pauseFollow();
    const w = Math.max(viewRef.current?.w ?? 24, MIN_W);
    aim({ x: g.center[0] - w / 2, y: g.center[1] - w / aspect / 2, w, h: w / aspect });
  }, [focus, pauseFollow]);

  // Smoothly move the camera towards its target.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const cur = viewRef.current;
      const tgt = target.current;
      if (cur && tgt) {
        const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 3.5);
        const next = {
          x: cur.x + (tgt.x - cur.x) * k,
          y: cur.y + (tgt.y - cur.y) * k,
          w: cur.w + (tgt.w - cur.w) * k,
          h: cur.h + (tgt.h - cur.h) * k,
        };
        if (
          Math.abs(next.x - cur.x) + Math.abs(next.y - cur.y) + Math.abs(next.w - cur.w) >
          0.001
        ) {
          viewRef.current = next;
          setView(next);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion]);

  // WASD / arrow keys pan, + and − zoom (arrows step through frames in a replay instead).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || modalOpen() || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const replaying = useRace.getState().replay !== null;
      const dirs: Record<string, [number, number]> = {
        w: [0, -1],
        a: [-1, 0],
        s: [0, 1],
        d: [1, 0],
      };
      if (!replaying)
        Object.assign(dirs, {
          arrowup: [0, -1],
          arrowleft: [-1, 0],
          arrowdown: [0, 1],
          arrowright: [1, 0],
        });
      const dir = dirs[k];
      const zoom = k === '+' || k === '=' ? 0.8 : k === '-' || k === '_' ? 1.25 : null;
      const cur = target.current ?? viewRef.current;
      if ((!dir && !zoom) || !cur) return;
      e.preventDefault();
      if (useSettings.getState().follow) pauseFollow();
      let next = cur;
      if (dir) next = { ...cur, x: cur.x + dir[0] * cur.w * 0.2, y: cur.y + dir[1] * cur.h * 0.2 };
      if (zoom) {
        const w = Math.max(6, cur.w * zoom);
        const h = (w / cur.w) * cur.h;
        next = { x: cur.x + (cur.w - w) / 2, y: cur.y + (cur.h - h) / 2, w, h };
      }
      target.current = next;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pauseFollow]);

  // Space toggles the follow camera.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.code !== 'Space' || isTyping(e.target) || modalOpen()) return;
      if (tag !== 'BUTTON' && tag !== 'A' && tag !== 'SUMMARY') {
        e.preventDefault();
        setFollow(!useSettings.getState().follow);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setFollow]);

  if (!layout || !track || !game || !room || !view) return <svg ref={svg} className="board" />;
  const vb = view;

  const toWorld = (clientX: number, clientY: number) => {
    const r = svg.current!.getBoundingClientRect();
    const scale = Math.min(vb.w / r.width, vb.h / r.height);
    const ox = (r.width * scale - vb.w) / 2;
    const oy = (r.height * scale - vb.h) / 2;
    return {
      x: vb.x - ox + (clientX - r.left) * scale,
      y: vb.y - oy + (clientY - r.top) * scale,
      scale,
    };
  };
  const manual = (next: View) => {
    if (useSettings.getState().follow) pauseFollow();
    target.current = next;
    viewRef.current = next;
    setView(next);
  };
  const onWheel = (e: WheelEvent) => {
    const p = toWorld(e.clientX, e.clientY);
    const k = Math.exp(e.deltaY * 0.0015);
    const full = fitAll(layout, aspect);
    const w = Math.min(Math.max(vb.w * k, 6), full.w * 1.5);
    const h = (w / vb.w) * vb.h;
    manual({ x: p.x - ((p.x - vb.x) * w) / vb.w, y: p.y - ((p.y - vb.y) * h) / vb.h, w, h });
  };
  const onDown = (e: PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
  };
  const onMove = (e: PointerEvent) => {
    if (!drag.current) {
      const p = toWorld(e.clientX, e.clientY);
      const hit = hitAt(p.x, p.y);
      setHover(hit && { ...hit, x: e.clientX, y: e.clientY });
      return;
    }
    if (hover) setHover(null);
    const dxp = e.clientX - drag.current.x;
    const dyp = e.clientY - drag.current.y;
    if (!drag.current.moved && Math.hypot(dxp, dyp) < 4) return;
    if (!drag.current.moved) (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    drag.current.moved = true;
    const { scale } = toWorld(e.clientX, e.clientY);
    drag.current.x = e.clientX;
    drag.current.y = e.clientY;
    manual({ ...vb, x: vb.x - dxp * scale, y: vb.y - dyp * scale });
  };
  const onUp = () => {
    setTimeout(() => (drag.current = null), 0);
  };

  /** The rider (nearest, within half a square) or the square under a board point. */
  const hitAt = (x: number, y: number): { kind: 'rider' | 'square'; id: string } | null => {
    let best: string | null = null;
    let bd = 0.42;
    for (const r of game.riders) {
      const pos = display[r.id];
      if (!pos) continue;
      const [px, py] = riderPoint(r.id, pos);
      const d = Math.hypot(px - x, py - y);
      if (d < bd) {
        bd = d;
        best = r.id;
      }
    }
    if (best) return { kind: 'rider', id: best };
    for (const g of Object.values(layout.squares))
      if (track.squares[g.id] && inPolygon(x, y, g.polygon)) return { kind: 'square', id: g.id };
    return null;
  };

  // Placement targets for the human.
  const placements =
    !animating && game.phase === 'placement'
      ? legal.filter((a) => a.type === 'placeRider' && (!placingRider || a.rider === placingRider))
      : [];
  const targets = new Set(
    placements.map((a) => (a.type === 'placeRider' ? a.position.square : '')),
  );

  // Ghost preview for the hovered or selected card.
  const dealtOwn = game.own?.riders.find((r) => r.hand);
  const dealt = dealtOwn && game.riders.find((r) => r.id === dealtOwn.rider);
  const previewCard = dealtOwn?.hand?.find((c) => c.id === (hoverCard ?? selectedCard));
  const preview =
    dealt && previewCard && !animating
      ? previewFromView(game, track, room.config, dealt.id, previewCard)
      : null;
  const colorOf = (team: string) =>
    (game.teams.find((t) => t.team === team)?.color ?? 'red') as TeamColor;

  // Time trials: every team rides the same squares against the clock, so the field piles up.
  // Your own riders are drawn last (on top) and at full strength; the others fade back. Hovering
  // a rider brings that rider's team forward instead (this is also how a spectator picks one).
  const hoverTeam =
    hover?.kind === 'rider' ? (game.riders.find((r) => r.id === hover.id)?.team ?? null) : null;
  const spotlight = trial ? (hoverTeam ?? seat ?? null) : null;
  const drawOrder = trial
    ? [...game.riders].sort((a, b) => Number(a.team === seat) - Number(b.team === seat))
    : game.riders;

  return (
    <>
      <svg
        ref={svg}
        className="board"
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        preserveAspectRatio="xMidYMid slice"
        onWheel={onWheel}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={() => {
          setHover(null);
          // A press that never became a drag has no pointer capture, so its release may be missed.
          if (drag.current && !drag.current.moved) drag.current = null;
        }}
        onDoubleClick={() => manual(fitAll(layout, aspect))}
        role="img"
        aria-label="Race board"
      >
        <defs>
          <ArtDefs />
          <SceneryDefs />
        </defs>
        <rect
          x={vb.x - 200}
          y={vb.y - 200}
          width={vb.w + 400}
          height={vb.h + 400}
          fill="var(--grass)"
        />
        <SceneryGround layout={layout} track={track} />
        <TrackArt layout={layout} track={track} highlight={targets} />
        {game.tokens.map((pile) => {
          const g = layout.squares[pile.square];
          const top = pile.remaining[0];
          if (!g || top === undefined) return null;
          // Beside the road, on the right-hand verge (lane 0 side).
          const lane0 = g.lanes[0]!;
          const dx = lane0[0] - g.center[0];
          const dy = lane0[1] - g.center[1];
          const len = Math.hypot(dx, dy) || 1;
          const off = pile.pile === 'major' ? 1.05 : 0.95;
          const x = lane0[0] + (dx / len) * off;
          const y = lane0[1] + (dy / len) * off;
          return (
            <g
              key={pile.pile}
              className={`token-pile token-pile--${pile.kind}`}
              transform={`translate(${x} ${y})`}
            >
              <title>{`${pile.pile === 'major' ? 'Major' : 'Minor'} ${pile.kind} points: ${pile.remaining.join(', ')} left`}</title>
              <circle r={pile.pile === 'major' ? 0.42 : 0.34} />
              <text dy="0.35em">{top}</text>
            </g>
          );
        })}
        <SceneryOverlay layout={layout} track={track} />
        {placements.length > 0 &&
          [...targets].map((id) => {
            const g = layout.squares[id]!;
            return (
              <polygon
                key={id}
                className="board__target"
                points={g.polygon.map((p) => p.join(',')).join(' ')}
                onClick={() => {
                  if (drag.current?.moved) return;
                  const a = placements.find(
                    (x) => x.type === 'placeRider' && x.position.square === id,
                  );
                  if (a) act(a);
                }}
              >
                <title>Place here</title>
              </polygon>
            );
          })}
        {preview && dealt && (
          <g
            className="ghost"
            transform={`translate(${riderPoint(dealt.id, { square: preview.unobstructed.square, lane: 0 }).join(',')})`}
          >
            <g opacity={0.45}>
              <RiderArt
                team={colorOf(dealt.team)}
                type={dealt.type}
                heading={riderHeading(dealt.id, { square: preview.unobstructed.square, lane: 0 })}
              />
            </g>
            <g transform="translate(0,-0.62)">
              <rect
                x={-0.26}
                y={-0.2}
                width={0.52}
                height={0.4}
                rx={0.12}
                className="ghost__bubble"
              />
              <text className="ghost__value" dy="0.36em">
                {preview.effectiveValue}
              </text>
            </g>
          </g>
        )}
        {drawOrder.map((r) => {
          const pos = display[r.id];
          if (!pos) return null;
          const [x, y] = riderPoint(r.id, pos);
          const heading = unwrap(r.id, riderHeading(r.id, pos));
          const ms = moveMs[r.id] ?? 0;
          const fx = effects[r.id];
          const card = revealed?.[r.id];
          const team = colorOf(r.team);
          return (
            <g
              key={r.id}
              className={`board-rider${r.team === seat ? ' board-rider--mine' : ''}${
                spotlight && r.team !== spotlight ? ' board-rider--faded' : ''
              }`}
              style={{
                transform: `translate(${x}px, ${y}px)`,
                transition: `transform ${ms}ms linear, opacity 180ms ease`,
              }}
            >
              {fx?.kind === 'slipstream' && (
                <g key={fx.key} style={{ transform: `rotate(${heading}deg)` }}>
                  <g className="fx-trail">
                    {[-0.16, 0, 0.16].map((dy) => (
                      <line key={dy} x1={-1.3} y1={dy} x2={-0.5} y2={dy} />
                    ))}
                  </g>
                </g>
              )}
              {r.team === seat && <circle className="board-rider__mine" r={0.5} />}
              <g
                key={fx?.kind === 'bump' ? fx.key : 'rider'}
                className={fx?.kind === 'bump' ? 'fx-bump' : undefined}
              >
                <RiderArt
                  team={team}
                  type={r.type}
                  heading={(heading * Math.PI) / 180}
                  turnMs={ms}
                  jersey={r.jersey}
                  state={
                    (downed[r.id] ?? r.crashed)
                      ? 'crashed'
                      : r.finished && game.phase === 'stageEnd'
                        ? 'finished'
                        : 'normal'
                  }
                />
              </g>
              {card && (
                <g className="reveal" transform="translate(0,-0.8)">
                  <rect x={-0.3} y={-0.36} width={0.6} height={0.72} rx={0.1} />
                  <rect
                    x={-0.3}
                    y={-0.36}
                    width={0.6}
                    height={0.14}
                    rx={0.07}
                    fill={TEAM_STYLES[team].color}
                  />
                  <text
                    className={
                      card.kind === 'exhaustion'
                        ? 'reveal__value reveal__value--tired'
                        : 'reveal__value'
                    }
                    dy="0.5em"
                  >
                    {card.value}
                  </text>
                </g>
              )}
              {labels && (
                <text className="board-rider__label" y={0.62}>
                  {book.rider(r.id).split(' ')[0]}
                </text>
              )}
              {teamMarks && (
                <g className="board-rider__mark" transform="translate(0.3,-0.3)">
                  <circle r={0.14} />
                  <text dy="0.07">{teamIndex(r.team) + 1}</text>
                </g>
              )}
              {fx?.kind === 'crash' && (
                <g key={fx.key} className="fx-crash">
                  <circle r={0.45} />
                </g>
              )}
              {fx?.kind === 'tired' && (
                <g key={fx.key} className="fx-tired">
                  <rect x={-0.17} y={-0.24} width={0.34} height={0.48} rx={0.06} />
                  <text dy="0.36em">2</text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
      {hover && <HoverCard hover={hover} />}
    </>
  );
}

/** Ray-casting point-in-polygon test. */
function inPolygon(x: number, y: number, poly: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The hover card: what a square does, or who a rider is and where it stands. */
function HoverCard({
  hover,
}: {
  hover: { kind: 'rider' | 'square'; id: string; x: number; y: number };
}) {
  const { view, track, room, seat } = useRace();
  if (!view || !track || !room) return null;
  const book = nameBook(room.config);
  const playerName = (team: string) => {
    const s = room.config.seats.find((x) => x.seat === team);
    if (s?.controller.kind !== 'human') return null;
    const id = s.controller.playerId;
    return room.players.find((p) => p.id === id)?.name ?? null;
  };
  if (hover.kind === 'square' && !track.squares[hover.id]) return null;
  if (hover.kind === 'rider' && !view.riders.some((r) => r.id === hover.id)) return null;
  const info =
    hover.kind === 'square'
      ? describeSquare(view, track, hover.id, book)
      : describeRider(view, room.config, track, hover.id, seat, book, playerName);
  const team = hover.kind === 'rider' ? view.riders.find((r) => r.id === hover.id)!.team : null;
  const color = team ? (view.teams.find((t) => t.team === team)?.color as TeamColor) : null;
  const left = Math.min(hover.x + 16, window.innerWidth - 300);
  const top = Math.min(hover.y + 16, window.innerHeight - 220);
  return (
    <div className="board-tip" style={{ left, top }} role="tooltip">
      <div className="board-tip__title">
        {color && <span className="swatch" style={{ background: TEAM_STYLES[color].color }} />}
        <b>{info.title}</b>
      </div>
      {info.subtitle && <div className="board-tip__sub">{info.subtitle}</div>}
      <ul>
        {info.lines.map((l, i) => (
          <li key={i} className={`board-tip__line board-tip__line--${l.tone ?? 'plain'}`}>
            <span>{l.label}</span>
            {l.effect && <small>{l.effect}</small>}
          </li>
        ))}
      </ul>
    </div>
  );
}
