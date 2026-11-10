/** Runs rule-module hooks in their fixed composition order. */
import type { SquareId } from '@velo/content';
import type { Card, CrashCause, GameEvent, Position, RiderId, ValueModifier } from '@velo/protocol';
import type { CardDisposal, HookContext, ModifierStage, MoveCandidate, RuleModule } from '../hooks';
import { baseModule } from '../modules/base';
import { dummiesModule } from './dummies';
import type { GameState } from '../state';
import { square } from './track';

const REGISTRY: Partial<Record<string, RuleModule>> = { base: baseModule, dummies: dummiesModule };

export function modulesFor(state: GameState): RuleModule[] {
  return state.modules.map((id) => {
    const m = REGISTRY[id];
    if (!m) throw new Error(`Rule module ${id} is not implemented yet`);
    return m;
  });
}

export function contextFor(state: GameState): HookContext {
  return {
    state,
    track: state.track,
    square: (id) => square(state.track, id),
    rider: (id) => {
      const r = state.riders[id];
      if (!r) throw new Error(`Unknown rider ${id}`);
      return r;
    },
  };
}

const STAGES: ModifierStage[] = ['minimum', 'penalty', 'cap'];

export class Hooks {
  private readonly mods: RuleModule[];
  /** Modules that can override base answers, most specific first. */
  private readonly overrideOrder: RuleModule[];
  readonly ctx: HookContext;

  constructor(state: GameState) {
    this.mods = modulesFor(state);
    this.overrideOrder = [...this.mods].reverse();
    this.ctx = contextFor(state);
  }

  handSize(rider: RiderId): number {
    return this.mods.reduce((n, m) => m.handSize?.(this.ctx, rider, n) ?? n, 0);
  }

  effectiveValue(rider: RiderId, card: Card): { value: number; modifiers: ValueModifier[] } {
    const proposals = this.mods.flatMap((m) => m.valueModifiers?.(this.ctx, rider, card) ?? []);
    let value = card.value;
    const modifiers: ValueModifier[] = [];
    for (const stage of STAGES) {
      for (const p of proposals.filter((x) => x.stage === stage)) {
        const next = p.apply(value);
        if (next !== value) modifiers.push({ source: p.source, result: next });
        value = next;
      }
    }
    return { value, modifiers };
  }

  movementOrder(order: RiderId[]): RiderId[] {
    return this.mods.reduce((o, m) => m.movementOrder?.(this.ctx, o) ?? o, order);
  }

  landing(move: MoveCandidate, occ: ReadonlyMap<SquareId, ReadonlySet<number>>): Position {
    for (const m of this.overrideOrder) {
      const p = m.landing?.(this.ctx, move, occ);
      if (p) return p;
    }
    throw new Error('No module answered landing (base module missing?)');
  }

  crashCheck(rider: RiderId, landed: Position, blocked: boolean): CrashCause | null {
    for (const m of this.overrideOrder) {
      const c = m.crashCheck?.(this.ctx, rider, landed, blocked);
      if (c) return c;
    }
    return null;
  }

  slipstreamEligible(role: 'give' | 'receive', sq: SquareId, riders: readonly RiderId[]): boolean {
    return this.mods.every((m) => m.slipstreamEligible?.(this.ctx, role, sq, riders) ?? true);
  }

  exhaustion(rider: RiderId, base: boolean): boolean {
    return this.mods.reduce((e, m) => m.exhaustion?.(this.ctx, rider, e) ?? e, base);
  }

  cardDisposal(rider: RiderId, card: Card): CardDisposal {
    return this.mods.reduce<CardDisposal>(
      (d, m) => m.cardDisposal?.(this.ctx, rider, card, d) ?? d,
      'remove',
    );
  }

  onReveal(rider: RiderId, card: Card): GameEvent[] {
    return this.mods.flatMap((m) => m.onReveal?.(this.ctx, rider, card) ?? []);
  }

  afterMove(
    rider: RiderId,
    card: Card,
    landed: Position,
    occ: ReadonlyMap<SquareId, ReadonlySet<number>>,
  ): Position | undefined {
    for (const m of this.overrideOrder) {
      const p = m.afterMove?.(this.ctx, rider, card, landed, occ);
      if (p) return p;
    }
    return undefined;
  }

  endOfRound(passed: ReadonlyMap<RiderId, readonly SquareId[]>): GameEvent[] {
    return this.mods.flatMap((m) => m.endOfRound?.(this.ctx, passed) ?? []);
  }
}
