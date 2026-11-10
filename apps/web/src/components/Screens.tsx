/** Home screen (choose stage and opponents) and the results overlay. */
import { ORIGINAL_STAGES } from '@velo/content';
import { randomBaseStage } from '@velo/engine/testing';
import { useState } from 'react';
import { riderName } from '../game/narrate';
import { HUMAN, useRace } from '../game/store';

const newSeed = () => Math.random().toString(36).slice(2, 8);

export function Home() {
  const start = useRace((s) => s.start);
  const [stageId, setStageId] = useState(ORIGINAL_STAGES[0]!.id);
  const [opponents, setOpponents] = useState(2);
  return (
    <main className="home">
      <h1>Tour de Jour</h1>
      <p className="tagline">A cycling race of cards, slipstreams and tired legs. Working title.</p>
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
          className="btn btn--primary"
          onClick={() => {
            const seed = newSeed();
            const stage =
              stageId === 'random'
                ? { ...randomBaseStage(seed), name: `Random stage ${seed}` }
                : ORIGINAL_STAGES.find((s) => s.id === stageId)!;
            start({ stage, opponents, seed });
          }}
        >
          Start race
        </button>
      </div>
      <p className="note">
        Local play against random bots. Online rooms arrive in a later milestone.
      </p>
    </main>
  );
}

export function Results() {
  const { state, animating, setup, start, goHome } = useRace();
  if (!state || state.phase !== 'stageEnd' || animating || !state.result) return null;
  const winner = state.riders[state.result[0]!]!;
  return (
    <div className="overlay" role="dialog" aria-label="Race results">
      <div className="results">
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
          <button className="btn" onClick={goHome}>
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
