/**
 * Bottom panel: your two riders (deck, recycled, tiredness, values left), the hand to choose from
 * and the lock-in controls. Keys: 1–4 pick a card, Enter locks it, Tab focuses the rider choice.
 * Reads only this player's redacted view and legal actions.
 */
import { previewFromView } from '@velo/engine';
import type { OwnRider, PublicRider, TeamColor } from '@velo/protocol';
import { useEffect } from 'react';
import { CardArt } from '../art/Card';
import { Icon } from '../art/Icons';
import { RiderArt } from '../art/Rider';
import { ArtDefs } from '../art/TrackArt';
import { SPECIALISTS } from '@velo/content';
import { nameBook } from '../game/names';
import { POWER_TEXT } from './SpecialScreens';
import { useRace } from '../game/store';

const HINTS: Record<
  string,
  {
    icon:
      | 'ascent'
      | 'descent'
      | 'noSlipstream'
      | 'cobble'
      | 'wet'
      | 'crosswind'
      | 'tailwind'
      | 'headwind';
    text: string;
  }
> = {
  cappedByAscent: { icon: 'ascent', text: 'Climb ahead: this card counts as at most 5.' },
  stopsBeforeAscent: { icon: 'ascent', text: 'Stops at the foot of the climb.' },
  boostedByDescent: { icon: 'descent', text: 'Starting on a descent: counts as at least 5.' },
  targetFull: {
    icon: 'noSlipstream',
    text: 'That square is full right now, so you may be blocked.',
  },
  narrowAhead: { icon: 'cobble', text: 'Narrow road ahead.' },
  boostedBySupply: { icon: 'descent', text: 'Starting in the supply zone: counts as at least 4.' },
  endsOnCobbles: { icon: 'cobble', text: 'Ends on the cobbles: no slipstream there.' },
  standsUp: { icon: 'wet', text: 'Standing up from the crash costs 2.' },
  wetLanding: { icon: 'wet', text: 'Wet road: if you are blocked here, you crash.' },
  crosswindLanding: { icon: 'crosswind', text: 'Crosswind: no slipstream there.' },
  tailwindHand: { icon: 'tailwind', text: 'Tailwind: you drew five cards.' },
  headwindHand: { icon: 'headwind', text: 'Headwind: you drew only three cards.' },
  bid: {
    icon: 'noSlipstream',
    text: 'Win the breakaway and your two bid cards leave the deck, plus two exhaustion cards. Lose and they come back.',
  },
};

function RiderPanel({
  pub,
  own,
  color,
}: {
  pub: PublicRider;
  own: OwnRider | undefined;
  color: TeamColor;
}) {
  const room = useRace((s) => s.room);
  const values = Object.entries(pub.remainingValues ?? {}).sort(
    (a, b) => Number(a[0]) - Number(b[0]),
  );
  return (
    <div className={`rider-panel${own?.hand ? ' rider-panel--active' : ''}`}>
      <div className="rider-panel__head">
        <svg viewBox="-0.55 -0.55 1.1 1.1" width={40} height={40} aria-hidden="true">
          <defs>
            <ArtDefs />
          </defs>
          <RiderArt team={color} type={pub.type} heading={-Math.PI / 2} />
        </svg>
        <div>
          <div className="rider-panel__name">
            {nameBook(room?.config).rider(pub.id)}
            <small className="rider-panel__type">
              {pub.type}
              {pub.specialist &&
                ` · ${SPECIALISTS.find((x) => x.id === pub.specialist)?.name ?? pub.specialist}`}
            </small>
          </div>
          <div className="rider-panel__stats">
            <span title="Face-down cards">Deck {pub.drawPileCount}</span>
            <span title="Face-up cards under the deck">Recycled {own?.recycled.length ?? 0}</span>
            <span
              title="Exhaustion cards in this deck"
              className={pub.exhaustionCount > 0 ? 'is-tired' : ''}
            >
              <Icon name="exhaustion" size={13} /> {pub.exhaustionCount}
            </span>
          </div>
        </div>
        {own?.locked && (
          <span className="rider-panel__locked" title="Locked in">
            {own.locked.value}
          </span>
        )}
      </div>
      <div className="rider-panel__values" title="Card values still in this deck">
        {values.map(([v, n]) => (
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
    view,
    track,
    room,
    seat,
    legal,
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
  const usable = animating ? [] : legal;
  const color = (view?.teams.find((t) => t.team === seat)?.color ?? 'red') as TeamColor;
  const mine = view?.riders.filter((r) => r.team === seat) ?? [];
  const ownOf = (id: string) => view?.own?.riders.find((r) => r.rider === id);
  const dealt = view?.own?.riders.find((r) => r.hand);
  const dealtPub = dealt && view?.riders.find((r) => r.id === dealt.rider);
  const choose = usable.filter((a) => a.type === 'chooseRider');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (animating || (e.target as HTMLElement).tagName === 'INPUT') return;
      if (dealt?.hand) {
        const n = Number(e.key);
        if (n >= 1 && n <= dealt.hand.length) select(dealt.hand[n - 1]!.id);
        if (e.key === 'Enter' && selectedCard && seat)
          act({ type: 'playCard', seat, rider: dealt.rider, card: selectedCard });
      } else if (e.key === 'Tab' && choose.length > 0) {
        e.preventDefault();
        (document.querySelector('.choose-rider button') as HTMLButtonElement | null)?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dealt, animating, selectedCard, act, select, choose.length, seat]);

  if (!view) return <section className="hand-panel" />;
  if (!seat || !view.own) {
    return (
      <section className="hand-panel hand-panel--spectator">
        <div className="prompt">You are watching this race.</div>
      </section>
    );
  }

  let prompt = '';
  let controls: React.ReactNode = null;
  if (view.phase === 'placement') {
    const unplaced = mine.filter((r) => !r.position);
    if (usable.length === 0) prompt = animating ? '' : 'Other teams are placing their riders…';
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
  } else if (view.phase === 'energy' || view.phase === 'breakaway') {
    const bidding = view.phase === 'breakaway';
    if (choose.length > 0) {
      prompt = bidding
        ? 'Breakaway! Which rider tries to break away? It bids two cards over two rounds.'
        : 'Which rider draws first?';
      controls = (
        <div className="choose-rider">
          {choose.map((a) =>
            a.type === 'chooseRider' ? (
              <button key={a.rider} className="btn btn--big" onClick={() => act(a)}>
                {mine.find((r) => r.id === a.rider)?.type}
              </button>
            ) : null,
          )}
        </div>
      );
    } else if (dealt?.hand && dealtPub && !animating && track && room) {
      prompt = bidding
        ? `Bid a card for your ${dealtPub.type}. The highest two-card total breaks away.`
        : `Choose a card for your ${dealtPub.type}. Click it again or press Enter to lock it in.`;
      const shown = dealt.hand.find((c) => c.id === (hoverCard ?? selectedCard));
      const wind = dealtPub.position && track.squares[dealtPub.position.square]?.weather;
      const hints = [
        ...(wind === 'tailwind' ? ['tailwindHand'] : wind === 'headwind' ? ['headwindHand'] : []),
        ...(bidding
          ? ['bid']
          : shown
            ? previewFromView(view, track, room.config, dealt.rider, shown).hints
            : []),
        ...(shown?.powers ?? []).map((p) => `power:${p}`),
      ];
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
                    ? act({ type: 'playCard', seat, rider: dealt.rider, card: c.id })
                    : select(c.id)
                }
                aria-label={`Card ${c.value}${c.kind === 'exhaustion' ? ', exhaustion' : ''}. Key ${i + 1}.`}
              >
                {c.kind === 'exhaustion' ? (
                  <CardArt kind="exhaustion" rider={dealtPub.type} width={74} />
                ) : (
                  <CardArt
                    kind="energy"
                    team={color}
                    rider={dealtPub.type}
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
            {hints.map((h) => {
              const power = h.startsWith('power:') ? POWER_TEXT[h.slice(6)] : undefined;
              const hint = power
                ? { icon: power.icon, text: `${power.name}: ${power.text}` }
                : HINTS[h];
              return (
                <div key={h} className="hint">
                  <Icon name={hint?.icon ?? 'ascent'} size={16} />
                  {hint?.text ?? h}
                </div>
              );
            })}
          </div>
        </div>
      );
    } else if (!animating) prompt = 'Locked in. Waiting for the other teams…';
  }

  return (
    <section className="hand-panel">
      <div className="hand-panel__riders">
        {mine.map((r) => (
          <RiderPanel key={r.id} pub={r} own={ownOf(r.id)} color={color} />
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
