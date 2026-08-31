import { describe, expect, it } from 'vitest';
import { createCampaignState } from '../../campaignReducer';
import { createNewMap } from '../../../utils/mapUtils';
import { selectLocationPins, selectPinForLocation, selectPinsForTile } from '../locationPinSelectors';

function stateWithPins() {
  const state = createCampaignState();
  const first = createNewMap({ name: 'First', scaleMilesPerTile: 12, startTerrainId: 'plains' });
  const second = createNewMap({ name: 'Second', scaleMilesPerTile: 12, startTerrainId: 'plains' });
  const tile = first.grid[0][0];
  first.markersById.note = { id: 'note', tileId: tile, type: 'note', label: 'Note', visibility: 'gm' };
  first.markersById.one = { id: 'one', tileId: tile, type: 'location', label: 'One', visibility: 'player', locationId: 'loc-one', discoveredAt: { day: 3, slot: 0 } };
  first.markersById.two = { id: 'two', tileId: tile, type: 'location', label: 'Two', visibility: 'gm', locationId: 'loc-two' };
  second.markersById.other = { id: 'other', tileId: second.grid[0][0], type: 'location', label: 'Other', visibility: 'player', locationId: 'loc-one' };
  state.maps.mapsById = { [first.id]: first, [second.id]: second };
  return { state, first, second, tile };
}

describe('location pin selectors', () => {
  it('returns only markers carrying location ids', () => {
    expect(selectLocationPins(stateWithPins().state)).toHaveLength(3);
  });

  it('includes map, tile, and marker identity', () => {
    const { state, first, tile } = stateWithPins();
    expect(selectLocationPins(state)[0]).toMatchObject({ mapId: first.id, tileId: tile, markerId: 'one' });
  });

  it('preserves player visibility', () => {
    expect(selectLocationPins(stateWithPins().state).find((pin) => pin.markerId === 'one')?.visibility).toBe('player');
  });

  it('preserves GM visibility', () => {
    expect(selectLocationPins(stateWithPins().state).find((pin) => pin.markerId === 'two')?.visibility).toBe('gm');
  });

  it('preserves discovery time including zero-based slot', () => {
    expect(selectLocationPins(stateWithPins().state).find((pin) => pin.markerId === 'one')?.discoveredAt).toEqual({ day: 3, slot: 0 });
  });

  it('filters all pins on a tile in marker order', () => {
    const { state, first, tile } = stateWithPins();
    expect(selectPinsForTile(state, first.id, tile).map((pin) => pin.markerId)).toEqual(['one', 'two']);
  });

  it('returns an empty tile result for unknown coordinates', () => {
    expect(selectPinsForTile(stateWithPins().state, 'missing', 'missing')).toEqual([]);
  });

  it('returns the first marker for a multiply-pinned location', () => {
    expect(selectPinForLocation(stateWithPins().state, 'loc-one')?.markerId).toBe('one');
  });

  it('returns undefined for an unpinned location', () => {
    expect(selectPinForLocation(stateWithPins().state, 'missing')).toBeUndefined();
  });
});
