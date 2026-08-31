import { describe, expect, it, vi } from 'vitest';
import { createCampaignState } from '../../state/campaignReducer';
import type { TravelGroup, Vehicle } from '../../types/party';
import {
  applyCompositionActions,
  buildCompositionActions,
  buildStagedGroup,
  getCoLocatedVehicles,
  getCompositionGroups,
  mapSourceGroupsByMember,
} from '../travelComposition';

const group = (id: string, members: string[], tileId = 't1', vehicleId: string | null = null): TravelGroup => ({
  id, name: id, memberIds: members, vehicleId,
  position: vehicleId ? null : { mapId: 'm1', tileId },
});
const vehicle = (id: string, tileId = 't1'): Vehicle => ({
  id, name: id, typeId: 'type', position: { kind: 'tile', mapId: 'm1', tileId }, createdAt: 1, modifiedAt: 1,
});

describe('travel composition helpers', () => {
  it('builds a staged group without mutating the active group', () => {
    const active = group('active', ['a', 'b']);
    const staged = buildStagedGroup(active, { travelingMemberIds: ['a'], vehicleId: 'ship' });
    expect(staged).toMatchObject({ id: 'active', memberIds: ['a'], vehicleId: 'ship', position: null });
    expect(active.memberIds).toEqual(['a', 'b']);
  });

  it('emits no actions for an unchanged composition', () => {
    const active = group('active', ['a']);
    expect(buildCompositionActions(active, { travelingMemberIds: ['a'], vehicleId: null }, { a: 'active' })).toEqual([]);
  });

  it('dispatches nothing when applying a no-op composition', () => {
    const handlers = {
      partyMoveMembers: vi.fn(),
      partyCreateGroup: vi.fn(),
      partyDisembark: vi.fn(),
      partyBoardVehicle: vi.fn(),
    };
    applyCompositionActions([], handlers);
    expect(Object.values(handlers).every((handler) => handler.mock.calls.length === 0)).toBe(true);
  });

  it('pulls in other-group members before splitting staying members', () => {
    const actions = buildCompositionActions(
      group('active', ['a', 'b']),
      { travelingMemberIds: ['a', 'c'], vehicleId: null },
      { a: 'active', b: 'active', c: 'scouts' }
    );
    expect(actions.map(({ type }) => type)).toEqual(['party/moveMembers', 'party/createGroup']);
    expect(actions[0]).toMatchObject({ payload: { memberIds: ['c'], toGroupId: 'active' } });
    expect(actions[1]).toMatchObject({ payload: { name: 'Staying behind', memberIds: ['b'] } });
  });

  it('disembarks before boarding a changed conveyance', () => {
    const actions = buildCompositionActions(
      group('active', ['a'], 't1', 'old'),
      { travelingMemberIds: ['a'], vehicleId: 'new' },
      { a: 'active' }
    );
    expect(actions.map(({ type }) => type)).toEqual(['party/disembark', 'party/boardVehicle']);
  });

  it('applies the generated sequence through campaign action handlers', () => {
    const order: string[] = [];
    const handlers = {
      partyMoveMembers: vi.fn(() => order.push('move')),
      partyCreateGroup: vi.fn(() => order.push('create')),
      partyDisembark: vi.fn(() => order.push('disembark')),
      partyBoardVehicle: vi.fn(() => order.push('board')),
    };
    const actions = buildCompositionActions(
      group('active', ['a', 'b'], 't1', 'old'),
      { travelingMemberIds: ['a', 'c'], vehicleId: 'new' },
      { a: 'active', b: 'active', c: 'other' }
    );
    applyCompositionActions(actions, handlers);
    expect(order).toEqual(['move', 'create', 'disembark', 'board']);
  });

  it('finds only co-located groups and vehicles', () => {
    const state = createCampaignState();
    const active = group('active', ['a']);
    state.entities.travelGroups = { active, near: group('near', ['b']), far: group('far', ['c'], 't2') };
    state.entities.vehicles = { nearShip: vehicle('nearShip'), farShip: vehicle('farShip', 't2') };
    expect(getCompositionGroups(state, active).map(({ id }) => id)).toEqual(['active', 'near']);
    expect(getCoLocatedVehicles(state, active).map(({ id }) => id)).toEqual(['nearShip']);
  });

  it('maps each pool member to its source group', () => {
    expect(mapSourceGroupsByMember([group('one', ['a', 'b']), group('two', ['c'])])).toEqual({ a: 'one', b: 'one', c: 'two' });
  });
});
