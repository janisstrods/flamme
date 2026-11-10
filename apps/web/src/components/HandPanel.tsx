/**
 * Bottom panel: your two riders (deck, recycled, tiredness, values left), the hand to choose from
 * and the lock-in controls. Keys: 1–4 pick a card, Enter locks it, Tab switches the first rider.
 */
import { legalActions, previewMove } from '@velo/engine';
import type { RiderState } from '@velo/engine';
import type { TeamColor } from '@velo/protocol';
import { useEffect } from 'react';
import { CardArt } from '../art/Card';
import { Icon } from '../art/Icons';
import { RiderArt } from '../art/Rider';
import { ArtDefs } from '../art/TrackArt';
import { HUMAN, useRace } from '../game/store';

const HINTS: Record<
  string,
  { icon: 'ascent' | 'descent' | 'noSlipstream' | 'cobble'; text: string }
> = {
  cappedByAscent: { icon: 'ascent', text: 'Climb ahead: this card counts as at most 5.' },
  stopsBeforeAscent: { icon: 'ascent', text: 'Stops at the foot of the climb.' },
  boostedByDescent: { icon: 'descent', text: 'Starting on a descent: counts as at least 5.' },
  targetFull: {
    icon: 'noSlipstream',
    text: 'That square is full right now, so you may be blocked.',
  },
  narrowAhead: { icon: 'cobble', text: 'Narrow road ahead.' },
};

function RiderPanel({
  rider,
  color,
  active,
}: {
  rider: RiderState;
  color: TeamColor;
  active: boolean;
}) {
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
    <div className={`rider-panel${active ? ' rider-panel--active' : ''}`}>
      <div className="rider-panel__head">
        <svg viewBox="-0.55 -0.55 1.1 1.1" width={40} height={40} aria-hidden="true">
          <defs>
            <ArtDefs />
          </defs>
          <RiderArt team={color} type={rider.type} heading={-Math.PI / 2} />
        </svg>
        <div>
          <div className="rider-panel__name">Your {rider.type}</div>
          <div className="rider-panel__stats">
            <span title="Face-down cards">Deck {rider.drawPile.length}</span>
            <span title="Face-up cards under the deck">Recycled {rider.recycled.length}</span>
            <span title="Exhaustion cards in this deck" className={tired > 0 ? 'is-tired' : ''}>
              <Icon name="exhaustion" size={13} /> {tired}
            </span>
          </div>
        </div>
        {rider.locked && (
          <span className="rider-panel__locked" title="Locked in">
            {rider.locked.value}
          </span>
        )}
      </div>
      <div className="rider-panel__values" title="Card values still in this deck">
        {[...counts.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([v, n]) => (
            <span key={v}>
              <b>{v}</b>×{n}
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
  const team = state?.teams.find((t) => t.team === HUMAN);
  const color = (team?.color ?? 'red') as TeamColor;
  const mine = state && team ? team.riders.map((id) => state.riders[id]!) : [];
  const dealt = mine.find((r) => r.hand);
  const choose = legal.filter((a) => a.type === 'chooseRider');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (animating) return;
      if (dealt?.hand) {
        const n = Number(e.key);
        if (n >= 1 && n <= dealt.hand.length) select(dealt.hand[n - 1]!.id);
        if (e.key === 'Enter' && selectedCard)
          act({ type: 'playCard', seat: HUMAN, rider: dealt.id, card: selectedCard });
      } else if (e.key === 'Tab' && choose.length > 0) {
        e.preventDefault();
        (document.querySelector('.choose-rider button') as HTMLButtonElement | null)?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dealt, animating, selectedCard, act, select, choose.length]);

  if (!state) return null;

  let prompt = '';
  let controls: React.ReactNode = null;
  if (state.phase === 'placement') {
    const unplaced = mine.filter((r) => !r.position);
    if (legal.length === 0) prompt = animating ? '' : 'Other teams are placing their riders…';
    else {
      prompt = 'Pick a rider, then click a highlighted grid square.';
      controls = (
        <div className="choose-rider">
          {unplaced.map((r) => (
            <button
              key={r.id}
              className={placingRider === r.id ? 'btn btn--on' : 'btn'}
              onClick={() => choosePlacingRider(r.id)}
            >
              Place {r.type}
            </button>
          ))}
        </div>
      );
    }
  } else if (state.phase === 'energy') {
    if (choose.length > 0) {
      prompt = 'Which rider draws first?';
      controls = (
        <div className="choose-rider">
          {choose.map((a) =>
            a.type === 'chooseRider' ? (
              <button key={a.rider} className="btn btn--big" onClick={() => act(a)}>
                {state.riders[a.rider]!.type}
              </button>
            ) : null,
          )}
        </div>
      );
    } else if (dealt?.hand && !animating) {
      prompt = `Choose a card for your ${dealt.type}. Click it again or press Enter to lock it in.`;
      const shown = dealt.hand.find((c) => c.id === (hoverCard ?? selectedCard));
      const hints = shown ? previewMove(state, dealt.id, shown).hints : [];
      controls = (
        <div className="hand-row">
          <div className="hand">
            {dealt.hand.map((c, i) => (
              <button
                key={c.id}
                className={`hand__card${selectedCard === c.id ? ' hand__card--selected' : ''}`}
                onMouseEnter={() => hover(c.id)}
                onMouseLeave={() => hover(null)}
                onFocus={() => hover(c.id)}
                onClick={() =>
                  selectedCard === c.id
                    ? act({ type: 'playCard', seat: HUMAN, rider: dealt.id, card: c.id })
                    : select(c.id)
                }
                aria-label={`Card ${c.value}${c.kind === 'exhaustion' ? ', exhaustion' : ''}. Key ${i + 1}.`}
              >
                {c.kind === 'exhaustion' ? (
                  <CardArt kind="exhaustion" rider={dealt.type} width={74} />
                ) : (
                  <CardArt
                    kind="energy"
                    team={color}
                    rider={dealt.type}
                    value={c.value}
                    powers={c.powers}
                    width={74}
                  />
                )}
                <kbd>{i + 1}</kbd>
              </button>
            ))}
          </div>
          <div className="hints" aria-live="polite">
            {hints.map((h) => (
              <div key={h} className="hint">
                <Icon name={HINTS[h]?.icon ?? 'ascent'} size={16} />
                {HINTS[h]?.text ?? h}
              </div>
            ))}
          </div>
        </div>
      );
    } else if (!animating) prompt = 'Locked in. Waiting for the other teams…';
  }

  return (
    <section className="hand-panel">
      <div className="hand-panel__riders">
        {mine.map((r) => (
          <RiderPanel key={r.id} rider={r} color={color} active={!!r.hand} />
        ))}
      </div>
      <div className="hand-panel__action">
        {prompt && <div className="prompt">{prompt}</div>}
        {controls}
        {error && <div className="error">{error}</div>}
      </div>
    </section>
  );
}
