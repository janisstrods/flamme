/** Bottom panel: your two riders, the hand to choose from, and the lock-in controls. */
import { legalActions, previewMove } from '@velo/engine';
import type { RiderState } from '@velo/engine';
import { useEffect } from 'react';
import { HUMAN, useRace } from '../game/store';

const HINTS: Record<string, string> = {
  cappedByAscent: 'Climb ahead: this card counts as at most 5.',
  stopsBeforeAscent: 'Stops at the foot of the climb.',
  boostedByDescent: 'Starting on a descent: counts as at least 5.',
  targetFull: 'Target square is full right now: you may be blocked.',
  narrowAhead: 'Narrow road ahead.',
};

function RiderCard({ rider }: { rider: RiderState }) {
  const deck = [
    ...rider.drawPile,
    ...rider.recycled,
    ...(rider.hand ?? []),
    ...(rider.locked ? [rider.locked] : []),
  ];
  const counts = new Map<number, number>();
  for (const c of deck) counts.set(c.value, (counts.get(c.value) ?? 0) + 1);
  const tired = deck.filter((c) => c.kind === 'exhaustion').length;
  return (
    <div className={`rider-panel${rider.hand ? ' rider-panel--active' : ''}`}>
      <div className="rider-panel__title">
        Your {rider.type}
        {rider.locked && <span className="badge">locked: {rider.locked.value}</span>}
      </div>
      <div className="rider-panel__stats">
        <span title="Face-down cards">Deck {rider.drawPile.length}</span>
        <span title="Face-up cards under the deck">Recycled {rider.recycled.length}</span>
        <span title="Exhaustion cards in this deck">Tired {tired}</span>
      </div>
      <div className="rider-panel__values" title="Card values left in this deck">
        {[...counts.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([v, n]) => (
            <span key={v}>
              {v}×{n}
            </span>
          ))}
      </div>
    </div>
  );
}

export function HandPanel() {
  const {
    state,
    animating,
    selectedCard,
    hoverCard,
    placingRider,
    act,
    select,
    hover,
    choosePlacingRider,
    error,
  } = useRace();
  const legal = state && !animating ? legalActions(state, HUMAN) : [];
  const mine = state
    ? state.teams.find((t) => t.team === HUMAN)!.riders.map((id) => state.riders[id]!)
    : [];
  const dealt = mine.find((r) => r.hand);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!dealt?.hand || animating) return;
      const n = Number(e.key);
      if (n >= 1 && n <= dealt.hand.length) select(dealt.hand[n - 1]!.id);
      if (e.key === 'Enter' && selectedCard)
        act({ type: 'playCard', seat: HUMAN, rider: dealt.id, card: selectedCard });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dealt, animating, selectedCard, act, select]);

  if (!state) return null;

  let prompt = '';
  let controls: React.ReactNode = null;
  if (state.phase === 'placement') {
    const unplaced = mine.filter((r) => !r.position);
    if (legal.length === 0) prompt = animating ? '' : 'Other teams are placing their riders…';
    else {
      prompt = 'Pick a rider, then click a highlighted grid square.';
      controls = unplaced.map((r) => (
        <button
          key={r.id}
          className={placingRider === r.id ? 'btn btn--on' : 'btn'}
          onClick={() => choosePlacingRider(r.id)}
        >
          Place {r.type}
        </button>
      ));
    }
  } else if (state.phase === 'energy') {
    const choose = legal.filter((a) => a.type === 'chooseRider');
    if (choose.length > 0) {
      prompt = 'Which rider draws first?';
      controls = choose.map((a) =>
        a.type === 'chooseRider' ? (
          <button key={a.rider} className="btn" onClick={() => act(a)}>
            {state.riders[a.rider]!.type}
          </button>
        ) : null,
      );
    } else if (dealt?.hand && !animating) {
      prompt = `Choose a card for your ${dealt.type}. Click it again (or press Enter) to lock it in.`;
      const shown = dealt.hand.find((c) => c.id === (hoverCard ?? selectedCard));
      const hints = shown ? previewMove(state, dealt.id, shown).hints : [];
      controls = (
        <>
          <div className="hand">
            {dealt.hand.map((c, i) => (
              <button
                key={c.id}
                className={`card${c.kind === 'exhaustion' ? ' card--tired' : ''}${selectedCard === c.id ? ' card--selected' : ''}`}
                onMouseEnter={() => hover(c.id)}
                onMouseLeave={() => hover(null)}
                onClick={() =>
                  selectedCard === c.id
                    ? act({ type: 'playCard', seat: HUMAN, rider: dealt.id, card: c.id })
                    : select(c.id)
                }
                aria-label={`Card ${c.value}${c.kind === 'exhaustion' ? ' exhaustion' : ''}, key ${i + 1}`}
              >
                <span className="card__value">{c.value}</span>
                <span className="card__kind">
                  {c.kind === 'exhaustion' ? 'tired' : dealt.type === 'rouleur' ? 'R' : 'S'}
                </span>
              </button>
            ))}
          </div>
          <div className="hints">
            {hints.map((h) => (
              <div key={h}>{HINTS[h] ?? h}</div>
            ))}
          </div>
        </>
      );
    } else if (!animating) prompt = 'Locked in. Waiting for the other teams…';
  }

  return (
    <section className="hand-panel">
      <div className="hand-panel__riders">
        {mine.map((r) => (
          <RiderCard key={r.id} rider={r} />
        ))}
      </div>
      <div className="hand-panel__action">
        {prompt && <div className="prompt">{prompt}</div>}
        <div className="controls">{controls}</div>
        {error && <div className="error">{error}</div>}
      </div>
    </section>
  );
}
