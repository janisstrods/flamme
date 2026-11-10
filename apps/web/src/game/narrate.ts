/** Plain-language event log lines, in our own words (C-003). */
import type { GameEvent, RiderId } from '@velo/protocol';

export function riderName(id: RiderId, humanSeat: string): string {
  const [seat, type] = id.split(':');
  const who = seat === humanSeat ? 'Your' : `Team ${Number(seat!.slice(5)) + 1}`;
  return `${who} ${type === 'R' ? 'rouleur' : 'sprinteur'}`;
}

const teamName = (team: string, humanSeat: string) =>
  team === humanSeat ? 'You' : `Team ${Number(team.slice(5)) + 1}`;
const REASON: Record<string, string> = {
  podium: 'stage podium',
  restDay: 'rest day',
  generalBonus: 'overall time',
  teamBonus: 'team time',
  sprintBonus: 'sprints',
  mountainBonus: 'mountains',
};
const JERSEY: Record<string, string> = { yellow: 'yellow', green: 'green', polkaDot: 'polka dot' };

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
    case 'tokenTaken':
      return `${name(ev.rider)} takes ${ev.value} ${ev.kind} point${ev.value > 1 ? 's' : ''}`;
    case 'timePenalty':
      return null;
    case 'tourPointsAwarded':
      return `${teamName(ev.team, humanSeat)} ${ev.points > 0 ? '+' : ''}${ev.points} Tour Point${ev.points === 1 ? '' : 's'} (${REASON[ev.reason]})`;
    case 'jerseyAwarded':
      return `${name(ev.rider)} wears the ${JERSEY[ev.jersey]} jersey`;
    case 'exhaustionReturned':
      return ev.count > 0 && ev.rider.startsWith(`${humanSeat}:`)
        ? `${name(ev.rider)} sheds ${ev.count} exhaustion card${ev.count > 1 ? 's' : ''}`
        : null;
    case 'stageStarted':
      return `Stage ${ev.stageNumber}`;
    case 'tourEnded':
      return `The tour is over: ${teamName(ev.ranking[0] ?? '', humanSeat)} ${ev.ranking[0] === humanSeat ? 'win' : 'wins'}!`;
    case 'riderFinished':
      if (ev.seconds !== undefined)
        return `${name(ev.rider)} crosses the line, place ${ev.place}${ev.seconds ? ` (+${ev.seconds} s)` : ''}`;
      return ev.place === 1
        ? `${name(ev.rider)} wins!`
        : `${name(ev.rider)} crosses the line, place ${ev.place}`;
    default:
      return null;
  }
}
