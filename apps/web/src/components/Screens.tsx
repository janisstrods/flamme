/** Home screen (choose stage and opponents) and the results overlay, with illustrated headers. */
import { ORIGINAL_STAGES, TILE_CATALOG, layoutStage } from '@velo/content';
import { randomBaseStage } from '@velo/engine/testing';
import type { RiderId, TeamColor } from '@velo/protocol';
import { useMemo, useState } from 'react';
import { CardArt } from '../art/Card';
import { RiderArt } from '../art/Rider';
import { ArtDefs } from '../art/TrackArt';
import { riderName } from '../game/narrate';
import { HUMAN, useRace } from '../game/store';

const newSeed = () => Math.random().toString(36).slice(2, 8);

/** A road sweeping across the header with a small breakaway on it. */
function HomeBanner() {
  const riders: [number, number, TeamColor, 'rouleur' | 'sprinteur'][] = [
    [7.2, 2.15, 'red', 'sprinteur'],
    [6.2, 2.75, 'blue', 'rouleur'],
    [5.2, 2.2, 'green', 'rouleur'],
    [4.2, 2.8, 'black', 'sprinteur'],
    [2.6, 2.25, 'pink', 'rouleur'],
  ];
  return (
    <svg
      className="home__banner"
      viewBox="0 0 12 4.6"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <ArtDefs />
      </defs>
      <rect width={12} height={4.6} fill="var(--grass)" />
      <ellipse cx={10.2} cy={0.6} rx={3} ry={1.4} fill="#7fbf73" opacity={0.7} />
      <rect x={-1} y={1.55} width={14} height={1.9} fill="var(--verge)" />
      <rect x={-1} y={1.75} width={14} height={1.5} fill="var(--road)" />
      <line
        x1={-1}
        x2={13}
        y1={2.5}
        y2={2.5}
        stroke="var(--lane-line)"
        strokeWidth={0.04}
        strokeDasharray="0.16 0.12"
      />
      <line x1={-1} x2={13} y1={1.77} y2={1.77} stroke="var(--road-edge)" strokeWidth={0.04} />
      <line x1={-1} x2={13} y1={3.23} y2={3.23} stroke="var(--road-edge)" strokeWidth={0.04} />
      {[0.8, 1.6, 9.6, 10.6, 11.3].map((x, i) => (
        <g key={i}>
          <circle
            cx={x + 0.08}
            cy={(i % 2 ? 4.05 : 0.95) + 0.1}
            r={0.36}
            fill="rgba(20,40,20,0.2)"
          />
          <circle cx={x} cy={i % 2 ? 4.05 : 0.95} r={0.36} fill="#4f9d5a" />
        </g>
      ))}
      {riders.map(([x, y, team, type]) => (
        <g key={team} transform={`translate(${x},${y}) scale(0.9)`}>
          <RiderArt team={team} type={type} />
        </g>
      ))}
    </svg>
  );
}

export function Home() {
  const start = useRace((s) => s.start);
  const [stageId, setStageId] = useState(ORIGINAL_STAGES[0]!.id);
  const [opponents, setOpponents] = useState(2);
  const stage = ORIGINAL_STAGES.find((s) => s.id === stageId);
  const layout = useMemo(() => (stage ? layoutStage(stage, TILE_CATALOG) : null), [stage]);
  return (
    <main className="home">
      <HomeBanner />
      <div className="home__body">
        <div className="home__intro">
          <h1>Tour de Jour</h1>
          <p className="tagline">A cycling race of cards, slipstreams and tired legs.</p>
        </div>
        <div className="home__panel">
          <div className="home__form">
            <label>
              Stage
              <select value={stageId} onChange={(e) => setStageId(e.target.value)}>
                {ORIGINAL_STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
                <option value="random">Random stage</option>
              </select>
            </label>
            <label>
              Opponents
              <select value={opponents} onChange={(e) => setOpponents(Number(e.target.value))}>
                {[1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    {n} bot team{n > 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="btn btn--primary btn--big"
              onClick={() => {
                const seed = newSeed();
                const chosen =
                  stageId === 'random'
                    ? { ...randomBaseStage(seed), name: `Random stage ${seed}` }
                    : ORIGINAL_STAGES.find((s) => s.id === stageId)!;
                start({ stage: chosen, opponents, seed });
              }}
            >
              Start race
            </button>
          </div>
          <div className="home__preview" aria-hidden="true">
            {layout && stage ? (
              <CardArt kind="stage" name={stage.name} layout={layout} width={132} />
            ) : (
              <div className="home__random">?</div>
            )}
          </div>
        </div>
        <p className="note">
          Local races against bots. Online rooms arrive in a later milestone.{' '}
          <a href="#/gallery">Art gallery</a>
        </p>
      </div>
    </main>
  );
}

function Podium({ order, colorOf }: { order: RiderId[]; colorOf: (id: RiderId) => TeamColor }) {
  // [place index, x, drop]: winner in the middle on the tallest step.
  const steps: [number, number, number][] = [
    [0, 1.6, 0],
    [1, 0.6, 1.3],
    [2, 2.6, 1.8],
  ];
  return (
    <svg className="podium" viewBox="0 0 3.2 2.4" aria-hidden="true">
      <defs>
        <ArtDefs />
      </defs>
      {steps.map(([place, x, drop]) => {
        const id = order[place];
        if (!id) return null;
        return (
          <g key={place}>
            <rect
              x={x - 0.45}
              y={0.9 + drop * 0.3}
              width={0.9}
              height={1.5 - drop * 0.3}
              rx={0.06}
              fill={place === 0 ? 'var(--jersey-yellow)' : 'var(--surface-2)'}
            />
            <text className="podium__place" x={x} y={1.55 + drop * 0.3}>
              {place + 1}
            </text>
            <g transform={`translate(${x},${0.55 + drop * 0.3}) scale(0.8)`}>
              <RiderArt
                team={colorOf(id)}
                type={id.endsWith(':R') ? 'rouleur' : 'sprinteur'}
                heading={-Math.PI / 2}
              />
            </g>
          </g>
        );
      })}
    </svg>
  );
}

export function Results() {
  const { state, animating, setup, start, goHome, replayLastRound } = useRace();
  if (!state || state.phase !== 'stageEnd' || animating || !state.result) return null;
  const winner = state.riders[state.result[0]!]!;
  const colorOf = (id: RiderId) =>
    state.teams.find((t) => t.team === state.riders[id]!.team)!.color as TeamColor;
  return (
    <div className="overlay" role="dialog" aria-label="Race results">
      <div className="results">
        <Podium order={state.result} colorOf={colorOf} />
        <h2>{winner.team === HUMAN ? 'You win!' : `${riderName(winner.id, HUMAN)} wins`}</h2>
        <ol>
          {state.result.map((id) => (
            <li key={id} className={id.startsWith(HUMAN) ? 'mine' : ''}>
              {riderName(id, HUMAN)}
            </li>
          ))}
        </ol>
        <div className="results__actions">
          <button
            className="btn btn--primary"
            onClick={() => setup && start({ ...setup, seed: newSeed() })}
          >
            Race again
          </button>
          <button className="btn" onClick={replayLastRound}>
            Watch the finish again
          </button>
          <button className="btn" onClick={goHome}>
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
