/**
 * Procedural scenery, seeded per stage (plan section 9): fields, hills near climbs, trees,
 * villages, and crowd, barriers and a one-kilometre arch near the finish. Decorative only:
 * nothing here affects the rules.
 */
import type { Point, SquareGeometry, StageLayout, TrackGraph } from '@velo/content';
import { useMemo } from 'react';

function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Tree {
  x: number;
  y: number;
  r: number;
  tone: number;
}
interface Field {
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number;
  color: string;
}
interface Hill {
  x: number;
  y: number;
  rx: number;
  ry: number;
  angle: number;
}
interface House {
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number;
  roof: string;
}
interface Fan {
  x: number;
  y: number;
  color: string;
}

const FIELD_COLORS = ['#f2d98a', '#c9e3a0', '#e9c77d', '#b9dc8f', '#f4e3a8'];
const ROOFS = ['#d9705a', '#c45c48', '#8f6a5a', '#e0876b'];
const FANS = ['#e0533c', '#1f74c4', '#ffd23f', '#ffffff', '#13a07a', '#d778b0', '#2a2d33'];
const TREE_TONES = ['#4f9d5a', '#5aae63', '#468f51', '#62b46b'];

function nearest(p: Point, squares: SquareGeometry[]): { d: number; sq: SquareGeometry } {
  let best = Infinity;
  let sq = squares[0]!;
  for (const g of squares) {
    const d = Math.hypot(g.center[0] - p[0], g.center[1] - p[1]);
    if (d < best) {
      best = d;
      sq = g;
    }
  }
  return { d: best, sq };
}

function useScenery(layout: StageLayout, track: TrackGraph) {
  return useMemo(() => {
    const rand = rng(track.stageId);
    const squares = Object.values(layout.squares);
    const { minX, minY, maxX, maxY } = layout.bounds;
    const trees: Tree[] = [];
    const fields: Field[] = [];
    const hills: Hill[] = [];
    const houses: House[] = [];
    const fans: Fan[] = [];

    // Hills beside climbs.
    for (const g of squares) {
      const sq = track.squares[g.id];
      if (sq?.terrain !== 'ascent' || rand() > 0.35) continue;
      const side = rand() < 0.5 ? 1 : -1;
      const n: Point = [-Math.sin(g.heading) * side, Math.cos(g.heading) * side];
      const off = 3.2 + rand() * 2;
      hills.push({
        x: g.center[0] + n[0] * off,
        y: g.center[1] + n[1] * off,
        rx: 3 + rand() * 2,
        ry: 2 + rand() * 1.4,
        angle: rand() * 180,
      });
    }

    // Scatter on a jittered grid around the course.
    const step = 1.25;
    for (let x = minX - 6; x < maxX + 6; x += step) {
      for (let y = minY - 6; y < maxY + 6; y += step) {
        const p: Point = [x + (rand() - 0.5) * step, y + (rand() - 0.5) * step];
        const { d, sq } = nearest(p, squares);
        if (d < 2.1) continue;
        const roll = rand();
        if (d < 4.2 && roll < 0.28) {
          const cluster = 1 + Math.floor(rand() * 3);
          for (let i = 0; i < cluster; i++)
            trees.push({
              x: p[0] + (rand() - 0.5) * 0.8,
              y: p[1] + (rand() - 0.5) * 0.8,
              r: 0.32 + rand() * 0.28,
              tone: Math.floor(rand() * TREE_TONES.length),
            });
        } else if (d > 4.6 && roll < 0.045) {
          fields.push({
            x: p[0],
            y: p[1],
            w: 3 + rand() * 3,
            h: 2 + rand() * 2,
            angle: (sq.heading * 180) / Math.PI + (rand() < 0.5 ? 0 : 90),
            color: FIELD_COLORS[Math.floor(rand() * FIELD_COLORS.length)]!,
          });
        } else if (d > 2.6 && d < 3.8 && roll > 0.985) {
          const n = 2 + Math.floor(rand() * 4);
          const along: Point = [Math.cos(sq.heading), Math.sin(sq.heading)];
          for (let i = 0; i < n; i++)
            houses.push({
              x: p[0] + along[0] * i * 0.9,
              y: p[1] + along[1] * i * 0.9,
              w: 0.7,
              h: 0.55 + rand() * 0.2,
              angle: (sq.heading * 180) / Math.PI,
              roof: ROOFS[Math.floor(rand() * ROOFS.length)]!,
            });
        }
      }
    }

    // Crowd lining the last stretch and the run-out.
    const near = squares.filter((g) => {
      const sq = track.squares[g.id];
      return sq && sq.index >= track.finishIndex - 7;
    });
    for (const g of near) {
      const half = (g.lanes.length * 1) / 2;
      for (const side of [1, -1]) {
        const n: Point = [-Math.sin(g.heading) * side, Math.cos(g.heading) * side];
        const along: Point = [Math.cos(g.heading), Math.sin(g.heading)];
        for (let i = 0; i < 4; i++) {
          const o = half + 0.75 + rand() * 0.5;
          const a = (i / 4 - 0.4) * 1;
          fans.push({
            x: g.center[0] + n[0] * o + along[0] * a,
            y: g.center[1] + n[1] * o + along[1] * a,
            color: FANS[Math.floor(rand() * FANS.length)]!,
          });
        }
      }
    }

    // Keep spectators off every stretch of road, including other parts of a looping course.
    const clearFans = fans.filter((f) => {
      const { d, sq } = nearest([f.x, f.y], squares);
      return d > sq.lanes.length / 2 + 0.55;
    });
    fans.length = 0;
    fans.push(...clearFans);

    // The one-kilometre arch: a few squares before the line.
    const archSq = squares.find((g) => track.squares[g.id]?.index === track.finishIndex - 8);
    return { trees, fields, hills, houses, fans, near, archSq };
  }, [layout, track]);
}

export function SceneryGround({ layout, track }: { layout: StageLayout; track: TrackGraph }) {
  const s = useScenery(layout, track);
  return (
    <g className="scenery" aria-hidden="true">
      {s.fields.map((f, i) => (
        <g key={`f${i}`} transform={`translate(${f.x},${f.y}) rotate(${f.angle})`}>
          <rect
            x={-f.w / 2}
            y={-f.h / 2}
            width={f.w}
            height={f.h}
            rx={0.35}
            fill={f.color}
            opacity={0.75}
          />
          {Array.from({ length: Math.floor(f.h / 0.45) }, (_, k) => (
            <line
              key={k}
              x1={-f.w / 2 + 0.2}
              x2={f.w / 2 - 0.2}
              y1={-f.h / 2 + 0.3 + k * 0.45}
              y2={-f.h / 2 + 0.3 + k * 0.45}
              stroke="rgba(120,100,40,0.18)"
              strokeWidth={0.05}
            />
          ))}
        </g>
      ))}
      {s.hills.map((h, i) => (
        <ellipse
          key={`h${i}`}
          cx={h.x}
          cy={h.y}
          rx={h.rx}
          ry={h.ry}
          transform={`rotate(${h.angle} ${h.x} ${h.y})`}
          fill="url(#hill)"
        />
      ))}
      {s.houses.map((h, i) => (
        <g key={`v${i}`} transform={`translate(${h.x},${h.y}) rotate(${h.angle})`}>
          <rect
            x={-h.w / 2 + 0.06}
            y={-h.h / 2 + 0.08}
            width={h.w}
            height={h.h}
            rx={0.05}
            fill="rgba(20,30,20,0.2)"
          />
          <rect x={-h.w / 2} y={-h.h / 2} width={h.w} height={h.h} rx={0.05} fill={h.roof} />
          <line
            x1={-h.w / 2}
            x2={h.w / 2}
            y1={0}
            y2={0}
            stroke="rgba(0,0,0,0.2)"
            strokeWidth={0.04}
          />
        </g>
      ))}
      {s.trees.map((t, i) => (
        <circle key={`ts${i}`} cx={t.x + 0.12} cy={t.y + 0.16} r={t.r} fill="rgba(20,40,20,0.22)" />
      ))}
      {s.trees.map((t, i) => (
        <g key={`t${i}`}>
          <circle cx={t.x} cy={t.y} r={t.r} fill={TREE_TONES[t.tone]} />
          <circle
            cx={t.x - t.r * 0.3}
            cy={t.y - t.r * 0.3}
            r={t.r * 0.45}
            fill="rgba(255,255,255,0.14)"
          />
        </g>
      ))}
    </g>
  );
}

export function SceneryOverlay({ layout, track }: { layout: StageLayout; track: TrackGraph }) {
  const s = useScenery(layout, track);
  const arch = s.archSq;
  return (
    <g className="scenery" aria-hidden="true">
      {s.near.map((g) => {
        const half = g.lanes.length / 2 + 0.35;
        const n: Point = [-Math.sin(g.heading), Math.cos(g.heading)];
        const along: Point = [Math.cos(g.heading) * 0.5, Math.sin(g.heading) * 0.5];
        return [1, -1].map((side) => (
          <line
            key={`${g.id}${side}`}
            x1={g.center[0] + n[0] * half * side - along[0]}
            y1={g.center[1] + n[1] * half * side - along[1]}
            x2={g.center[0] + n[0] * half * side + along[0]}
            y2={g.center[1] + n[1] * half * side + along[1]}
            stroke="#f7f7f2"
            strokeWidth={0.09}
            strokeLinecap="round"
          />
        ));
      })}
      {s.fans.map((f, i) => (
        <circle
          key={i}
          cx={f.x}
          cy={f.y}
          r={0.13}
          fill={f.color}
          stroke="rgba(0,0,0,0.25)"
          strokeWidth={0.02}
        />
      ))}
      {arch && (
        <g>
          {(() => {
            const [r, l] = arch.entryEdge;
            const dx = l[0] - r[0];
            const dy = l[1] - r[1];
            const len = Math.hypot(dx, dy);
            const ux = dx / len;
            const uy = dy / len;
            const a: Point = [r[0] - ux * 0.5, r[1] - uy * 0.5];
            const b: Point = [l[0] + ux * 0.5, l[1] + uy * 0.5];
            const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
            const deg = (Math.atan2(uy, ux) * 180) / Math.PI;
            return (
              <>
                <line
                  x1={a[0]}
                  y1={a[1]}
                  x2={b[0]}
                  y2={b[1]}
                  stroke="rgba(10,20,30,0.25)"
                  strokeWidth={0.42}
                  transform="translate(0.08,0.1)"
                />
                <line
                  x1={a[0]}
                  y1={a[1]}
                  x2={b[0]}
                  y2={b[1]}
                  stroke="var(--ascent)"
                  strokeWidth={0.36}
                  strokeLinecap="round"
                />
                <circle cx={a[0]} cy={a[1]} r={0.16} fill="#f7f7f2" />
                <circle cx={b[0]} cy={b[1]} r={0.16} fill="#f7f7f2" />
                <text
                  className="scenery__arch"
                  transform={`translate(${mid[0]},${mid[1]}) rotate(${deg > 90 || deg < -90 ? deg + 180 : deg})`}
                  dy="0.36em"
                >
                  1 KM
                </text>
              </>
            );
          })()}
        </g>
      )}
    </g>
  );
}

/** Gradient for hills. Render inside <defs>. */
export function SceneryDefs() {
  return (
    <radialGradient id="hill">
      <stop offset="0%" stopColor="#7fbf73" />
      <stop offset="70%" stopColor="#86c67b" />
      <stop offset="100%" stopColor="#8fd18a" stopOpacity={0} />
    </radialGradient>
  );
}
