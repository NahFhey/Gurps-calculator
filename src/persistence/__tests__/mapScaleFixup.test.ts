import { describe, expect, it } from 'vitest';
import { campaignReducer, createCampaignState } from '../../state/campaignReducer';
import type { CampaignState } from '../../state/campaignReducer';
import { createNewMap } from '../../utils/mapUtils';
import { isRoutableMap } from '../../utils/mapScale';
import { ensureMapScale } from '../dataMigration';
import { hydrateCampaignState, serializeCampaignState } from '../campaignStorage';
import type { CampaignDTO } from '../campaignCodec';

function fixture() {
  const state = createCampaignState();
  const map = createNewMap({ name: 'Legacy', scale: '50mi', startTerrainId: 'terrain-plains' });
  const clean = createNewMap({ name: 'Clean', scale: '1yd', startTerrainId: 'terrain-plains' });
  state.maps = { ...state.maps, activeMapId: map.id, mapsById: { [map.id]: map, [clean.id]: clean } };
  const checkpointed = campaignReducer(state, { type: 'createCheckpoint', payload: 'Clean' });
  const { scale: _scale, ...rest } = map;
  // Legacy keys are intentionally plain string literals for migration tests.
  const legacyMap = { ...rest, scaleMilesPerTile: 50 };
  const legacyMaps = { ...state.maps, mapsById: { [map.id]: legacyMap, [clean.id]: clean } };
  const cleanCheckpoint = checkpointed.checkpoints.entries[0];
  const legacyCheckpoint = {
    ...cleanCheckpoint, id: 'legacy', snapshot: { ...cleanCheckpoint.snapshot, maps: legacyMaps },
  };
  const legacy = {
    ...state, maps: legacyMaps,
    checkpoints: { ...state.checkpoints, entries: [legacyCheckpoint, cleanCheckpoint] },
  } as unknown as CampaignState;
  return { legacy, map, clean, cleanCheckpoint, legacyCheckpoint };
}

describe('ensureMapScale', () => {
  it('rewrites live and checkpoint maps while preserving unchanged maps and checkpoints', () => {
    const { legacy, map, clean, cleanCheckpoint, legacyCheckpoint } = fixture();
    const next = ensureMapScale(legacy);
    expect(next.maps.mapsById[map.id].scale).toBe('50mi');
    expect(next.maps.mapsById[map.id]).not.toHaveProperty('scaleMilesPerTile');
    expect(next.maps.mapsById[clean.id]).toBe(clean);
    const snapshot = next.checkpoints.entries[0].snapshot;
    expect(snapshot.maps.mapsById[map.id].scale).toBe('50mi');
    expect(snapshot.maps.mapsById[map.id]).not.toHaveProperty('scaleMilesPerTile');
    expect(snapshot.maps.mapsById[clean.id]).toBe(clean);
    expect(next.checkpoints.entries[1]).toBe(cleanCheckpoint);
    expect(next.checkpoints.entries[0]).not.toBe(legacyCheckpoint);
    expect(legacyCheckpoint.snapshot.maps.mapsById[map.id]).toHaveProperty('scaleMilesPerTile', 50);
    expect(ensureMapScale(next)).toBe(next);
  });

  it('returns the input by reference when all scales are valid', () => {
    const state = createCampaignState();
    const map = createNewMap({ name: 'Clean', scale: '457mi', startTerrainId: 'terrain-plains' });
    state.maps.mapsById[map.id] = map;
    const checkpointed = campaignReducer(state, { type: 'createCheckpoint', payload: 'Clean' });
    expect(ensureMapScale(checkpointed)).toBe(checkpointed);
  });

  it.each([
    [undefined, 50, '50mi'], [7, undefined, '12mi'], [50, null, '50mi'], ['1yd', 457, '1yd'],
  ])('normalizes scale %s with legacy value %s to %s', (scale, legacyValue, expected) => {
    const { legacy, map } = fixture();
    const input = { ...legacy, maps: { ...legacy.maps, mapsById: {
      [map.id]: { ...map, scale, scaleMilesPerTile: legacyValue },
    } } } as unknown as CampaignState;
    const next = ensureMapScale(input);
    expect(next.maps.mapsById[map.id].scale).toBe(expected);
    expect(next.maps.mapsById[map.id]).not.toHaveProperty('scaleMilesPerTile');
  });

  it('hydrates a serialized 1.6.3 map before routability consumers run', () => {
    const { legacy, map } = fixture();
    const payload: CampaignDTO = JSON.parse(JSON.stringify({ ...serializeCampaignState(legacy), schemaVersion: '1.6.3' }));
    const hydrated = hydrateCampaignState(payload);
    const restoredMap = hydrated.maps.mapsById[map.id];
    expect(restoredMap.scale).toBe('50mi');
    expect(restoredMap).not.toHaveProperty('scaleMilesPerTile');
    expect(() => isRoutableMap(restoredMap)).not.toThrow();
    expect(isRoutableMap(restoredMap)).toBe(true);
  });
});
