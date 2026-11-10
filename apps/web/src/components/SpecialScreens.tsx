/**
 * Grand Tour screens over the board: the specialist draft before stage 1 (G-SPC-1) and the refresh
 * phase of an extended stage (G-EXT-1).
 */
import { SPECIALISTS } from '@velo/content';
import type { DeckEntry, Specialist } from '@velo/content';
import type { Action, GameView, RiderId, TeamColor } from '@velo/protocol';
import { useState } from 'react';
import { CardArt } from '../art/Card';
import { Icon } from '../art/Icons';
import type { IconName } from '../art/Icons';
import { TEAM_STYLES } from '../art/teams';
import { nameBook } from '../game/names';
import { useRace } from '../game/store';

/** What each power does, in our own words. */
export const POWER_TEXT: Record<
  string,
  { icon: IconName; name: string; text: string; badge?: string }
> = {
  strongAscents6: {
    icon: 'ascent',
    badge: '6',
    name: 'Strong climber (6)',
    text: 'On a climb this card counts up to 6 instead of 5.',
  },
  strongAscents7: {
    icon: 'ascent',
    badge: '7',
    name: 'Strong climber (7)',
    text: 'On a climb this card counts up to 7 instead of 5.',
  },
  strongDescents: {
    icon: 'descent',
    name: 'Strong descender',
    text: 'Starting downhill this card counts at least 7 (not in supply zones).',
  },
  recovery: {
    icon: 'recovery',
    name: 'Recovery',
    text: 'Playing it sends one recycled exhaustion card back to the supply.',
  },
  relentless: {
    icon: 'relentless',
    name: 'Relentless',
    text: 'The rider takes no exhaustion card this round.',
  },
  breakaway: {
    icon: 'breakaway',
    name: 'Breakaway',
    text: 'Nobody on this rider’s square gives slipstream this round, not even to its own group.',
  },
  chase: {
    icon: 'chase',
    name: 'Chase',
    text: 'After moving: close up beside the rider ahead, or jump a one-square gap to the group.',
  },
  nimble: {
    icon: 'nimble',
    name: 'Nimble',
    text: 'Ends in the rightmost lane, pushing others one lane left, or on the verge if full.',
  },
};

/** A power's icon with a quick hover (and keyboard focus) explanation that always fits on screen. */
export function PowerIcon({ power, size = 13 }: { power: string; size?: number }) {
  const [tip, setTip] = useState<{ left: number; top: number } | null>(null);
  const p = POWER_TEXT[power];
  if (!p) return null;
  const show = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const width = 240;
    const left = Math.min(
      Math.max(8, r.left + r.width / 2 - width / 2),
      window.innerWidth - width - 8,
    );
    // Above the icon, or below it near the top of the window.
    const top = r.top > 90 ? r.top - 8 : r.bottom + 8;
    setTip({ left, top: r.top > 90 ? -top : top });
  };
  return (
    <span
      className="power-icon"
      tabIndex={0}
      aria-label={`${p.name}: ${p.text}`}
      onMouseEnter={(e) => show(e.currentTarget)}
      onMouseLeave={() => setTip(null)}
      onFocus={(e) => show(e.currentTarget)}
      onBlur={() => setTip(null)}
    >
      <Icon name={p.icon} size={size} />
      {p.badge && <sup>{p.badge}</sup>}
      {tip && (
        <span
          className="power-tip"
          role="tooltip"
          style={
            tip.top < 0
              ? { left: tip.left, bottom: window.innerHeight + tip.top }
              : { left: tip.left, top: tip.top }
          }
        >
          <b>{p.name}</b> {p.text}
        </span>
      )}
    </span>
  );
}

function Entries({ entries, sign }: { entries: readonly DeckEntry[]; sign: '+' | '−' }) {
  return (
    <span className={`draft__cards draft__cards--${sign === '+' ? 'add' : 'remove'}`}>
      {entries.map((e, i) => (
        <span key={i} className="draft__card">
          {sign}
          {e.count}×{e.value}
          {e.powers.map((p) => (
            <PowerIcon key={p} power={p} />
          ))}
        </span>
      ))}
    </span>
  );
}

/** The specialist's powers in words, under its card swap. */
function PowersLine({ specialist }: { specialist: Specialist }) {
  const powers = [...new Set(specialist.adds.flatMap((e) => e.powers))];
  if (powers.length === 0)
    return <div className="draft__powers">No powers: just different card values.</div>;
  return (
    <div className="draft__powers">
      {powers.map((p) => POWER_TEXT[p]?.name).join(', ')} on its new cards
    </div>
  );
}

/** How to read the draft: removed and added cards, and every power. */
function DraftLegend() {
  return (
    <details className="draft__legend" open>
      <summary>How to read this</summary>
      <div className="draft__legend-swap">
        <span className="draft__cards draft__cards--remove">
          <span className="draft__card">−1×3</span>
        </span>
        cards taken out of the rider’s deck
        <span className="draft__cards draft__cards--add">
          <span className="draft__card">+1×5</span>
        </span>
        cards put in (count × value)
      </div>
      <ul className="draft__legend-powers">
        {Object.entries(POWER_TEXT).map(([id, p]) => (
          <li key={id}>
            <PowerIcon power={id} size={15} />
            <span>
              <b>{p.name}</b> {p.text}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function DraftScreen({ view }: { view: GameView }) {
  const { room, seat, legal, act } = useRace();
  const book = nameBook(room?.config);
  const picks = legal.filter(
    (a): a is Extract<Action, { type: 'draftSpecialist' }> => a.type === 'draftSpecialist',
  );
  const taken = new Map<string, RiderId[]>();
  for (const r of view.riders)
    if (r.specialist) taken.set(r.specialist, [...(taken.get(r.specialist) ?? []), r.id]);
  const drafting = view.teams.filter(
    (t) => !room?.config.seats.find((s) => s.seat === t.team && s.controller.kind === 'dummy'),
  );
  const copies = drafting.length >= 4 ? 2 : 1;
  const current = view.teams.find((t) => t.status === 'choosingFirst');
  const color = (team: string) =>
    (view.teams.find((t) => t.team === team)?.color ?? 'red') as TeamColor;
  const column = (type: 'rouleur' | 'sprinteur') => (
    <section>
      <h3>{type === 'rouleur' ? 'Rouleurs' : 'Sprinteurs'}</h3>
      <ul className="draft__list">
        {SPECIALISTS.filter((s) => s.riderType === type).map((s: Specialist) => {
          const by = taken.get(s.id) ?? [];
          const left = copies - by.length;
          const mine = picks.find((a) => a.specialist === s.id);
          return (
            <li key={s.id} className={left <= 0 ? 'is-gone' : ''}>
              <div className="draft__head">
                <b>{s.name}</b>
                <small>{left > 0 ? `${left} left` : 'taken'}</small>
              </div>
              <div className="draft__swap">
                <Entries entries={s.removes} sign="−" />
                <Entries entries={s.adds} sign="+" />
              </div>
              <PowersLine specialist={s} />
              {by.length > 0 && (
                <div className="draft__by">
                  {by.map((id) => (
                    <span key={id}>
                      <span
                        className="swatch"
                        style={{ background: TEAM_STYLES[color(id.split(':')[0]!)].color }}
                      />{' '}
                      {book.rider(id)}
                    </span>
                  ))}
                </div>
              )}
              {mine && (
                <button className="btn btn--primary btn--small" onClick={() => act(mine)}>
                  Pick for {book.rider(mine.rider)}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
  return (
    <div className="results tour draft">
      <p className="eyebrow">Before stage 1</p>
      <h2>Specialist draft</h2>
      <p className="note draft__turn">
        {picks.length > 0
          ? 'Your pick: choose a specialist for one of your riders. Its cards replace some of that rider’s cards for the whole tour.'
          : current
            ? `${book.team(current.team)}${current.team === seat ? ' (you)' : ''} is picking…`
            : 'Waiting…'}
      </p>
      <DraftLegend />
      <div className="tour__grid">
        {column('rouleur')}
        {column('sprinteur')}
      </div>
    </div>
  );
}

function RefreshScreen({ view }: { view: GameView }) {
  const { room, legal, act, tour } = useRace();
  const book = nameBook(room?.config);
  const choice = legal.find(
    (a): a is Extract<Action, { type: 'refreshChoice' }> => a.type === 'refreshChoice',
  );
  const own = choice ? view.own?.riders.find((r) => r.rider === choice.rider) : undefined;
  const cards = (own?.setAside ?? []).filter((c) => c.kind !== 'exhaustion');
  const limit = 24 + (choice && tour.refreshHolder === choice.rider ? 1 : 0);
  const [picked, setPicked] = useState<string[] | null>(null);
  const current = picked ?? choice?.cards ?? [];
  const total = cards.filter((c) => current.includes(c.id)).reduce((n, c) => n + c.value, 0);
  const pub = choice ? view.riders.find((r) => r.id === choice.rider) : undefined;
  const color = (pub ? view.teams.find((t) => t.team === pub.team)?.color : 'red') as TeamColor;
  return (
    <div className="results tour refresh">
      <p className="eyebrow">Refresh</p>
      <h2>Take back played cards</h2>
      {tour.refreshHolder && (
        <p className="note">
          {book.rider(tour.refreshHolder)} took the refresh token (+1). Every rider may take back
          energy cards played this stage, worth up to 24 in all.
        </p>
      )}
      {choice && pub ? (
        <>
          <h3>
            {book.rider(choice.rider)} · {total} of {limit}
          </h3>
          <div className="hand refresh__cards">
            {cards.map((c) => {
              const on = current.includes(c.id);
              const fits = on || total + c.value <= limit;
              return (
                <button
                  key={c.id}
                  className={`hand__card${on ? ' hand__card--selected' : ''}`}
                  disabled={!fits}
                  onClick={() =>
                    setPicked(on ? current.filter((x) => x !== c.id) : [...current, c.id])
                  }
                >
                  <CardArt
                    kind="energy"
                    team={color}
                    rider={pub.type}
                    value={c.value}
                    powers={c.powers}
                    width={64}
                  />
                </button>
              );
            })}
            {cards.length === 0 && <p className="note">No energy cards played this stage.</p>}
          </div>
          <div className="results__actions">
            <button
              className="btn btn--primary"
              onClick={() => {
                act({ ...choice, cards: current });
                setPicked(null);
              }}
            >
              Take back {current.length} card{current.length === 1 ? '' : 's'}
            </button>
          </div>
        </>
      ) : (
        <p className="note">Waiting for the other riders to choose…</p>
      )}
    </div>
  );
}

export function SpecialScreens() {
  const { view, animating, queue, replay } = useRace();
  if (!view || animating || queue.length > 0 || replay) return null;
  if (view.phase !== 'draft' && view.phase !== 'refresh') return null;
  return (
    <div
      className="overlay"
      role="dialog"
      aria-label={view.phase === 'draft' ? 'Specialist draft' : 'Refresh'}
    >
      {view.phase === 'draft' ? <DraftScreen view={view} /> : <RefreshScreen view={view} />}
    </div>
  );
}
