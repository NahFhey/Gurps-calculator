import { describe, expect, it } from 'vitest';
import { createDefaultGCSData } from '../../types/characterSheet';
import type { Character } from '../../types/campaign';
import type { TravelGroup, Vehicle } from '../../types/party';
import { createCampaignState } from '../../state/campaignReducer';
import {
  areCoLocated,
  dockedVehicles,
  groupsOnMap,
  isAbleBodied,
  resolveGroupPosition,
  resolveVehiclePosition,
  vehiclesOnMap,
} from '../partyPosition';

const placed = (id: string, tileId: string): Vehicle => ({
  id, name: id, typeId: 'type', position: { kind: 'tile', mapId: 'map', tileId },
  createdAt: 0, modifiedAt: 0,
});
const aboard = (id: string, vehicleId: string): TravelGroup => ({
  id, name: id, memberIds: [], vehicleId, position: null,
});

describe('party position resolution', () => {
  it('resolves a directly placed vehicle', () => {
    expect(resolveVehiclePosition({ ship: placed('ship', 'tile') }, 'ship'))
      .toEqual({ mapId: 'map', tileId: 'tile' });
  });

  it('resolves one docked level through a tiled carrier', () => {
    const carrier = placed('carrier', 'deck');
    const scout = placed('scout', 'unused');
    scout.position = { kind: 'docked', carrierId: carrier.id };
    expect(resolveVehiclePosition({ carrier, scout }, scout.id))
      .toEqual({ mapId: 'map', tileId: 'deck' });
  });

  it('returns null for a docked-to-docked chain', () => {
    const carrier = placed('carrier', 'deck');
    const middle = placed('middle', 'unused');
    const scout = placed('scout', 'unused');
    middle.position = { kind: 'docked', carrierId: carrier.id };
    scout.position = { kind: 'docked', carrierId: middle.id };
    expect(resolveVehiclePosition({ carrier, middle, scout }, scout.id)).toBeNull();
  });

  it('resolves a group from its vehicle or own foot position', () => {
    const state = createCampaignState();
    state.entities.vehicles = { ship: placed('ship', 'deck') };
    expect(resolveGroupPosition(state, aboard('riders', 'ship')))
      .toEqual({ mapId: 'map', tileId: 'deck' });
    expect(resolveGroupPosition(state, {
      id: 'walkers', name: 'Walkers', memberIds: [], vehicleId: null,
      position: { mapId: 'map', tileId: 'road' },
    })).toEqual({ mapId: 'map', tileId: 'road' });
  });

  it('treats groups aboard carrier and docked scout as co-located but not two unplaced groups', () => {
    const state = createCampaignState();
    const carrier = placed('carrier', 'deck');
    const scout = placed('scout', 'unused');
    scout.position = { kind: 'docked', carrierId: carrier.id };
    state.entities.vehicles = { carrier, scout };
    expect(areCoLocated(state, aboard('crew', carrier.id), aboard('pilot', scout.id))).toBe(true);
    const unplaced = (id: string): TravelGroup => ({
      id, name: id, memberIds: [], vehicleId: null, position: null,
    });
    expect(areCoLocated(state, unplaced('a'), unplaced('b'))).toBe(false);
  });

  it('lists resolved groups but only directly placed vehicles on a map', () => {
    const state = createCampaignState();
    const carrier = placed('carrier', 'deck');
    const scout = placed('scout', 'unused');
    scout.position = { kind: 'docked', carrierId: carrier.id };
    state.entities.vehicles = { carrier, scout };
    state.entities.travelGroups = { crew: aboard('crew', carrier.id), pilot: aboard('pilot', scout.id) };
    expect(groupsOnMap(state, 'map').map(({ group }) => group.id)).toEqual(['crew', 'pilot']);
    expect(vehiclesOnMap(state, 'map').map(({ vehicle }) => vehicle.id)).toEqual(['carrier']);
    expect(dockedVehicles(state.entities.vehicles, carrier.id).map((entry) => entry.id)).toEqual(['scout']);
  });

  it('classifies missing pools as able-bodied and critical/dead HP as unable', () => {
    const plain: Character = { id: 'plain', name: 'Plain', work: { skills: {} } };
    expect(isAbleBodied(plain)).toBe(true);
    const injured: Character = { ...plain, id: 'down', gcsData: createDefaultGCSData() };
    injured.gcsData!.pools.HP.current = 0;
    injured.gcsData!.pools.HP.max = 10;
    expect(isAbleBodied(injured)).toBe(false);
    injured.gcsData!.pools.HP.current = -10;
    expect(isAbleBodied(injured)).toBe(false);
  });
});
