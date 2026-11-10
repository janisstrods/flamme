/** Plain-language event log lines, in our own words (C-003). */
import type { GameEvent, RiderId } from '@velo/protocol';

export function riderName(id: RiderId, humanSeat: string): string {
  const [seat, type] = id.split(':');
  const who = seat === humanSeat ? 'Your' : `Team ${Number(seat!.slice(5)) + 1}`;
  return `${who} ${type === 'R' ? 'rouleur' : 'sprinteur'}`;
}

export function narrate(ev: GameEvent, humanSeat: string): string | null {
  const name = (id: RiderId) => riderName(id, humanSeat);
  switch (ev.type) {
    case 'phaseChanged':
      return ev.phase === 'energy'
        ? `Round ${ev.round}`
        : ev.phase === 'breakaway'
          ? 'Breakaway bidding: each team sends one rider to bid'
          : null;
    case 'breakawayRevealed':
      return `Breakaway bids, round ${ev.round}: ${ev.bids.map((b) => `${name(b.rider)} ${b.card.value}`).join(', ')}`;
    case 'breakawayWon':
      return ev.riders.length === 0
        ? 'Nobody breaks away'
        : `${ev.riders.map(name).join(' and ')} ${ev.riders.length > 1 ? 'break' : 'breaks'} away!`;
    case 'cardsRevealed':
      return `Cards: ${ev.plays.map((p) => `${name(p.rider)} ${p.card.value}${p.card.kind === 'exhaustion' ? ' (tired)' : ''}`).join(', ')}`;
    case 'riderMoved': {
      const bits: string[] = [];
      if (ev.effectiveValue !== ev.cardValue) {
        const why = ev.modifiers.at(-1)?.source;
        bits.push(
          why === 'ascent'
            ? ev.ascentEdge
              ? 'stops at the foot of the climb'
              : `climb limits ${ev.cardValue} to ${ev.effectiveValue}`
            : why === 'crashRecovery'
              ? `stands up from the crash (${ev.cardValue} counts as ${ev.effectiveValue})`
              : why === 'descent'
                ? `descent lifts ${ev.cardValue} to ${ev.effectiveValue}`
                : why === 'supply'
                  ? `supply zone lifts ${ev.cardValue} to ${ev.effectiveValue}`
                  : `${ev.cardValue} counts as ${ev.effectiveValue}`,
        );
      }
      if (ev.blocked) bits.push('blocked, drops back to a free lane');
      return `${name(ev.rider)} moves ${ev.path.length}${bits.length ? `: ${bits.join('; ')}` : ''}`;
    }
    case 'riderCrashed':
      return `${ev.riders.map(name).join(' and ')} ${ev.riders.length > 1 ? 'crash' : 'crashes'} ${ev.cause === 'wet' ? 'on the wet road' : 'in the corner'}!`;
    case 'slipstream':
      return `Slipstream: ${ev.riders.map(name).join(', ')} close the gap`;
    case 'exhaustionTaken':
      return `${name(ev.rider)} pays for the open road (exhaustion card)`;
    case 'riderFinished':
      return ev.place === 1
        ? `${name(ev.rider)} wins!`
        : `${name(ev.rider)} crosses the line, place ${ev.place}`;
    default:
      return null;
  }
}
