/**
 * Track art generated from stage geometry: verge, road surface, lane lines, square dividers,
 * start grid and chequered lines, and terrain treatments. Each terrain has a tint plus a symbol so
 * it reads without colour: ascent = rising wedge, descent = falling wedge, cobbles = setts pattern,
 * supply zone = bottle mark, sharp corner = wavy warning line.
 */
import type { CompiledSquare, Point, SquareGeometry, StageLayout, TrackGraph } from '@velo/content';
import { JerseyPatterns } from './Rider';
import { TeamPatterns } from './teams';

const TINT: Record<CompiledSquare['terrain'], string> = {
  flat: 'var(--road)',
  ascent: 'var(--ascent-tint)',
  descent: 'var(--descent-tint)',
  cobblestone: 'url(#setts)',
  supply: 'var(--supply-tint)',
};

const pts = (p: readonly Point[]) =>
  p.map((q) => `${q[0].toFixed(3)},${q[1].toFixed(3)}`).join(' ');

/** Left and right edges of a square polygon (as produced by layoutStage). */
function edges(g: SquareGeometry): { left: Point[]; right: Point[] } {
  const half = g.polygon.length / 2;
  return { left: g.polygon.slice(0, half), right: g.polygon.slice(half).reverse() };
}

const lerp = (a: Point, b: Point, f: number): Point => [
  a[0] + (b[0] - a[0]) * f,
  a[1] + (b[1] - a[1]) * f,
];

/** Shared defs for track and rider art. Render once per <svg>. */
export function ArtDefs() {
  return (
    <>
      <TeamPatterns />
      <JerseyPatterns />
      <pattern id="setts" width={0.25} height={0.25} patternUnits="userSpaceOnUse">
        <rect width={0.25} height={0.25} fill="var(--cobble-tint)" />
        <rect
          x={0.02}
          y={0.02}
          width={0.1}
          height={0.09}
          rx={0.02}
          fill="var(--cobble)"
          opacity={0.55}
        />
        <rect
          x={0.14}
          y={0.14}
          width={0.1}
          height={0.09}
          rx={0.02}
          fill="var(--cobble)"
          opacity={0.55}
        />
      </pattern>
    </>
  );
}

function Symbol({ g, terrain }: { g: SquareGeometry; terrain: CompiledSquare['terrain'] }) {
  const deg = (g.heading * 180) / Math.PI;
  const [x, y] = g.center;
  if (terrain === 'ascent' || terrain === 'descent') {
    const up = terrain === 'ascent';
    return (
      <g transform={`translate(${x},${y}) rotate(${deg})`}>
        <path
          d={up ? 'M-0.28 0.14 L0.28 0.14 L0.28 -0.14 Z' : 'M-0.28 -0.14 L-0.28 0.14 L0.28 0.14 Z'}
          fill={up ? 'var(--ascent)' : 'var(--descent)'}
        />
      </g>
    );
  }
  if (terrain === 'supply') {
    return (
      <g transform={`translate(${x},${y}) rotate(${deg + 90}) scale(0.022)`} opacity={0.9}>
        <path
          d="M-2 -9 h4 v3 l2 3 v11 a1 1 0 0 1 -1 1 h-6 a1 1 0 0 1 -1 -1 v-11 l2 -3z"
          fill="var(--supply)"
        />
      </g>
    );
  }
  return null;
}

/** Chequered band across the road at a square's entry edge. */
function Chequer({ g }: { g: SquareGeometry }) {
  const [r, l] = g.entryEdge;
  const along: Point = [Math.cos(g.heading) * 0.12, Math.sin(g.heading) * 0.12];
  const shift = (p: Point, k: number): Point => [p[0] + along[0] * k, p[1] + along[1] * k];
  const width = Math.hypot(l[0] - r[0], l[1] - r[1]);
  const row = (k: number, offset: number) => (
    <line
      x1={shift(r, k)[0]}
      y1={shift(r, k)[1]}
      x2={shift(l, k)[0]}
      y2={shift(l, k)[1]}
      stroke="#1d1f24"
      strokeWidth={0.12}
      strokeDasharray={`0.12 0.12`}
      strokeDashoffset={offset}
    />
  );
  return (
    <g>
      <line
        x1={shift(r, 0.5)[0]}
        y1={shift(r, 0.5)[1]}
        x2={shift(l, 0.5)[0]}
        y2={shift(l, 0.5)[1]}
        stroke="#ffffff"
        strokeWidth={0.24}
      />
      {row(0, 0)}
      {row(1, 0.12)}
      <title>{width > 0 ? 'Line' : ''}</title>
    </g>
  );
}

export function TrackArt({
  layout,
  track,
  highlight,
}: {
  layout: StageLayout;
  track: TrackGraph;
  highlight?: ReadonlySet<string>;
}) {
  const squares = Object.values(layout.squares).filter((g) => track.squares[g.id]);
  const startLine = Object.values(track.squares).find((s) => s.flags.includes('startLine'));
  return (
    <g className="track-art">
      {/* verge and soft shadow under the road */}
      {squares.map((g) => (
        <polygon
          key={`v-${g.id}`}
          points={pts(g.polygon)}
          fill="var(--verge)"
          stroke="var(--verge)"
          strokeWidth={0.7}
          strokeLinejoin="round"
        />
      ))}
      {squares.map((g) => (
        <polygon
          key={`s-${g.id}`}
          points={pts(g.polygon)}
          fill="rgba(20,30,20,0.18)"
          transform="translate(0.05,0.08)"
        />
      ))}
      {/* road surface and terrain tint */}
      {squares.map((g) => {
        const sq = track.squares[g.id]!;
        return (
          <polygon
            key={`r-${g.id}`}
            points={pts(g.polygon)}
            fill={TINT[sq.terrain]}
            stroke={TINT[sq.terrain]}
            strokeWidth={0.02}
          >
            <title>{`Square ${sq.index}: ${sq.terrain}, ${sq.lanes} lane${sq.lanes > 1 ? 's' : ''}`}</title>
          </polygon>
        );
      })}
      {/* lane lines */}
      {squares.map((g) => {
        const sq = track.squares[g.id]!;
        const { left, right } = edges(g);
        const lines = [];
        for (let k = 1; k < sq.lanes; k++) {
          const line = right.map((p, i) => lerp(p, left[i]!, k / sq.lanes));
          lines.push(
            <polyline
              key={k}
              points={pts(line)}
              fill="none"
              stroke="var(--lane-line)"
              strokeWidth={0.04}
              strokeDasharray="0.16 0.12"
            />,
          );
        }
        return <g key={`l-${g.id}`}>{lines}</g>;
      })}
      {/* square dividers and road edges */}
      {squares.map((g) => {
        const { left, right } = edges(g);
        return (
          <g key={`e-${g.id}`}>
            <line
              x1={g.entryEdge[0][0]}
              y1={g.entryEdge[0][1]}
              x2={g.entryEdge[1][0]}
              y2={g.entryEdge[1][1]}
              stroke="var(--square-line)"
              strokeWidth={0.035}
            />
            <polyline points={pts(left)} fill="none" stroke="var(--road-edge)" strokeWidth={0.05} />
            <polyline
              points={pts(right)}
              fill="none"
              stroke="var(--road-edge)"
              strokeWidth={0.05}
            />
          </g>
        );
      })}
      {/* terrain symbols, grid boxes, sharp-corner warnings, highlights */}
      {squares.map((g) => {
        const sq = track.squares[g.id]!;
        return (
          <g key={`m-${g.id}`}>
            <Symbol g={g} terrain={sq.terrain} />
            {sq.flags.includes('startGrid') &&
              g.lanes.map((p, i) => (
                <rect
                  key={i}
                  x={p[0] - 0.3}
                  y={p[1] - 0.3}
                  width={0.6}
                  height={0.6}
                  rx={0.06}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={0.035}
                  opacity={0.7}
                  transform={`rotate(${(g.heading * 180) / Math.PI} ${p[0]} ${p[1]})`}
                />
              ))}
            {sq.flags.includes('sharpCorner') && (
              <polyline
                points={pts(edges(g).right)}
                fill="none"
                stroke="var(--descent)"
                strokeWidth={0.08}
                strokeDasharray="0.1 0.06"
              />
            )}
            {highlight?.has(g.id) && (
              <polygon points={pts(g.polygon)} className="track-art__target" />
            )}
          </g>
        );
      })}
      {startLine && layout.squares[startLine.id] && <Chequer g={layout.squares[startLine.id]!} />}
      {layout.squares[track.finishSquare] && <Chequer g={layout.squares[track.finishSquare]!} />}
    </g>
  );
}
