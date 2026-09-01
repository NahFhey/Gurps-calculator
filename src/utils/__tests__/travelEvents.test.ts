import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCampaignState } from '../../state/campaignReducer';
import { createNewMap } from '../mapUtils';
import { resolveTravelEventTable, rollTravelEvent } from '../travelEvents';
import type { TravelEventTable, TravelEventTableSet } from '../../types/travelEvents';

const plains: TravelEventTable = {
  id: 'plains', name: 'Plains', entries: [{ id: 'p', kind: 'flavor', weight: 1, name: 'P', description: 'P' }],
};
const forest: TravelEventTable = {
  id: 'forest', name: 'Forest', entries: [{ id: 'f', kind: 'flavor', weight: 1, name: 'F', description: 'F' }],
};

function fixture() {
  const state = createCampaignState();
  const map = createNewMap({ name: 'Events', scaleMilesPerTile: 12, startTerrainId: 'terrain-plains' });
  state.maps = { ...state.maps, mapsById: { [map.id]: map }, activeMapId: map.id };
  const standard: TravelEventTableSet = {
    id: 'travel-event-set-default', name: 'Default', byTerrain: { 'terrain-plains': plains.id }, fallbackTableId: plains.id,
  };
  state.entities.travelEventTables = { plains, forest };
  state.entities.travelEventTableSets = { [standard.id]: standard };
  return { state, map, standard };
}

describe('resolveTravelEventTable', () => {
  it('prefers a valid map override', () => {
    const { state, map } = fixture();
    state.entities.travelEventTableSets!.custom = { id: 'custom', name: 'Custom', byTerrain: { 'terrain-plains': forest.id } };
    map.travelEventTableSetId = 'custom';
    expect(resolveTravelEventTable(state, map.id, 'terrain-plains')?.id).toBe('forest');
  });

  it('uses the default set without an override', () => {
    const { state, map } = fixture();
    expect(resolveTravelEventTable(state, map.id, 'terrain-plains')?.id).toBe('plains');
  });

  it('falls back to the default set for a dangling override', () => {
    const { state, map } = fixture();
    map.travelEventTableSetId = 'missing';
    expect(resolveTravelEventTable(state, map.id, 'terrain-plains')?.id).toBe('plains');
  });

  it('falls through a dangling terrain table to the set fallback', () => {
    const { state, map, standard } = fixture();
    standard.byTerrain['terrain-forest'] = 'missing';
    expect(resolveTravelEventTable(state, map.id, 'terrain-forest')?.id).toBe('plains');
  });

  it('uses the fallback for custom terrain', () => {
    const { state, map } = fixture();
    expect(resolveTravelEventTable(state, map.id, 'terrain-crystal')?.id).toBe('plains');
  });

  it('returns null when both terrain and fallback references are missing', () => {
    const { state, map, standard } = fixture();
    standard.byTerrain = {};
    standard.fallbackTableId = 'missing';
    expect(resolveTravelEventTable(state, map.id, 'terrain-plains')).toBeNull();
  });

  it('returns null when the default set is tombstoned', () => {
    const { state, map } = fixture();
    delete state.entities.travelEventTableSets!['travel-event-set-default'];
    state.entities.deletedBuiltinTravelEventIds = ['travel-event-set-default'];
    expect(resolveTravelEventTable(state, map.id, 'terrain-plains')).toBeNull();
  });
});

describe('rollTravelEvent', () => {
  afterEach(() => vi.restoreAllMocks());
  const table: TravelEventTable = {
    id: 'weighted', name: 'Weighted', entries: [
      { id: 'a', kind: 'flavor', weight: 2, name: 'A', description: 'A' },
      { id: 'b', kind: 'hazard', weight: 3, name: 'B', description: 'B' },
      { id: 'c', kind: 'encounter', weight: 5, name: 'C', description: 'C' },
    ],
  };
  const ctx = { weatherType: null, isNightSlot: false, forcedMarch: false } as const;

  it('selects the first weighted interval', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(rollTravelEvent(table, ctx)?.id).toBe('a');
  });

  it('selects exactly across the first boundary', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.2);
    expect(rollTravelEvent(table, ctx)?.id).toBe('b');
  });

  it('selects exactly across the second boundary', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(rollTravelEvent(table, ctx)?.id).toBe('c');
  });

  it('gates entries by weather type', () => {
    const gated = { ...table, entries: [{ ...table.entries[0], conditions: { weatherTypes: ['fog' as const] } }] };
    expect(rollTravelEvent(gated, ctx)).toBeNull();
    expect(rollTravelEvent(gated, { ...ctx, weatherType: 'fog' })?.id).toBe('a');
  });

  it('gates entries to night slots', () => {
    const gated = { ...table, entries: [{ ...table.entries[0], conditions: { nightOnly: true } }] };
    expect(rollTravelEvent(gated, ctx)).toBeNull();
    expect(rollTravelEvent(gated, { ...ctx, isNightSlot: true })?.id).toBe('a');
  });

  it('gates entries to forced marches', () => {
    const gated = { ...table, entries: [{ ...table.entries[0], conditions: { forcedMarchOnly: true } }] };
    expect(rollTravelEvent(gated, ctx)).toBeNull();
    expect(rollTravelEvent(gated, { ...ctx, forcedMarch: true })?.id).toBe('a');
  });

  it('returns null for a nothing result', () => {
    expect(rollTravelEvent({ ...table, entries: [{ ...table.entries[0], kind: 'nothing' }] }, ctx)).toBeNull();
  });

  it('returns null when every entry is ineligible', () => {
    expect(rollTravelEvent({ ...table, entries: [{ ...table.entries[0], conditions: { nightOnly: true } }] }, ctx)).toBeNull();
  });

  it('drops zero and negative weights', () => {
    const weighted = { ...table, entries: [
      { ...table.entries[0], weight: 0 },
      { ...table.entries[1], weight: -2 },
      { ...table.entries[2], weight: 1 },
    ] };
    expect(rollTravelEvent(weighted, ctx)?.id).toBe('c');
  });
});
