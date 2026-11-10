/** Team and rider names from the room config (players pick theirs; bots get generated ones). */
import type { GameConfig, RiderId } from '@velo/protocol';

export interface NameBook {
  /** The team's name, e.g. "Kestrel Racing". */
  team(seat: string): string;
  /** The rider's name, e.g. "Mila Lindqvist". */
  rider(id: RiderId): string;
  /** "rouleur" or "sprinteur". */
  type(id: RiderId): string;
}

export function nameBook(config: GameConfig | null | undefined): NameBook {
  const names = (seat: string) => config?.seats.find((s) => s.seat === seat)?.names;
  const team = (seat: string) => names(seat)?.team ?? `Team ${Number(seat.slice(5)) + 1}`;
  const type = (id: RiderId) => (id.endsWith(':R') ? 'rouleur' : 'sprinteur');
  return {
    team,
    type,
    rider(id) {
      const seat = id.split(':')[0]!;
      const n = names(seat);
      return (id.endsWith(':R') ? n?.rouleur : n?.sprinteur) ?? `${team(seat)} ${type(id)}`;
    },
  };
}
