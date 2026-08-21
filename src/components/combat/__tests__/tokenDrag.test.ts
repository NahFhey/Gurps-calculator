/**
 * Token drag-to-move permission logic (CombatMapPanel pure helpers).
 */

import { describe, it, expect } from 'vitest';
import { findOccupantAt, canDragToken } from '../CombatMapPanel';
import type { Participant } from '../../../types/combatTracker';

const participant = (over: Partial<Participant>): Participant =>
  ({
    instanceId: 'p-1',
    id: 'c-1',
    name: 'Mira',
    category: 'player',
    conditions: [],
    ...over,
  }) as unknown as Participant;

const gmOpts = {
  isGmMode: true,
  currentActorInstanceId: 'p-1',
  movementBudgetYards: 0,
  hasMovedThisTurn: false,
};
const playerOpts = {
  isGmMode: false,
  currentActorInstanceId: 'p-1',
  movementBudgetYards: 5,
  hasMovedThisTurn: false,
};

describe('findOccupantAt', () => {
  const roster = [
    participant({ instanceId: 'a', position: { r: 2, q: 3 } }),
    participant({ instanceId: 'b', position: { r: 4, q: 4 } }),
    participant({ instanceId: 'c' }), // unplaced
  ];

  it('returns the participant on the given cell', () => {
    expect(findOccupantAt(roster, 4, 4)?.instanceId).toBe('b');
  });

  it('returns undefined for an empty cell', () => {
    expect(findOccupantAt(roster, 0, 0)).toBeUndefined();
  });

  it('never matches unplaced participants', () => {
    expect(
      findOccupantAt([participant({ instanceId: 'c' })], 0, 0),
    ).toBeUndefined();
  });
});

describe('canDragToken', () => {
  it('is false for an empty tile', () => {
    expect(canDragToken(undefined, gmOpts)).toBe(false);
    expect(canDragToken(undefined, playerOpts)).toBe(false);
  });

  it('GM may drag any token regardless of turn or budget', () => {
    const enemy = participant({ instanceId: 'e-1', category: 'enemy' });
    expect(canDragToken(enemy, gmOpts)).toBe(true);
    expect(
      canDragToken(enemy, { ...gmOpts, currentActorInstanceId: 'someone-else' }),
    ).toBe(true);
  });

  it('player may drag the current actor with movement available', () => {
    expect(canDragToken(participant({}), playerOpts)).toBe(true);
  });

  it("player may not drag another participant's token", () => {
    expect(
      canDragToken(participant({ instanceId: 'e-1' }), playerOpts),
    ).toBe(false);
  });

  it('player may not drag after moving this turn', () => {
    expect(
      canDragToken(participant({}), { ...playerOpts, hasMovedThisTurn: true }),
    ).toBe(false);
  });

  it('player may not drag with no movement budget (no maneuver selected)', () => {
    expect(
      canDragToken(participant({}), { ...playerOpts, movementBudgetYards: 0 }),
    ).toBe(false);
  });
});
