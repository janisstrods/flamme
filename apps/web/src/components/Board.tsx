/**
 * The board: track squares from the stage layout, riders as placeholder tokens (final art is M3),
 * a ghost for the hovered card, and highlighted grid squares while placing. Wheel zooms, drag pans.
 */
import type { Terrain } from '@velo/content';
import { legalActions, previewMove } from '@velo/engine';
import type { Position } from '@velo/protocol';
import { useMemo, useRef, useState } from 'react';
import type { PointerEvent, WheelEvent } from 'react';
import { HUMAN, useRace } from '../game/store';

const TERRAIN_FILL: Record<Terrain, string> = {
  flat: 'var(--m2-road)',
  ascent: 'var(--m2-ascent)',
  descent: 'var(--m2-descent)',
  cobblestone: 'var(--m2-cobble)',
  supply: 'var(--m2-supply)',
};

export function Board() {
  const {
    layout,
    state,
    display,
    moveMs,
    revealed,
    tired,
    hoverCard,
    selectedCard,
    placingRider,
    animating,
    act,
  } = useRace();
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const fit = useMemo(() => {
    if (!layout) return { x: 0, y: 0, w: 10, h: 10 };
    const m = 2;
    const { minX, minY, maxX, maxY } = layout.bounds;
    return { x: minX - m, y: minY - m, w: maxX - minX + 2 * m, h: maxY - minY + 2 * m };
  }, [layout]);
  const [view, setView] = useState<typeof fit | null>(null);
  const vb = view ?? fit;

  if (!layout || !state) return null;

  const toWorld = (clientX: number, clientY: number) => {
    const r = svg.current!.getBoundingClientRect();
    const scale = Math.max(vb.w / r.width, vb.h / r.height);
    const ox = (r.width * scale - vb.w) / 2;
    const oy = (r.height * scale - vb.h) / 2;
    return {
      x: vb.x - ox + (clientX - r.left) * scale,
      y: vb.y - oy + (clientY - r.top) * scale,
      scale,
    };
  };
  const onWheel = (e: WheelEvent) => {
    const p = toWorld(e.clientX, e.clientY);
    const k = Math.exp(e.deltaY * 0.0015);
    const w = Math.min(Math.max(vb.w * k, 6), fit.w * 2);
    const h = (w / vb.w) * vb.h;
    setView({ x: p.x - ((p.x - vb.x) * w) / vb.w, y: p.y - ((p.y - vb.y) * h) / vb.h, w, h });
  };
  const onDown = (e: PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!drag.current) return;
    const { scale } = toWorld(e.clientX, e.clientY);
    const dx = (e.clientX - drag.current.x) * scale;
    const dy = (e.clientY - drag.current.y) * scale;
    drag.current = { x: e.clientX, y: e.clientY };
    setView({ ...vb, x: vb.x - dx, y: vb.y - dy });
  };
  const onUp = () => (drag.current = null);

  const lanePoint = (p: Position) => {
    const g = layout.squares[p.square];
    return g?.lanes[Math.min(Math.max(p.lane, 0), g.lanes.length - 1)] ?? [0, 0];
  };

  // Placement targets for the human.
  const placements =
    !animating && state.phase === 'placement'
      ? legalActions(state, HUMAN).filter(
          (a) => a.type === 'placeRider' && (!placingRider || a.rider === placingRider),
        )
      : [];
  const placementSquares = new Set(
    placements.map((a) => (a.type === 'placeRider' ? a.position.square : '')),
  );

  // Ghost preview for the hovered or selected card.
  const dealt = Object.values(state.riders).find((r) => r.team === HUMAN && r.hand);
  const previewCard = dealt?.hand?.find((c) => c.id === (hoverCard ?? selectedCard));
  const preview =
    dealt && previewCard && !animating ? previewMove(state, dealt.id, previewCard) : null;

  const startSq = Object.values(state.track.squares).find((s) => s.flags.includes('startLine'));
  const lines = [startSq?.id, state.track.finishSquare].filter(Boolean) as string[];

  return (
    <svg
      ref={svg}
      className="board"
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      preserveAspectRatio="xMidYMid meet"
      onWheel={onWheel}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onDoubleClick={() => setView(null)}
      role="img"
      aria-label="Race board"
    >
      {Object.values(layout.squares).map((g) => {
        const sq = state.track.squares[g.id]!;
        const target = placementSquares.has(g.id);
        return (
          <polygon
            key={g.id}
            points={g.polygon.map((p) => p.join(',')).join(' ')}
            fill={TERRAIN_FILL[sq.terrain]}
            className={`square${target ? ' square--target' : ''}${sq.flags.includes('startGrid') ? ' square--grid' : ''}`}
            onClick={() => {
              if (!target) return;
              const a = placements.find(
                (x) => x.type === 'placeRider' && x.position.square === g.id,
              );
              if (a) act(a);
            }}
          >
            <title>{`Square ${sq.index}: ${sq.terrain}${sq.lanes !== 2 ? `, ${sq.lanes} lanes` : ''}`}</title>
          </polygon>
        );
      })}
      {lines.map((id) => {
        const g = layout.squares[id]!;
        return (
          <line
            key={id}
            className="line"
            x1={g.entryEdge[0][0]}
            y1={g.entryEdge[0][1]}
            x2={g.entryEdge[1][0]}
            y2={g.entryEdge[1][1]}
          />
        );
      })}
      {preview && (
        <g
          className="ghost"
          transform={`translate(${lanePoint({ square: preview.unobstructed.square, lane: 0 }).join(',')})`}
        >
          <circle r={0.42} />
          <text dy="0.15">{preview.effectiveValue}</text>
        </g>
      )}
      {Object.values(state.riders).map((r) => {
        const pos = display[r.id];
        if (!pos) return null;
        const [x, y] = lanePoint(pos);
        const team = state.teams.find((t) => t.team === r.team)!;
        const card = revealed?.[r.id];
        return (
          <g
            key={r.id}
            className={`rider rider--${team.color}${r.team === HUMAN ? ' rider--mine' : ''}`}
            style={{
              transform: `translate(${x}px, ${y}px)`,
              transition: `transform ${moveMs[r.id] ?? 0}ms linear`,
            }}
          >
            <circle r={0.38} />
            <text dy="0.14">{r.type === 'rouleur' ? 'R' : 'S'}</text>
            {card && (
              <g className="reveal" transform="translate(0,-0.85)">
                <rect x={-0.32} y={-0.3} width={0.64} height={0.6} rx={0.08} />
                <text dy="0.13">{card.value}</text>
              </g>
            )}
            {tired[r.id] ? (
              <text key={tired[r.id]} className="tired" dy="-0.6">
                +2
              </text>
            ) : null}
            <title>{`${r.team === HUMAN ? 'Your' : 'Team'} ${r.type}`}</title>
          </g>
        );
      })}
    </svg>
  );
}
