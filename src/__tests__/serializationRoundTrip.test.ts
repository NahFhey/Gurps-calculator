/**
 * Tests for serialization round-trip (Set → Array → Set).
 *
 * Ensures that all Set fields survive JSON serialization and deserialization
 * across both campaignStorage and exportImport paths.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createCampaignState } from '../state/campaignReducer';
import {
  serializeCampaignState,
  hydrateCampaignState,
  loadCampaignState,
  saveCampaignState,
} from '../persistence/campaignStorage';
import type { CampaignState } from '../state/campaignReducer';
import type { MapModel } from '../types/map';

type SerializedCampaignState = ReturnType<typeof serializeCampaignState>;

function hydrateSerializedState(
  serialized: SerializedCampaignState,
): CampaignState {
  const hydrationPayload = Object.assign(createCampaignState(), serialized);
  return hydrateCampaignState(hydrationPayload);
}

function makeMap(overrides: Partial<MapModel> = {}): MapModel {
  return {
    id: 'map-1',
    name: 'Test Map',
    visionMode: 'lineOfSight',
    scaleMilesPerTile: 12,
    rows: 1,
    cols: 1,
    grid: [['tile-1']],
    tilesById: {
      'tile-1': {
        id: 'tile-1',
        terrainId: null,
        markerIds: [],
        linkIds: [],
      },
    },
    terrainById: {},
    markersById: {},
    linksById: {},
    revealedTileIds: new Set(),
    lastSelectedTerrainId: '',
    lastPlacedTerrainId: '',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Direct serialize → hydrate round-trip
// ---------------------------------------------------------------------------
describe('serializeCampaignState / hydrateCampaignState round-trip', () => {
  it('round-trips empty Sets', () => {
    const state = createCampaignState();
    // Ensure Sets are empty
    expect(state.combat.reveal.revealedTargets.size).toBe(0);

    const serialized = serializeCampaignState(state);
    // Serialized Sets should be arrays
    expect(Array.isArray(serialized.combat.reveal.revealedTargets)).toBe(true);
    expect(Array.isArray(serialized.combat.reveal.revealedHP)).toBe(true);

    const hydrated = hydrateSerializedState(serialized);
    expect(hydrated.combat.reveal.revealedTargets).toBeInstanceOf(Set);
    expect(hydrated.combat.reveal.revealedTargets.size).toBe(0);
    expect(hydrated.combat.reveal.revealedHP).toBeInstanceOf(Set);
    expect(hydrated.combat.reveal.revealedHP.size).toBe(0);
  });

  it('round-trips populated Sets', () => {
    const state = createCampaignState();
    state.combat.reveal.revealedTargets.add('target-a');
    state.combat.reveal.revealedTargets.add('target-b');
    state.combat.reveal.revealedHP.add('hp-x');

    const serialized = serializeCampaignState(state);
    const json = JSON.stringify(serialized);
    const parsed = JSON.parse(json);
    const hydrated = hydrateCampaignState(parsed);

    expect(hydrated.combat.reveal.revealedTargets).toBeInstanceOf(Set);
    expect(hydrated.combat.reveal.revealedTargets.has('target-a')).toBe(true);
    expect(hydrated.combat.reveal.revealedTargets.has('target-b')).toBe(true);
    expect(hydrated.combat.reveal.revealedTargets.size).toBe(2);
    expect(hydrated.combat.reveal.revealedHP.has('hp-x')).toBe(true);
  });

  it('round-trips map revealedTileIds Set', () => {
    const state = createCampaignState();
    // Add a map with revealedTileIds
    state.maps.mapsById['map-1'] = makeMap({
      revealedTileIds: new Set(['tile-1', 'tile-2', 'tile-3']),
    });

    const serialized = serializeCampaignState(state);
    const json = JSON.stringify(serialized);
    const parsed = JSON.parse(json);
    const hydrated = hydrateCampaignState(parsed);

    const map = hydrated.maps.mapsById['map-1'];
    expect(map).toBeDefined();
    expect(map.revealedTileIds).toBeInstanceOf(Set);
    expect(map.revealedTileIds.has('tile-1')).toBe(true);
    expect(map.revealedTileIds.has('tile-2')).toBe(true);
    expect(map.revealedTileIds.has('tile-3')).toBe(true);
    expect(map.revealedTileIds.size).toBe(3);
  });

  it('round-trips travel groups, vehicles, and vehicle types as plain state', () => {
    const state = createCampaignState();
    state.entities.travelGroups = {
      g1: {
        id: 'g1', name: 'Scouts', memberIds: Object.keys(state.entities.characters), vehicleId: 'v1', position: null,
      },
    };
    state.entities.vehicles = {
      v1: {
        id: 'v1', name: 'Lancer One', typeId: 'vt-lancer',
        position: { kind: 'tile', mapId: 'map-1', tileId: 'tile-1' },
        createdAt: 10, modifiedAt: 20,
      },
    };
    state.entities.vehicleTypes = {
      'vt-lancer': {
        id: 'vt-lancer', name: 'Lancer', mode: 'airship', minCrew: 1, hangarSlots: 0,
      },
    };
    state.ui.activeTravelGroupId = 'g1';

    const hydrated = hydrateCampaignState(JSON.parse(JSON.stringify(serializeCampaignState(state))));
    expect(hydrated.entities.travelGroups).toEqual(state.entities.travelGroups);
    expect(hydrated.entities.vehicles).toEqual(state.entities.vehicles);
    expect(hydrated.entities.vehicleTypes?.['vt-lancer']).toEqual(state.entities.vehicleTypes['vt-lancer']);
    expect(hydrated.ui.activeTravelGroupId).toBe('g1');
  });

  it('survives JSON.stringify → JSON.parse → hydrate (simulates storage)', () => {
    const state = createCampaignState();
    state.combat.reveal.revealedTargets.add('t1');
    state.combat.reveal.revealedHP.add('h1');
    state.time.day = 42;
    state.ui.activeModule = 'combat';

    const serialized = serializeCampaignState(state);
    const jsonString = JSON.stringify(serialized);

    // Verify Sets became arrays in JSON
    const raw = JSON.parse(jsonString);
    expect(Array.isArray(raw.combat.reveal.revealedTargets)).toBe(true);
    expect(raw.combat.reveal.revealedTargets).toContain('t1');

    // Hydrate back
    const hydrated = hydrateCampaignState(raw);
    expect(hydrated.combat.reveal.revealedTargets).toBeInstanceOf(Set);
    expect(hydrated.combat.reveal.revealedTargets.has('t1')).toBe(true);
    expect(hydrated.time.day).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// Full save → load round-trip via IndexedDB
// ---------------------------------------------------------------------------
describe('save / load round-trip via localStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('Sets survive the full persistence cycle', async () => {
    const state = createCampaignState();
    state.combat.reveal.revealedTargets.add('r1');
    state.combat.reveal.revealedTargets.add('r2');
    state.combat.reveal.revealedHP.add('h1');

    await saveCampaignState(state);
    const loaded = await loadCampaignState();

    expect(loaded.combat.reveal.revealedTargets).toBeInstanceOf(Set);
    expect(loaded.combat.reveal.revealedTargets.has('r1')).toBe(true);
    expect(loaded.combat.reveal.revealedTargets.has('r2')).toBe(true);
    expect(loaded.combat.reveal.revealedHP).toBeInstanceOf(Set);
    expect(loaded.combat.reveal.revealedHP.has('h1')).toBe(true);
  });

  it('handles hydration when stored data has no reveal field', async () => {
    // Simulate data from older version without reveal
    const state = createCampaignState();
    const serialized = serializeCampaignState(state);
    const { reveal: _reveal, ...combatWithoutReveal } = serialized.combat;
    const legacySerialized = {
      ...serialized,
      combat: combatWithoutReveal,
    };

    localStorage.setItem('campaignState', JSON.stringify(legacySerialized));

    const loaded = await loadCampaignState();
    expect(loaded.combat.reveal.revealedTargets).toBeInstanceOf(Set);
    expect(loaded.combat.reveal.revealedHP).toBeInstanceOf(Set);
  });

  it('handles hydration when reveal arrays are null', async () => {
    const state = createCampaignState();
    const serialized = serializeCampaignState(state);
    const serializedWithNullReveal = {
      ...serialized,
      combat: {
        ...serialized.combat,
        reveal: {
          ...serialized.combat.reveal,
          revealedTargets: null,
          revealedHP: null,
        },
      },
    };

    localStorage.setItem('campaignState', JSON.stringify(serializedWithNullReveal));

    const loaded = await loadCampaignState();
    expect(loaded.combat.reveal.revealedTargets).toBeInstanceOf(Set);
    expect(loaded.combat.reveal.revealedTargets.size).toBe(0);
    expect(loaded.combat.reveal.revealedHP).toBeInstanceOf(Set);
    expect(loaded.combat.reveal.revealedHP.size).toBe(0);
  });

  it('handles hydration when maps field is missing', async () => {
    const state = createCampaignState();
    const serialized = serializeCampaignState(state);
    const { maps: _maps, ...serializedWithoutMaps } = serialized;

    localStorage.setItem('campaignState', JSON.stringify(serializedWithoutMaps));

    const loaded = await loadCampaignState();
    expect(loaded.maps).toBeDefined();
    expect(loaded.maps.mapsById).toBeDefined();
  });
});
