import { describe, expect, it } from 'vitest';
import { createCampaignState } from '../../state/campaignReducer';
import { createNewMap } from '../../utils/mapUtils';
import { migrateTo1_5_8 } from '../../utils/dataMigrations';
import { ensureLocationIntegrity } from '../dataMigration';

function legacyState() {
  const state = createCampaignState();
  state.locations.locations.town = {
    id: 'town', name: 'Town', climate: 'temperate', terrain: 'plains',
    modifiers: { gathering: 0, hunting: 0, foraging: 0, travel: 0 }, createdAt: 1, modifiedAt: 1,
  };
  const legacyLocation = state.locations.locations.town as typeof state.locations.locations.town & Record<string, unknown>;
  legacyLocation['connections'] = [{ targetLocationId: 'old' }];
  const map = createNewMap({ name: 'Map', scaleMilesPerTile: 12, startTerrainId: 'plains' });
  const tileId = map.grid[0][0];
  map.markersById.good = { id: 'good', tileId, type: 'location', label: 'Town', visibility: 'player', locationId: 'town' };
  map.markersById.bad = { id: 'bad', tileId, type: 'location', label: 'Gone', visibility: 'gm', locationId: 'gone' };
  state.maps.mapsById = { [map.id]: map };
  state.entities.vehicles = {
    ship: { id: 'ship', name: 'Ship', typeId: 'type', position: null, createdAt: 1, modifiedAt: 1 },
  };
  state.entities.facilities.good = { id: 'fg', name: 'Good', facilityType: 'workshop', rating: 1, attachment: { kind: 'location', locationId: 'town' } };
  state.entities.facilities.bad = { id: 'fb', name: 'Bad', facilityType: 'workshop', rating: 1, attachment: { kind: 'location', locationId: 'gone' } };
  state.entities.kitchens.bad = { id: 'kb', name: 'Kitchen', rating: 1, description: '', attachment: { kind: 'vehicle', vehicleId: 'gone' } };
  state.entities.alchemyLabs.good = { id: 'lg', name: 'Lab', rating: 1, description: '', attachment: { kind: 'vehicle', vehicleId: 'ship' } };
  return { state, map };
}

describe('location referential integrity', () => {
  it('returns the exact same state reference when already clean', () => {
    const state = createCampaignState();
    expect(ensureLocationIntegrity(state)).toBe(state);
  });

  it('strips the retired location connection field', () => {
    const { state } = legacyState();
    const next = ensureLocationIntegrity(state);
    expect(Object.prototype.hasOwnProperty.call(next.locations.locations.town, 'connections')).toBe(false);
  });

  it('keeps a valid marker location reference', () => {
    const { state, map } = legacyState();
    expect(ensureLocationIntegrity(state).maps.mapsById[map.id].markersById.good.locationId).toBe('town');
  });

  it('drops a dangling marker location reference without deleting the marker', () => {
    const { state, map } = legacyState();
    const marker = ensureLocationIntegrity(state).maps.mapsById[map.id].markersById.bad;
    expect(marker).toBeDefined();
    expect(marker.locationId).toBeUndefined();
  });

  it('keeps valid location and vehicle attachments', () => {
    const { state } = legacyState();
    const next = ensureLocationIntegrity(state);
    expect(next.entities.facilities.good.attachment).toEqual({ kind: 'location', locationId: 'town' });
    expect(next.entities.alchemyLabs.good.attachment).toEqual({ kind: 'vehicle', vehicleId: 'ship' });
  });

  it('reverts dangling location attachments to party semantics', () => {
    expect(ensureLocationIntegrity(legacyState().state).entities.facilities.bad.attachment).toBeUndefined();
  });

  it('reverts dangling vehicle attachments to party semantics', () => {
    expect(ensureLocationIntegrity(legacyState().state).entities.kitchens.bad.attachment).toBeUndefined();
  });

  it('is idempotent after cleaning', () => {
    const first = ensureLocationIntegrity(legacyState().state);
    expect(ensureLocationIntegrity(first)).toBe(first);
  });

  it('registry migration performs the same marker and location cleanup', () => {
    const { state, map } = legacyState();
    const raw = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    const migrated = migrateTo1_5_8(raw);
    const locations = migrated.locations as { locations: Record<string, Record<string, unknown>> };
    const maps = migrated.maps as { mapsById: Record<string, { markersById: Record<string, Record<string, unknown>> }> };
    expect(locations.locations.town.connections).toBeUndefined();
    expect(maps.mapsById[map.id].markersById.bad.locationId).toBeUndefined();
  });

  it('registry migration preserves valid attachments and removes invalid ones', () => {
    const raw = JSON.parse(JSON.stringify(legacyState().state)) as Record<string, unknown>;
    const migrated = migrateTo1_5_8(raw);
    const entities = migrated.entities as { facilities: Record<string, { attachment?: unknown }>; kitchens: Record<string, { attachment?: unknown }> };
    expect(entities.facilities.good.attachment).toEqual({ kind: 'location', locationId: 'town' });
    expect(entities.facilities.bad.attachment).toBeUndefined();
    expect(entities.kitchens.bad.attachment).toBeUndefined();
  });
});
