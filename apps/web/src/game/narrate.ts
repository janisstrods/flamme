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
      return ev.phase === 'energy' ? `Round ${ev.round}` : null;
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
            : why === 'descent'
              ? `descent lifts ${ev.cardValue} to ${ev.effectiveValue}`
              : `${ev.cardValue} counts as ${ev.effectiveValue}`,
        );
      }
      if (ev.blocked) bits.push('blocked, drops back to a free lane');
      return `${name(ev.rider)} moves ${ev.path.length}${bits.length ? `: ${bits.join('; ')}` : ''}`;
    }
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
