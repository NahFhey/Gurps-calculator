import { describe, expect, it } from 'vitest';
import { createCampaignState, campaignReducer, type CampaignState } from '../../campaignReducer';
import { createNewMap } from '../../../utils/mapUtils';
import type { Journey } from '../../../types/party';
import { createDefaultGCSData } from '../../../types/characterSheet';

function fixture() {
  const state = createCampaignState();
  const map = createNewMap({ name: 'Journeys', scaleMilesPerTile: 12, startTerrainId: 'terrain-plains' });
  const start = map.grid[4][4];
  const end = map.grid[4][5];
  state.maps = { ...state.maps, mapsById: { [map.id]: map }, activeMapId: map.id };
  state.entities = {
    ...state.entities,
    characters: {
      a: { id: 'a', name: 'Ada', work: { skills: {} } },
      b: { id: 'b', name: 'Borin', work: { skills: {} } },
    },
    travelGroups: {
      g: { id: 'g', name: 'Group', memberIds: ['a', 'b'], vehicleId: null, position: { mapId: map.id, tileId: start } },
      h: { id: 'h', name: 'Other', memberIds: [], vehicleId: null, position: { mapId: map.id, tileId: start } },
    },
  };
  return { state, map, start, end };
}

function arm(state: CampaignState, mapId: string, start: string, end: string, navigatorId: string | null = 'a') {
  return campaignReducer(state, { type: 'party/armJourney', payload: { groupId: 'g', journey: {
    mapId, routeTileIds: [start, end], destinationTileId: end, mode: 'foot', navigatorId,
    gmNavigationSkill: 10, forcedMarch: false, gmOverride: false,
  } } });
}

function withJourney(): ReturnType<typeof fixture> {
  const base = fixture();
  return { ...base, state: arm(base.state, base.map.id, base.start, base.end) };
}

describe('journey party actions', () => {
  it('arms a valid journey with generated engine fields', () => {
    const { state, map, start, end } = fixture();
    const next = arm(state, map.id, start, end);
    expect(next.entities.travelGroups?.g.journey).toMatchObject({
      mapId: map.id, routeTileIds: [start, end], status: 'active', legProgressMiles: 0,
      milesTraveled: 0, startedAt: { day: 1, slot: 0 },
    });
  });

  it('rejects a route whose first tile is not current', () => {
    const { state, map, start, end } = fixture();
    expect(arm(state, map.id, end, start).entities.travelGroups?.g.journey).toBeUndefined();
  });

  it('rejects a non-member navigator', () => {
    const { state, map, start, end } = fixture();
    expect(arm(state, map.id, start, end, 'outsider').entities.travelGroups?.g.journey).toBeUndefined();
  });

  it('does not replace an existing journey', () => {
    const { state, map, start, end } = withJourney();
    const id = state.entities.travelGroups?.g.journey?.id;
    expect(arm(state, map.id, start, end).entities.travelGroups?.g.journey?.id).toBe(id);
  });

  it('pauses active journeys manually', () => {
    const { state } = withJourney();
    const next = campaignReducer(state, { type: 'party/pauseJourney', payload: { groupId: 'g' } });
    expect(next.entities.travelGroups?.g.journey).toMatchObject({ status: 'paused', pauseReason: 'manual' });
  });

  it('pause is a no-op without a journey', () => {
    const { state } = fixture();
    expect(campaignReducer(state, { type: 'party/pauseJourney', payload: { groupId: 'g' } })).toBe(state);
  });

  it('resumes and clears the pause reason', () => {
    const { state } = withJourney();
    const paused = campaignReducer(state, { type: 'party/pauseJourney', payload: { groupId: 'g' } });
    const next = campaignReducer(paused, { type: 'party/resumeJourney', payload: { groupId: 'g' } });
    expect(next.entities.travelGroups?.g.journey?.status).toBe('active');
    expect(next.entities.travelGroups?.g.journey?.pauseReason).toBeUndefined();
  });

  it('aborts without moving the group', () => {
    const { state, map, start } = withJourney();
    const next = campaignReducer(state, { type: 'party/abortJourney', payload: { groupId: 'g' } });
    expect(next.entities.travelGroups?.g.journey).toBeNull();
    expect(next.entities.travelGroups?.g.position).toEqual({ mapId: map.id, tileId: start });
  });

  it('reroutes and unpauses', () => {
    const { state, map, start } = withJourney();
    const alternate = map.grid[5][5];
    const paused = campaignReducer(state, { type: 'party/pauseJourney', payload: { groupId: 'g' } });
    const next = campaignReducer(paused, { type: 'party/rerouteJourney', payload: { groupId: 'g', routeTileIds: [start, alternate] } });
    expect(next.entities.travelGroups?.g.journey).toMatchObject({ routeTileIds: [start, alternate], destinationTileId: alternate, status: 'active', legProgressMiles: 0 });
  });

  it('rejects reroutes that do not start at the current tile', () => {
    const { state, map } = withJourney();
    const original = state.entities.travelGroups?.g.journey?.routeTileIds;
    const next = campaignReducer(state, { type: 'party/rerouteJourney', payload: { groupId: 'g', routeTileIds: [map.grid[0][0], map.grid[0][1]] } });
    expect(next.entities.travelGroups?.g.journey?.routeTileIds).toEqual(original);
  });

  it('blocks group creation from a journeying source', () => {
    const { state } = withJourney();
    const next = campaignReducer(state, { type: 'party/createGroup', payload: { name: 'Split', memberIds: ['a'], fromGroupId: 'g' } });
    expect(Object.keys(next.entities.travelGroups ?? {})).toEqual(['g', 'h']);
  });

  it('blocks member movement touching a journeying group', () => {
    const { state } = withJourney();
    const next = campaignReducer(state, { type: 'party/moveMembers', payload: { memberIds: ['a'], toGroupId: 'h' } });
    expect(next.entities.travelGroups?.g.memberIds).toContain('a');
  });

  it('manual group placement aborts the journey', () => {
    const { state, map } = withJourney();
    const tileId = map.grid[5][5];
    const next = campaignReducer(state, { type: 'party/placeGroup', payload: { groupId: 'g', mapId: map.id, tileId } });
    expect(next.entities.travelGroups?.g).toMatchObject({ journey: null, position: { mapId: map.id, tileId } });
  });

  it('manual vehicle placement aborts an aboard journey', () => {
    const base = withJourney();
    const vehicle = { id: 'v', name: 'V', typeId: 'vehicle-airship', position: { kind: 'tile' as const, mapId: base.map.id, tileId: base.start }, createdAt: 0, modifiedAt: 0 };
    const journey = base.state.entities.travelGroups?.g.journey as Journey;
    base.state = {
      ...base.state,
      entities: {
        ...base.state.entities,
        vehicles: { v: vehicle },
        travelGroups: { ...base.state.entities.travelGroups, g: { ...base.state.entities.travelGroups!.g, vehicleId: 'v', position: null, journey } },
      },
    };
    const next = campaignReducer(base.state, { type: 'party/placeVehicle', payload: { vehicleId: 'v', mapId: base.map.id, tileId: base.end } });
    expect(next.entities.travelGroups?.g.journey).toBeNull();
  });

  it('blocks encounter resume while combat is active', () => {
    const { state } = withJourney();
    const group = state.entities.travelGroups!.g;
    const encounterState = {
      ...state,
      entities: { ...state.entities, travelGroups: { ...state.entities.travelGroups, g: { ...group, journey: { ...group.journey!, status: 'paused' as const, pauseReason: 'encounter' as const } } } },
      combat: { ...state.combat, activeSession: { id: 'combat' } as CampaignState['combat']['activeSession'] },
    };
    const next = campaignReducer(encounterState, { type: 'party/resumeJourney', payload: { groupId: 'g' } });
    expect(next.entities.travelGroups?.g.journey?.status).toBe('paused');
  });

  it('allows encounter resume after combat ends', () => {
    const { state } = withJourney();
    const group = state.entities.travelGroups!.g;
    const encounterState = {
      ...state,
      entities: { ...state.entities, travelGroups: { ...state.entities.travelGroups, g: { ...group, journey: { ...group.journey!, status: 'paused' as const, pauseReason: 'encounter' as const } } } },
    };
    const next = campaignReducer(encounterState, { type: 'party/resumeJourney', payload: { groupId: 'g' } });
    expect(next.entities.travelGroups?.g.journey?.status).toBe('active');
  });

  it('records a group meal and clears every current member debt', () => {
    const { state } = fixture();
    state.entities.starvationFpDebt = { a: 2, b: 1, outsider: 3 };
    const next = campaignReducer(state, { type: 'party/recordMeal', payload: { groupId: 'g', day: 4 } });
    expect(next.entities.groupMeals?.g).toBe(4);
    expect(next.entities.starvationFpDebt).toEqual({ a: 0, b: 0, outsider: 3 });
  });

  it('silently ignores meal records for missing groups', () => {
    const { state } = fixture();
    const next = campaignReducer(state, { type: 'party/recordMeal', payload: { groupId: 'missing', day: 4 } });
    expect(next).toBe(state);
  });

  it('increments builtin table tombstones on delete and clears them on upsert', () => {
    const { state } = fixture();
    const table = { id: 'builtin-table', name: 'Builtin', entries: [], builtin: true };
    state.entities.travelEventTables = { [table.id]: table };
    const removed = campaignReducer(state, { type: 'party/removeTravelEventTable', payload: { tableId: table.id } });
    expect(removed.entities.deletedBuiltinTravelEventIds).toContain(table.id);
    const restored = campaignReducer(removed, { type: 'party/upsertTravelEventTable', payload: { table } });
    expect(restored.entities.deletedBuiltinTravelEventIds).not.toContain(table.id);
  });

  it('recorded meals do not require character sheet data', () => {
    const { state } = fixture();
    state.entities.characters.a.gcsData = createDefaultGCSData();
    const next = campaignReducer(state, { type: 'party/recordMeal', payload: { groupId: 'g', day: 2 } });
    expect(next.entities.groupMeals?.g).toBe(2);
  });
});
