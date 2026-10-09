import { describe, expect, it, vi } from 'vitest';
import { campaignReducer, createCampaignState } from '../../state/campaignReducer';
import type { CampaignAction, CampaignState } from '../../state/campaignReducer';
import type { CombatState, Participant } from '../../types/combatTracker';
import { createNewMap, expandMap } from '../mapUtils';
import { participantToken, resolveParticipantToken, tokenAtCell, tokenTileIds, detachImportedCombat } from '../mapTokenSpatial';
import { defaultFootprint } from '../footprints';
import { participantsFromMap } from '../mapEncounter';
import { commitTokenMove } from '../commitTokenMove';
import { addAction, createHistoryState, undo, redo } from '../combatHistory';
import { createInitialRevealState } from '../combatReveal';
import { buildTacticalTokens } from '../mapTokens';
import { ensureMapTokens } from '../../persistence/dataMigration';
import { hydrateCampaignState, serializeCampaignState } from '../../persistence/campaignStorage';
import { migrateTo1_6_5, migrateData } from '../dataMigrations';
import type { SerializedCampaignState } from '../exportImport';
import type { CampaignDTO } from '../../persistence/campaignCodec';
import { exportLocked, exportUnlocked, importFile, mergeGM, unlockGMData } from '../exportImport';

export function tokenFixture() {
  const state = createCampaignState();
  const map = createNewMap({ name: 'Arena', scale: '1yd', startTerrainId: 'terrain-plains' });
  state.maps = { ...state.maps, mapsById: { [map.id]: map }, activeMapId: map.id };
  const participant: Participant = { instanceId: 'one', id: 'one', name: 'Guard', category: 'enemy',
    libraryId: 'guard', st: 10, dx: 10, iq: 10, ht: 10, hp: 10, fp: 10, mp: 0, basicSpeed: 5, basicMove: 5 };
  const token = participantToken(participant, 'placed', { col: 2, row: 2 });
  map.tokens[token.id] = token;
  participant.tokenRef = { mapId: map.id, tokenId: token.id };
  const combat: CombatState = { id: 'fight', name: 'Arena fight', startTime: 1, mapId: map.id, participants: [participant],
    currentRound: 1, currentTurnIndex: 0, turnOrder: ['one'], turnDecisions: { '1_0_one': { maneuverId: 'move' } }, log: [] };
  state.combat.activeSession = combat;
  state.entities.combatCharacters.guard = { id: 'guard', name: 'Guard', category: 'enemy', isNPC: true, maxHP: 10, skills: {}, weapons: [], st: 10, dx: 10, iq: 10, ht: 10, hp: 10, fp: 10, mp: 0, basicSpeed: 5, basicMove: 5, dodge: 8, dr: 0 };
  return { state, map, token, participant, combat };
}

describe('persistent map tokens through the public reducer', () => {
  it('validates CRUD and rectangular bounds without modifying rejected states', () => {
    const { state, map, token } = tokenFixture();
    const big = { ...token, id: 'big', position: { col: 4, row: 2 }, footprint: defaultFootprint(2, 3) };
    const placed = campaignReducer(state, { type: 'map/addToken', payload: { mapId: map.id, token: big } });
    expect(tokenTileIds(map, placed.maps.mapsById[map.id].tokens.big)).toHaveLength(6);
    const edit = campaignReducer(placed, { type: 'map/updateToken', payload: { mapId: map.id, tokenId: 'big', changes: { label: 'Ogre', facing: 7 } } });
    expect(edit.maps.mapsById[map.id].tokens.big).toMatchObject({ label: 'Ogre', facing: 7, footprint: big.footprint });
    const offGrid = campaignReducer(edit, { type: 'map/moveToken', payload: { mapId: map.id, tokenId: 'big', position: { col: map.cols - 1, row: 3 }, mode: 'gm' } });
    expect(offGrid).toBe(edit);
    const removed = campaignReducer(edit, { type: 'map/removeToken', payload: { mapId: map.id, tokenId: 'big' } });
    expect(removed.maps.mapsById[map.id].tokens.big).toBeUndefined();
  });

  it('rejects adding footprints whose interior cells cross, even with distinct free anchors', () => {
    const { state, map, token } = tokenFixture();
    token.position = { col: 3, row: 3 };
    token.footprint = defaultFootprint(1, 3);
    const crossing = { ...token, id: 'crossing', position: { col: 2, row: 4 }, footprint: defaultFootprint(3, 1) };
    expect(campaignReducer(state, { type: 'map/addToken', payload: { mapId: map.id, token: crossing } })).toBe(state);
  });

  it.each(['gm', 'combat'] as const)('rejects %s interior-cell collisions before changing movement, log, or history', mode => {
    const { state, map, token, combat } = tokenFixture();
    token.footprint = defaultFootprint(3, 1);
    map.tokens.blocker = { ...token, id: 'blocker', position: { col: 3, row: 3 }, footprint: defaultFootprint(1, 3) };
    const action = { type: 'map/moveToken' as const, payload: { mapId: map.id, participantId: 'one',
      position: { col: 2, row: 4 }, mode, path: [map.grid[4][2]], costYards: 2 } };
    const dispatch = vi.fn(); const record = vi.fn();
    const before = structuredClone(state);
    expect(campaignReducer(state, action)).toBe(state);
    expect(commitTokenMove(state, dispatch, record, action)).toBe(false);
    expect(dispatch).not.toHaveBeenCalled(); expect(record).not.toHaveBeenCalled();
    expect(state).toEqual(before);
    expect(combat.turnDecisions['1_0_one'].movement).toBeUndefined();
    expect(combat.log).toEqual([]);
  });

  it('rejects a footprint resize colliding away from the other token anchor', () => {
    const { state, map, token } = tokenFixture();
    map.tokens.blocker = { ...token, id: 'blocker', position: { col: 4, row: 1 }, footprint: defaultFootprint(1, 3) };
    expect(campaignReducer(state, { type: 'map/updateToken', payload: { mapId: map.id, tokenId: token.id,
      changes: { footprint: defaultFootprint(3, 2), label: 'Rejected resize' } } })).toBe(state);
  });

  it('allows a move overlapping its own prior footprint', () => {
    const { state, map, token } = tokenFixture();
    token.footprint = defaultFootprint(2, 3);
    const moved = campaignReducer(state, { type: 'map/moveToken', payload: { mapId: map.id, tokenId: token.id,
      position: { col: 3, row: 2 }, mode: 'gm' } });
    expect(moved.maps.mapsById[map.id].tokens[token.id].position).toEqual({ col: 3, row: 2 });
  });

  it('allows adjacent footprints on add, resize, and move', () => {
    const { state, map, token } = tokenFixture();
    token.footprint = defaultFootprint(2, 3);
    const adjacent = { ...token, id: 'adjacent', position: { col: 4, row: 2 }, footprint: defaultFootprint(1, 1) };
    const added = campaignReducer(state, { type: 'map/addToken', payload: { mapId: map.id, token: adjacent } });
    expect(added.maps.mapsById[map.id].tokens.adjacent).toEqual(adjacent);
    const resized = campaignReducer(added, { type: 'map/updateToken', payload: { mapId: map.id, tokenId: adjacent.id,
      changes: { footprint: defaultFootprint(2, 3) } } });
    expect(resized.maps.mapsById[map.id].tokens.adjacent.footprint).toHaveLength(6);
    const moved = campaignReducer(resized, { type: 'map/moveToken', payload: { mapId: map.id, tokenId: adjacent.id,
      position: { col: 2, row: 5 }, mode: 'gm' } });
    expect(moved.maps.mapsById[map.id].tokens.adjacent.position).toEqual({ col: 2, row: 5 });
  });

  it('checks occupied cells rather than sparse-footprint bounding boxes', () => {
    const { state, map, token } = tokenFixture();
    token.footprint = [[0, 0], [2, 0], [0, 2], [2, 2]];
    const inside = { ...token, id: 'inside', position: { col: 3, row: 3 }, footprint: defaultFootprint(1, 1) };
    const added = campaignReducer(state, { type: 'map/addToken', payload: { mapId: map.id, token: inside } });
    expect(added.maps.mapsById[map.id].tokens.inside).toEqual(inside);
  });

  it.each([
    { position: { col: NaN, row: 1 } }, { position: { col: 1.5, row: 1 } },
    { facing: 8 }, { facing: Infinity }, { facing: -1 },
    { footprint: [] }, { footprint: [[0, 0], [0, 0]] }, { footprint: [[0.5, 0]] },
    { footprint: [[0]] }, { label: null }, { partyCharacterId: 'pc', libraryId: 'npc' },
  ])('rejects malformed token %j', changes => {
    const { state, map, token } = tokenFixture();
    const action = { type: 'map/addToken', payload: { mapId: map.id, token: { ...token, id: 'bad', ...changes } } } as unknown as CampaignAction;
    expect(campaignReducer(state, action)).toBe(state);
  });

  it('commits one move with bookkeeping and restores both on history undo/redo, even with reveal state', () => {
    const { state, map, combat } = tokenFixture();
    const dispatch = vi.fn();
    const record = vi.fn();
    const action = { type: 'map/moveToken', payload: { mapId: map.id, participantId: 'one', position: { col: 5, row: 4 }, mode: 'combat', path: [map.grid[4][5]], costYards: 1 } } as const;
    expect(commitTokenMove(state, dispatch, record, { ...action, payload: { ...action.payload, path: [...action.payload.path] } })).toBe(true);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledTimes(1);
    const moved = campaignReducer(state, dispatch.mock.calls[0][0]);
    expect(moved.maps.mapsById[map.id].tokens.placed.position).toEqual({ col: 5, row: 4 });
    expect(moved.combat.activeSession?.turnDecisions['1_0_one'].movement?.costYards).toBe(1);
    const reveal = createInitialRevealState(combat.id, combat.participants);
    const history = addAction(createHistoryState(), record.mock.calls[0][0], combat, reveal);
    const undone = undo(combat, history, moved.combat.activeSession, reveal);
    const restored = campaignReducer(moved, { type: 'map/restoreCombatMove', payload: { combat: undone.newCombatState,
      tokenRef: combat.participants[0].tokenRef, tileId: map.grid[2][2] } });
    expect(restored.maps.mapsById[map.id].tokens.placed.position).toEqual({ col: 2, row: 2 });
    expect(restored.combat.activeSession?.turnDecisions['1_0_one'].movement).toBeUndefined();
    const redone = redo(combat, undone.newHistory, restored.combat.activeSession, reveal);
    const again = campaignReducer(restored, { type: 'map/restoreCombatMove', payload: { combat: redone.newCombatState,
      tokenRef: combat.participants[0].tokenRef, tileId: map.grid[4][5] } });
    expect(again.maps.mapsById[map.id].tokens.placed.position).toEqual({ col: 5, row: 4 });
    expect(again.combat.activeSession?.turnDecisions['1_0_one'].movement).toBeDefined();
  });

  it('does not dispatch unchanged or malformed drops', () => {
    const { state, map } = tokenFixture();
    const dispatch = vi.fn(); const record = vi.fn();
    for (const position of [{ col: 2, row: 2 }, { col: NaN, row: 3 }, { col: 999, row: 3 }]) {
      expect(commitTokenMove(state, dispatch, record, { type: 'map/moveToken', payload: { mapId: map.id, participantId: 'one', position, mode: 'gm' } })).toBe(false);
    }
    expect(dispatch).not.toHaveBeenCalled(); expect(record).not.toHaveBeenCalled();
  });

  it('creates independent linked NPCs, attaches once, and leaves tokens after combat/participant removal', () => {
    const { state, map, token, combat } = tokenFixture();
    map.tokens.second = { ...token, id: 'second', position: { col: 5, row: 5 } };
    map.tokens.decor = { ...token, id: 'decor', libraryId: undefined };
    const participants = participantsFromMap(state, map);
    expect(participants).toHaveLength(2);
    expect(new Set(participants.map(p => p.instanceId)).size).toBe(2);
    expect(participants.map(p => p.tokenRef?.tokenId)).toEqual(['placed', 'second']);
    let next = campaignReducer(state, { type: 'setCombatActive', payload: { ...combat, id: 'second-fight', participants } });
    next = campaignReducer(next, { type: 'setCombatActive', payload: { ...combat, participants: [] } });
    next = campaignReducer(next, { type: 'setCombatHistory', payload: [combat] });
    next = campaignReducer(next, { type: 'setCombatActive', payload: null });
    expect(Object.keys(next.maps.mapsById[map.id].tokens)).toHaveLength(3);
  });

  it('attaches existing matching instances independently in ordinary encounter setup', () => {
    const { state, map, token, combat, participant } = tokenFixture();
    map.tokens.second = { ...token, id: 'second' };
    const participants = ['a', 'b', 'c'].map(instanceId => ({ ...participant, instanceId, tokenRef: undefined }));
    const next = campaignReducer(state, { type: 'setCombatActive', payload: { ...combat, id: 'next', participants } });
    expect(next.combat.activeSession?.participants.map(p => p.tokenRef?.tokenId)).toEqual(['placed', 'second', undefined]);
    expect(Object.keys(next.maps.mapsById[map.id].tokens)).toHaveLength(2);
  });

  it('safely resolves deleted tokens/maps and detaches combat-only foreign ids', () => {
    const { state, map, participant, combat } = tokenFixture();
    const removed = campaignReducer(state, { type: 'map/removeToken', payload: { mapId: map.id, tokenId: 'placed' } });
    expect(resolveParticipantToken(removed.maps, participant)).toBeUndefined();
    const deleted = campaignReducer(state, { type: 'map/deleteMap', payload: map.id });
    expect(resolveParticipantToken(deleted.maps, participant)).toBeUndefined();
    const imported = detachImportedCombat(combat);
    expect(imported.mapId).toBeUndefined(); expect(imported.participants[0].tokenRef).toBeUndefined();
    const loaded = campaignReducer(state, { type: 'setCombatActive', payload: imported });
    expect(loaded.maps.mapsById[map.id].tokens.placed).toMatchObject(map.tokens.placed);
    expect(imported.participants[0].legacySpatial?.tokenRef).toEqual(participant.tokenRef);
  });

  it('translates anchors and combat movement when terrain prepends rows/columns', () => {
    const { state, map } = tokenFixture();
    const moved = campaignReducer(state, { type: 'map/moveToken', payload: { mapId: map.id, participantId: 'one', position: { col: 3, row: 3 }, mode: 'combat', path: [map.grid[3][3]], costYards: 1 } });
    const expanded = campaignReducer(moved, { type: 'map/setTileTerrain', payload: { mapId: map.id, tileId: map.grid[0][0], terrainId: 'terrain-plains' } });
    const live = expanded.maps.mapsById[map.id];
    const pos = live.tokens.placed.position;
    expect(pos.col).toBeGreaterThan(3); expect(pos.row).toBeGreaterThan(3);
    expect(expanded.combat.activeSession?.turnDecisions['1_0_one'].movement?.toPosition).toEqual(pos);
    expect(live.grid[pos.row][pos.col]).toBe(map.grid[3][3]);
    expect(expandMap(map, { top: 2, left: 3, right: 0, bottom: 0 }).tokens.placed.position).toEqual({ col: 5, row: 4 });
  });

  it('keeps fully hidden combat NPC tokens off both player map projections', () => {
    const { state, map } = tokenFixture();
    expect(buildTacticalTokens(state, map.id, false)).toEqual([]);
    expect(buildTacticalTokens(state, map.id, true)).toHaveLength(1);
    state.combat.revealState = createInitialRevealState('fight', state.combat.activeSession?.participants ?? []);
    state.combat.revealState.byInstanceId.one.name = 'full';
    expect(buildTacticalTokens(state, map.id, false)[0].label).toBe('Guard');
  });

  it.each(['end', 'remove'] as const)('retains hidden NPC visibility when combat participants depart: %s', mode => {
    const { state, map, combat } = tokenFixture();
    const next = campaignReducer(state, { type: 'setCombatActive', payload: mode === 'end' ? null : { ...combat, participants: [] } });
    expect(buildTacticalTokens(next, map.id, false)).toEqual([]);
    expect(buildTacticalTokens(next, map.id, true)).toHaveLength(1);
    expect(next.maps.mapsById[map.id].tokens.placed.playerDisplay?.visible).toBe(false);
  });

  it('retains the filtered player label after combat ends', () => {
    const { state, map } = tokenFixture();
    state.combat.revealState = createInitialRevealState('fight', state.combat.activeSession?.participants ?? []);
    state.combat.revealState.byInstanceId.one.hp = { mode: 'exact' };
    const before = buildTacticalTokens(state, map.id, false)[0].label;
    expect(before).not.toBe('Guard');
    const next = campaignReducer(state, { type: 'setCombatActive', payload: null });
    expect(buildTacticalTokens(next, map.id, false)[0].label).toBe(before);
  });

  it('reattaches participants on map change and clears movement while preserving the old token', () => {
    const { state, map, token, combat } = tokenFixture();
    const destination = createNewMap({ name: 'Other room', scale: '1yd', startTerrainId: 'terrain-plains' });
    destination.tokens.other = { ...token, id: 'other', position: { col: 4, row: 4 } };
    state.maps.mapsById[destination.id] = destination;
    const moved = campaignReducer(state, { type: 'map/moveToken', payload: { mapId: map.id, participantId: 'one', position: { col: 3, row: 3 }, mode: 'combat', path: [map.grid[3][3]], costYards: 1 } });
    const next = campaignReducer(moved, { type: 'setCombatActive', payload: { ...moved.combat.activeSession!, mapId: destination.id } });
    expect(next.combat.activeSession?.participants[0].tokenRef).toEqual({ mapId: destination.id, tokenId: 'other' });
    expect(next.combat.activeSession?.turnDecisions['1_0_one'].movement).toBeUndefined();
    expect(next.maps.mapsById[map.id].tokens.placed.position).toEqual({ col: 3, row: 3 });
    const unmapped = campaignReducer(next, { type: 'setCombatActive', payload: { ...combat, mapId: undefined } });
    expect(unmapped.combat.activeSession?.participants[0].tokenRef).toBeUndefined();
  });
});

function legacyFixture() {
  const { state, map, combat, participant } = tokenFixture();
  const { tokens: _tokens, ...legacyMap } = map;
  const { tokenRef: _ref, ...unplaced } = participant;
  const legacy = { ...state, maps: { ...state.maps, mapsById: { [map.id]: legacyMap } }, combat: { ...state.combat,
    activeSession: { ...combat, participants: [{ ...unplaced, position: { q: 2, r: 2 }, facing: 3, extension: 'keep' },
      { ...unplaced, instanceId: 'two', position: { q: 4, r: 3 } }], turnDecisions: { '1_0_one': { movement: {
        fromPosition: { q: 1, r: 2 }, toPosition: { q: 2, r: 2 }, path: [], costYards: 1,
      } } } },
  }, entities: { ...state.entities, combatHistory: [{ ...combat, participants: [{ ...unplaced, position: { q: 8, r: 8 } }] }] } } as unknown as CampaignState;
  return { legacy, map };
}

describe('map token migration entry paths', () => {
  it('preserves old overlaps during hydration and lets the selected token move apart', () => {
    const { state, map, token } = tokenFixture();
    map.tokens.second = { ...token, id: 'second' };
    const hydrated = hydrateCampaignState(JSON.parse(JSON.stringify(serializeCampaignState(state))));
    const live = hydrated.maps.mapsById[map.id];
    expect(live.tokens).toEqual(map.tokens);
    expect(tokenAtCell(live, 2, 2, 'second')?.id).toBe('second');
    const moved = campaignReducer(hydrated, { type: 'map/moveToken', payload: { mapId: map.id, tokenId: 'second',
      position: { col: 3, row: 2 }, mode: 'gm' } });
    expect(moved.maps.mapsById[map.id].tokens.second.position).toEqual({ col: 3, row: 2 });
    expect(moved.maps.mapsById[map.id].tokens.placed.position).toEqual({ col: 2, row: 2 });
  });

  it('rewrites raw active combat with deterministic ids, keeps extensions and archives isolated, and is idempotent', () => {
    const { legacy, map } = legacyFixture();
    const next = migrateTo1_6_5(legacy as unknown as Record<string, unknown>) as unknown as CampaignState;
    expect(Object.values(next.maps.mapsById[map.id].tokens)).toHaveLength(2);
    const p = next.combat.activeSession?.participants[0];
    expect(p).not.toHaveProperty('position'); expect(p).toHaveProperty('extension', 'keep');
    expect(resolveParticipantToken(next.maps, p)?.facing).toBe(3);
    expect(next.entities.combatHistory[0].participants[0].legacySpatial?.position).toEqual({ col: 8, row: 8 });
    expect(next.combat.activeSession?.turnDecisions['1_0_one'].movement?.fromPosition).toEqual({ col: 1, row: 2 });
    expect(ensureMapTokens(next)).toBe(next);
    expect(migrateTo1_6_5(next as unknown as Record<string, unknown>)).toBe(next);
    expect(migrateData(legacy as unknown as Record<string, unknown>, '1.6.4', '1.6.5')).toMatchObject({ schemaVersion: '1.6.5' });
  });

  it('hydrates browser JSON and checkpoint snapshots; restoring cannot reintroduce participant positions', () => {
    const { legacy, map } = legacyFixture();
    const checkpointed = campaignReducer(legacy, { type: 'createCheckpoint', payload: 'Before' });
    const payload: CampaignDTO = JSON.parse(JSON.stringify(serializeCampaignState(checkpointed)));
    const next = hydrateCampaignState(payload);
    expect(Object.keys(next.maps.mapsById[map.id].tokens)).toHaveLength(2);
    const checkpoint = next.checkpoints.entries[0];
    expect(Object.keys(checkpoint.snapshot.maps.mapsById[map.id].tokens)).toHaveLength(2);
    const restored = campaignReducer(next, { type: 'restoreCheckpoint', payload: checkpoint.id });
    expect(restored.combat.activeSession?.participants[0].tokenRef).toBeDefined();
    expect(restored.combat.activeSession?.participants[0]).not.toHaveProperty('position');
  });

  it.each([undefined, { q: NaN, r: 0 }, { q: 100, r: 100 }, { q: 1.1, r: 0 }])('isolates malformed legacy coordinates %j', position => {
    const { legacy, map } = legacyFixture();
    const combat = legacy.combat.activeSession;
    if (!combat) throw new Error('fixture');
    const input = { ...legacy, combat: { ...legacy.combat, activeSession: { ...combat, participants: [{ ...combat.participants[0], position }] } } };
    const next = ensureMapTokens(input);
    expect(next.maps.mapsById[map.id].tokens).toEqual({});
    expect(next.combat.activeSession?.participants[0].legacySpatial).toBeDefined();
  });

  it('preserves valid live tokens over legacy positions and never invents absent maps', () => {
    const { state, map, token, participant, combat } = tokenFixture();
    const input = { ...state, combat: { ...state.combat, activeSession: { ...combat, participants: [{ ...participant, position: { q: 9, r: 9 } }] } } };
    const next = ensureMapTokens(input);
    expect(next.maps.mapsById[map.id].tokens.placed).toBe(token);
    expect(next.maps.mapsById[map.id].tokens.placed.position).toEqual({ col: 2, row: 2 });
    const missing = ensureMapTokens({ ...input, maps: { ...state.maps, mapsById: {} } });
    expect(missing.maps.mapsById).toEqual({});
    expect(missing.combat.activeSession?.participants[0].tokenRef).toBeUndefined();
    expect(missing.combat.activeSession?.participants[0].legacySpatial).toBeDefined();
  });

  it('initializes overland collections and quarantines malformed new-format tokens without losing data', () => {
    const { legacy, map } = legacyFixture();
    const input = { ...legacy, maps: { ...legacy.maps, mapsById: { [map.id]: { ...map, scale: '50mi', tokens: { bad: { secretExtension: 'keep' } } } } } } as unknown as CampaignState;
    const next = ensureMapTokens(input);
    expect(next.maps.mapsById[map.id]).toHaveProperty('legacyTokens.bad.secretExtension', 'keep');
    expect(next.maps.mapsById[map.id].tokens.bad).toBeUndefined();
    expect(ensureMapTokens(next)).toBe(next);
  });

  it.each(['unlocked', 'locked'])('migrates full %s JSON imports and original-version GM unlock', async kind => {
    const { legacy, map } = legacyFixture();
    const checkpointed = campaignReducer(legacy, { type: 'createCheckpoint', payload: 'Legacy checkpoint' });
    const exported = kind === 'locked' ? await exportLocked(checkpointed, 'secret') : await exportUnlocked(checkpointed);
    exported.schemaVersion = '1.6.4';
    const imported = await importFile(JSON.stringify(exported));
    if (!imported.ok) throw new Error(imported.error);
    let gm: unknown = imported.data.gm;
    if (kind === 'locked') {
      expect(imported.data.originalSchemaVersion).toBe('1.6.4');
      const result = await unlockGMData(imported.data, 'secret');
      if (!result.ok) throw new Error(result.error);
      gm = result.gmData;
    }
    const merged = mergeGM(imported.data.public, gm) as unknown as CampaignDTO;
    expect(Object.values(merged.maps.mapsById[map.id].tokens)).toHaveLength(2);
    expect(Object.values(merged.checkpoints.entries[0].snapshot.maps.mapsById[map.id].tokens)).toHaveLength(2);
    const next = hydrateCampaignState(merged);
    expect(Object.values(next.maps.mapsById[map.id].tokens)).toHaveLength(2);
    expect(resolveParticipantToken(next.maps, next.combat.activeSession?.participants[0])?.position).toEqual({ col: 2, row: 2 });
  });

  it('rejects invalid new-format token data on full import before state merging', async () => {
    const { state, map } = tokenFixture();
    const exported = await exportUnlocked(state);
    const gm = exported.gm as SerializedCampaignState;
    gm.maps.mapsById[map.id].tokens.placed.facing = 10;
    const imported = await importFile(JSON.stringify(exported));
    expect(imported.ok).toBe(false);
  });

  it.each(['12mi', '50mi', '457mi'])('initializes absent token collections on %s maps', scale => {
    const { state, map } = tokenFixture();
    const { tokens: _tokens, ...rest } = map;
    const input = { ...state, combat: { ...state.combat, activeSession: null },
      maps: { ...state.maps, mapsById: { [map.id]: { ...rest, scale } } } } as unknown as CampaignState;
    expect(ensureMapTokens(input).maps.mapsById[map.id].tokens).toEqual({});
  });

  it('quarantines null maps during normal hydration and retains the unresolved spatial record', () => {
    const { legacy, map } = legacyFixture();
    const input = { ...legacy, maps: { ...legacy.maps, mapsById: { [map.id]: null } } } as unknown as CampaignDTO;
    const hydrated = hydrateCampaignState(input);
    expect(hydrated.maps.mapsById[map.id]).toBeUndefined();
    expect(hydrated.maps).toHaveProperty(`legacyMaps.${map.id}`, null);
    expect(hydrated.combat.activeSession?.participants[0].legacySpatial?.position).toEqual({ col: 2, row: 2 });
  });

  it('normalizes combat-only imports and old flat active/history storage', () => {
    const { legacy } = legacyFixture();
    const combat = legacy.combat.activeSession;
    if (!combat) throw new Error('fixture');
    const imported = detachImportedCombat(combat);
    expect(imported.turnDecisions['1_0_one'].movement?.fromPosition).toEqual({ col: 1, row: 2 });
    expect(imported.participants[0].tokenRef).toBeUndefined();
    const flat = migrateTo1_6_5({ maps: legacy.maps, combatActive: combat, combatHistory: [combat], combatActiveHistory: { checkpoints: [{ combatState: combat }] } });
    const active = flat.combatActive as CombatState;
    const history = flat.combatHistory as CombatState[];
    expect(active.participants[0].tokenRef).toBeDefined();
    expect(history[0].participants[0]).not.toHaveProperty('position');
    expect(flat.combatActiveHistory).toHaveProperty('checkpoints.0.combatState.participants.0.legacySpatial.position', { col: 2, row: 2 });
  });
});
