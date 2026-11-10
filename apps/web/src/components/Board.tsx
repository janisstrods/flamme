/**
 * The board: scenery, track art and riders on the final style, a follow camera that keeps the
 * action in view (Space toggles; manual pan or zoom turns it off), a ghost for the hovered card,
 * placement targets, revealed cards and short effects (slipstream trails, exhaustion, bumps).
 */
import type { StageLayout } from '@velo/content';
import { legalActions, previewMove } from '@velo/engine';
import type { Position, RiderId, TeamColor } from '@velo/protocol';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent, WheelEvent } from 'react';
import { RiderArt } from '../art/Rider';
import { SceneryDefs, SceneryGround, SceneryOverlay } from '../art/Scenery';
import { ArtDefs, TrackArt } from '../art/TrackArt';
import { TEAM_STYLES } from '../art/teams';
import { useSettings } from '../game/settings';
import { HUMAN, useRace } from '../game/store';

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
    state,
    display,
    moveMs,
    effects,
    revealed,
    hoverCard,
    selectedCard,
    placingRider,
    animating,
    focus,
    act,
  } = useRace();
  const { follow, reducedMotion, setFollow } = useSettings();
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const [aspect, setAspect] = useState(16 / 9);
  const [view, setView] = useState<View | null>(null);
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
    const pt = g?.lanes[Math.min(Math.max(p.lane, 0), g.lanes.length - 1)];
    return pt ? [pt[0], pt[1]] : [0, 0];
  };

  // Start each stage showing the whole course; the follow effect below then takes over.
  useEffect(() => {
    if (!layout) return;
    const start = fitAll(layout, aspect);
    viewRef.current = start;
    setView(start);
    target.current ??= start;
  }, [layout, aspect]);
  // Camera target: riders (follow), a focused square, or the start grid before anyone is placed.
  const riderPoints = useMemo(
    () =>
      Object.values(display)
        .filter((p): p is Position => !!p)
        .map(lanePoint),
    [display, layout],
  );
  useEffect(() => {
    if (!layout || !state || !follow) return;
    const pts =
      riderPoints.length > 0
        ? riderPoints
        : state.track.startGrid.map((id) => [...layout.squares[id]!.center] as [number, number]);
    let box = boxAround(pts, aspect);
    // When the field is too spread out to stay readable, frame your own riders instead.
    if (box.w > MAX_FOLLOW_W) {
      const mine = Object.values(state.riders)
        .filter((r) => r.team === HUMAN && display[r.id])
        .map((r) => lanePoint(display[r.id]!));
      if (mine.length > 0) box = boxAround(mine, aspect);
      // Still too wide: follow the rider you are choosing for, or your front rider.
      if (box.w > MAX_FOLLOW_W) {
        const ordered = Object.values(state.riders)
          .filter((r) => r.team === HUMAN && display[r.id])
          .sort(
            (a, b) =>
              (b.hand ? 1 : 0) - (a.hand ? 1 : 0) ||
              state.track.squares[display[b.id]!.square]!.index -
                state.track.squares[display[a.id]!.square]!.index,
          );
        const focusRider = ordered[0];
        if (focusRider) box = boxAround([lanePoint(display[focusRider.id]!)], aspect);
      }
    }
    aim(box);
  }, [follow, riderPoints, aspect, layout, state]);
  useEffect(() => {
    if (!focus || !layout) return;
    const g = layout.squares[focus.square];
    if (!g) return;
    setFollow(false);
    const w = Math.max(viewRef.current?.w ?? 24, MIN_W);
    aim({ x: g.center[0] - w / 2, y: g.center[1] - w / aspect / 2, w, h: w / aspect });
  }, [focus, layout, aspect, setFollow]);

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

  // Space toggles the follow camera.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'BUTTON') {
        e.preventDefault();
        setFollow(!useSettings.getState().follow);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setFollow]);

  if (!layout || !state || !view) return <svg ref={svg} className="board" />;
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
    if (useSettings.getState().follow) setFollow(false);
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
    if (!drag.current) return;
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

  // Placement targets for the human.
  const placements =
    !animating && state.phase === 'placement'
      ? legalActions(state, HUMAN).filter(
          (a) => a.type === 'placeRider' && (!placingRider || a.rider === placingRider),
        )
      : [];
  const targets = new Set(
    placements.map((a) => (a.type === 'placeRider' ? a.position.square : '')),
  );

  // Ghost preview for the hovered or selected card.
  const dealt = Object.values(state.riders).find((r) => r.team === HUMAN && r.hand);
  const previewCard = dealt?.hand?.find((c) => c.id === (hoverCard ?? selectedCard));
  const preview =
    dealt && previewCard && !animating ? previewMove(state, dealt.id, previewCard) : null;
  const colorOf = (team: string) => state.teams.find((t) => t.team === team)!.color as TeamColor;

  return (
    <svg
      ref={svg}
      className="board"
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      preserveAspectRatio="xMidYMid slice"
      onWheel={onWheel}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
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
      <SceneryGround layout={layout} track={state.track} />
      <TrackArt layout={layout} track={state.track} highlight={targets} />
      <SceneryOverlay layout={layout} track={state.track} />
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
          transform={`translate(${lanePoint({ square: preview.unobstructed.square, lane: 0 }).join(',')})`}
        >
          <g opacity={0.45}>
            <RiderArt
              team={colorOf(dealt.team)}
              type={dealt.type}
              heading={layout.squares[preview.unobstructed.square]!.heading}
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
      {Object.values(state.riders).map((r) => {
        const pos = display[r.id];
        if (!pos) return null;
        const [x, y] = lanePoint(pos);
        const g = layout.squares[pos.square]!;
        const heading = unwrap(r.id, g.heading);
        const ms = moveMs[r.id] ?? 0;
        const fx = effects[r.id];
        const card = revealed?.[r.id];
        const team = colorOf(r.team);
        return (
          <g
            key={r.id}
            className={`board-rider${r.team === HUMAN ? ' board-rider--mine' : ''}`}
            style={{
              transform: `translate(${x}px, ${y}px)`,
              transition: `transform ${ms}ms linear`,
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
            {r.team === HUMAN && <circle className="board-rider__mine" r={0.5} />}
            <g
              key={fx?.kind === 'bump' ? fx.key : 'rider'}
              className={fx?.kind === 'bump' ? 'fx-bump' : undefined}
            >
              <RiderArt
                team={team}
                type={r.type}
                heading={(heading * Math.PI) / 180}
                turnMs={ms}
                state={
                  r.crashed
                    ? 'crashed'
                    : r.finished && state.phase === 'stageEnd'
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
  );
}
