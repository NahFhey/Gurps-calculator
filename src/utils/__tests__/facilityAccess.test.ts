import { describe, expect, it } from 'vitest';
import { createCampaignState, type CampaignState } from '../../state/campaignReducer';
import { createNewMap } from '../mapUtils';
import type { Vehicle } from '../../types/party';
import { findGroupForCharacter, isAttachmentReachable } from '../facilityAccess';

function fixture(): { state: CampaignState; tileId: string; otherTileId: string } {
  const state = createCampaignState();
  const map = createNewMap({ name: 'Access', scaleMilesPerTile: 12, startTerrainId: 'plains' });
  const tileId = map.grid[0][0];
  const otherTileId = map.grid[0][1];
  state.maps = { ...state.maps, activeMapId: map.id, mapsById: { [map.id]: map } };
  state.entities.characters = {
    hero: { id: 'hero', name: 'Hero', work: { skills: {} } },
  };
  state.entities.travelGroups = {
    group: { id: 'group', name: 'Group', memberIds: ['hero'], vehicleId: null, position: { mapId: map.id, tileId } },
  };
  state.ui.activeTravelGroupId = 'group';
  return { state, tileId, otherTileId };
}

const vehicle = (id: string): Vehicle => ({
  id, name: id, typeId: 'type', position: { kind: 'tile', mapId: 'map', tileId: 'tile' }, createdAt: 0, modifiedAt: 0,
});

describe('facility attachment reachability', () => {
  it('finds the character travel group', () => {
    const { state } = fixture();
    expect(findGroupForCharacter(state, 'hero')?.id).toBe('group');
  });

  it('returns null for an unknown character', () => {
    expect(findGroupForCharacter(fixture().state, 'missing')).toBeNull();
  });

  it('treats an absent attachment as party gear', () => {
    expect(isAttachmentReachable(fixture().state, undefined, 'missing')).toBe(true);
  });

  it('treats an explicit party attachment as reachable', () => {
    expect(isAttachmentReachable(fixture().state, { kind: 'party' }, 'hero')).toBe(true);
  });

  it('matches a location attachment through a marker on the group tile', () => {
    const { state, tileId } = fixture();
    const map = state.maps.mapsById[state.maps.activeMapId!];
    map.markersById.pin = { id: 'pin', tileId, type: 'location', label: 'Town', visibility: 'gm', locationId: 'town' };
    expect(isAttachmentReachable(state, { kind: 'location', locationId: 'town' }, 'hero')).toBe(true);
  });

  it('does not require the location pin to be player-visible', () => {
    const { state, tileId } = fixture();
    const map = state.maps.mapsById[state.maps.activeMapId!];
    map.markersById.pin = { id: 'pin', tileId, type: 'location', label: 'Town', visibility: 'gm', locationId: 'town' };
    expect(map.markersById.pin.visibility).toBe('gm');
    expect(isAttachmentReachable(state, { kind: 'location', locationId: 'town' }, 'hero')).toBe(true);
  });

  it('rejects a location pin on another tile', () => {
    const { state, otherTileId } = fixture();
    const map = state.maps.mapsById[state.maps.activeMapId!];
    map.markersById.pin = { id: 'pin', tileId: otherTileId, type: 'location', label: 'Town', visibility: 'player', locationId: 'town' };
    expect(isAttachmentReachable(state, { kind: 'location', locationId: 'town' }, 'hero')).toBe(false);
  });

  it('rejects a dangling location id', () => {
    expect(isAttachmentReachable(fixture().state, { kind: 'location', locationId: 'missing' }, 'hero')).toBe(false);
  });

  it('reaches the vehicle the character is aboard', () => {
    const { state } = fixture();
    state.entities.vehicles = { ship: vehicle('ship') };
    state.entities.travelGroups!.group = { ...state.entities.travelGroups!.group, vehicleId: 'ship', position: null };
    expect(isAttachmentReachable(state, { kind: 'vehicle', vehicleId: 'ship' }, 'hero')).toBe(true);
  });

  it('reaches a carrier from a group aboard its docked craft', () => {
    const { state } = fixture();
    const carrier = vehicle('carrier');
    const scout = vehicle('scout');
    scout.position = { kind: 'docked', carrierId: carrier.id };
    state.entities.vehicles = { carrier, scout };
    state.entities.travelGroups!.group = { ...state.entities.travelGroups!.group, vehicleId: 'scout', position: null };
    expect(isAttachmentReachable(state, { kind: 'vehicle', vehicleId: 'carrier' }, 'hero')).toBe(true);
  });

  it('reaches a docked craft from a group aboard its carrier', () => {
    const { state } = fixture();
    const carrier = vehicle('carrier');
    const scout = vehicle('scout');
    scout.position = { kind: 'docked', carrierId: carrier.id };
    state.entities.vehicles = { carrier, scout };
    state.entities.travelGroups!.group = { ...state.entities.travelGroups!.group, vehicleId: 'carrier', position: null };
    expect(isAttachmentReachable(state, { kind: 'vehicle', vehicleId: 'scout' }, 'hero')).toBe(true);
  });

  it('rejects a separate or dangling vehicle', () => {
    const { state } = fixture();
    state.entities.vehicles = { ship: vehicle('ship'), wagon: vehicle('wagon') };
    state.entities.travelGroups!.group = { ...state.entities.travelGroups!.group, vehicleId: 'ship', position: null };
    expect(isAttachmentReachable(state, { kind: 'vehicle', vehicleId: 'wagon' }, 'hero')).toBe(false);
    expect(isAttachmentReachable(state, { kind: 'vehicle', vehicleId: 'missing' }, 'hero')).toBe(false);
  });
});
