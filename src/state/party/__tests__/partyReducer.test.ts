import { describe, expect, it } from 'vitest';
import type { Character } from '../../../types/campaign';
import type { TravelGroup, Vehicle, VehicleTypeDef } from '../../../types/party';
import { campaignReducer, createCampaignState, type CampaignState } from '../../campaignReducer';

const char = (id: string): Character => ({ id, name: id, work: { skills: {} } });
const group = (
  id: string,
  memberIds: string[],
  tileId = 't1',
  vehicleId: string | null = null
): TravelGroup => ({
  id, name: id, memberIds, vehicleId,
  position: vehicleId ? null : { mapId: 'm1', tileId },
});
const vehicleType = (id: string, hangarSlots = 0): VehicleTypeDef => ({
  id, name: id, mode: 'airship', minCrew: 1, hangarSlots,
});
const vehicle = (
  id: string,
  typeId: string,
  tileId = 't1'
): Vehicle => ({
  id, name: id, typeId,
  position: { kind: 'tile', mapId: 'm1', tileId },
  createdAt: 1, modifiedAt: 1,
});

function stateWith(groups: TravelGroup[], vehicles: Vehicle[] = []): CampaignState {
  const state = createCampaignState();
  const ids = new Set(groups.flatMap((entry) => entry.memberIds));
  state.entities.characters = Object.fromEntries([...ids].map((id) => [id, char(id)]));
  state.entities.travelGroups = Object.fromEntries(groups.map((entry) => [entry.id, entry]));
  state.entities.vehicles = Object.fromEntries(vehicles.map((entry) => [entry.id, entry]));
  state.entities.vehicleTypes = {
    scout: vehicleType('scout'), carrier: vehicleType('carrier', 1), noHangar: vehicleType('noHangar'),
  };
  state.ui.activeTravelGroupId = groups[0]?.id ?? null;
  return state;
}

describe('partyReducer', () => {
  it('splits members while preserving foot co-location and deletes the emptied source', () => {
    const state = stateWith([group('source', ['a'], 't1')]);
    const next = campaignReducer(state, {
      type: 'party/createGroup', payload: { name: 'Scout', memberIds: ['a'], fromGroupId: 'source' },
    });
    const created = Object.values(next.entities.travelGroups ?? {})[0];
    expect(created).toMatchObject({ name: 'Scout', memberIds: ['a'], position: { mapId: 'm1', tileId: 't1' } });
    expect(next.entities.travelGroups?.source).toBeUndefined();
  });

  it('splits a vehicle-borne group into another group aboard the same vehicle', () => {
    const ship = vehicle('ship', 'carrier');
    const next = campaignReducer(stateWith([group('source', ['a', 'b'], 't1', ship.id)], [ship]), {
      type: 'party/createGroup', payload: { name: 'Watch', memberIds: ['b'], fromGroupId: 'source' },
    });
    const created = Object.values(next.entities.travelGroups ?? {}).find((entry) => entry.id !== 'source');
    expect(created).toMatchObject({ vehicleId: 'ship', position: null });
  });

  it('refuses to move a member whose source is not co-located with the target', () => {
    const next = campaignReducer(stateWith([group('a', ['one'], 't1'), group('b', ['two'], 't2')]), {
      type: 'party/moveMembers', payload: { memberIds: ['one'], toGroupId: 'b' },
    });
    expect(next.entities.travelGroups?.a.memberIds).toEqual(['one']);
    expect(next.entities.travelGroups?.b.memberIds).toEqual(['two']);
  });

  it('moves co-located members, deletes their source, and retargets active group', () => {
    const state = stateWith([group('a', ['one']), group('b', ['two'])]);
    state.ui.activeTravelGroupId = 'a';
    const next = campaignReducer(state, {
      type: 'party/moveMembers', payload: { memberIds: ['one'], toGroupId: 'b' },
    });
    expect(next.entities.travelGroups?.a).toBeUndefined();
    expect(next.entities.travelGroups?.b.memberIds).toEqual(['two', 'one']);
    expect(next.ui.activeTravelGroupId).toBe('b');
  });

  it('never deletes the last group when its final character is removed', () => {
    const next = campaignReducer(stateWith([group('only', ['one'])]), {
      type: 'removeCharacter', payload: 'one',
    });
    expect(next.entities.travelGroups?.only).toBeDefined();
    expect(next.entities.travelGroups?.only.memberIds).toEqual([]);
  });

  it('boards only when the group and vehicle are co-located', () => {
    const ship = vehicle('ship', 'carrier', 't2');
    const state = stateWith([group('g', ['one'], 't1')], [ship]);
    const blocked = campaignReducer(state, {
      type: 'party/boardVehicle', payload: { groupId: 'g', vehicleId: 'ship' },
    });
    expect(blocked.entities.travelGroups?.g.vehicleId).toBeNull();
    const coLocatedShip = vehicle('ship', 'carrier', 't1');
    const boarded = campaignReducer(stateWith([group('g', ['one'], 't1')], [coLocatedShip]), {
      type: 'party/boardVehicle', payload: { groupId: 'g', vehicleId: 'ship' },
    });
    expect(boarded.entities.travelGroups?.g).toMatchObject({ vehicleId: 'ship', position: null });
  });

  it('disembarks onto a directly placed vehicle tile', () => {
    const ship = vehicle('ship', 'carrier', 'landing');
    const next = campaignReducer(stateWith([group('g', ['one'], 't1', 'ship')], [ship]), {
      type: 'party/disembark', payload: { groupId: 'g' },
    });
    expect(next.entities.travelGroups?.g).toMatchObject({
      vehicleId: null, position: { mapId: 'm1', tileId: 'landing' },
    });
  });

  it('enforces same-tile and hangar capacity when docking', () => {
    const carrier = vehicle('carrier-1', 'carrier');
    const first = vehicle('first', 'scout');
    const second = vehicle('second', 'scout');
    const state = stateWith([], [carrier, first, second]);
    const docked = campaignReducer(state, {
      type: 'party/dockVehicle', payload: { vehicleId: 'first', carrierId: 'carrier-1' },
    });
    expect(docked.entities.vehicles?.first.position).toEqual({ kind: 'docked', carrierId: 'carrier-1' });
    const full = campaignReducer(docked, {
      type: 'party/dockVehicle', payload: { vehicleId: 'second', carrierId: 'carrier-1' },
    });
    expect(full.entities.vehicles?.second.position?.kind).toBe('tile');

    const far = vehicle('far', 'scout', 't2');
    const notCoLocated = campaignReducer(stateWith([], [carrier, far]), {
      type: 'party/dockVehicle', payload: { vehicleId: 'far', carrierId: 'carrier-1' },
    });
    expect(notCoLocated.entities.vehicles?.far.position?.kind).toBe('tile');
  });

  it('rejects nesting whether the prospective carrier is docked or the vehicle carries another', () => {
    const carrier = vehicle('carrier-1', 'carrier');
    const middle = vehicle('middle', 'carrier');
    middle.position = { kind: 'docked', carrierId: carrier.id };
    const scout = vehicle('scout-1', 'scout');
    const intoDocked = campaignReducer(stateWith([], [carrier, middle, scout]), {
      type: 'party/dockVehicle', payload: { vehicleId: scout.id, carrierId: middle.id },
    });
    expect(intoDocked.entities.vehicles?.[scout.id].position?.kind).toBe('tile');

    const freshCarrier = vehicle('fresh-carrier', 'carrier');
    const carryingVehicle = vehicle('carrying', 'carrier');
    const child = vehicle('child', 'scout');
    child.position = { kind: 'docked', carrierId: carryingVehicle.id };
    const carrying = campaignReducer(stateWith([], [freshCarrier, carryingVehicle, child]), {
      type: 'party/dockVehicle', payload: { vehicleId: carryingVehicle.id, carrierId: freshCarrier.id },
    });
    expect(carrying.entities.vehicles?.[carryingVehicle.id].position?.kind).toBe('tile');
  });

  it('undocks onto the carrier tile', () => {
    const carrier = vehicle('carrier-1', 'carrier', 'deck');
    const scout = vehicle('scout-1', 'scout');
    scout.position = { kind: 'docked', carrierId: carrier.id };
    const next = campaignReducer(stateWith([], [carrier, scout]), {
      type: 'party/undockVehicle', payload: { vehicleId: scout.id },
    });
    expect(next.entities.vehicles?.[scout.id].position)
      .toEqual({ kind: 'tile', mapId: 'm1', tileId: 'deck' });
  });

  it('removing a vehicle lands aboard groups and docked vehicles on its tile', () => {
    const carrier = vehicle('carrier-1', 'carrier', 'deck');
    const scout = vehicle('scout-1', 'scout');
    scout.position = { kind: 'docked', carrierId: carrier.id };
    const next = campaignReducer(stateWith([group('g', ['one'], 't1', carrier.id)], [carrier, scout]), {
      type: 'party/removeVehicle', payload: { vehicleId: carrier.id },
    });
    expect(next.entities.travelGroups?.g).toMatchObject({
      vehicleId: null, position: { mapId: 'm1', tileId: 'deck' },
    });
    expect(next.entities.vehicles?.[scout.id].position)
      .toEqual({ kind: 'tile', mapId: 'm1', tileId: 'deck' });
  });

  it('does not directly place a vehicle-borne group', () => {
    const ship = vehicle('ship', 'carrier');
    const next = campaignReducer(stateWith([group('g', ['one'], 't1', ship.id)], [ship]), {
      type: 'party/placeGroup', payload: { groupId: 'g', mapId: 'm1', tileId: 'elsewhere' },
    });
    expect(next.entities.travelGroups?.g).toMatchObject({ vehicleId: ship.id, position: null });
  });

  it('CHARACTER_ADD joins the active group and creates The Party when none exists', () => {
    const existing = stateWith([group('active', ['one'])]);
    const joined = campaignReducer(existing, { type: 'addCharacter', payload: char('two') });
    expect(joined.entities.travelGroups?.active.memberIds).toEqual(['one', 'two']);

    const empty = createCampaignState();
    empty.entities.travelGroups = {};
    const created = campaignReducer(empty, { type: 'addCharacter', payload: char('new') });
    expect(Object.values(created.entities.travelGroups ?? {})[0]).toMatchObject({
      name: 'The Party', memberIds: ['new'],
    });
  });

  it('CHARACTER_REMOVE leaves no orphan membership', () => {
    const next = campaignReducer(stateWith([group('a', ['one', 'two'])]), {
      type: 'removeCharacter', payload: 'one',
    });
    expect(next.entities.travelGroups?.a.memberIds).toEqual(['two']);
    expect(Object.values(next.entities.travelGroups ?? {}).flatMap((entry) => entry.memberIds))
      .not.toContain('one');
  });

});
