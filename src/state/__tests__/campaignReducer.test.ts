import { describe, expect, it } from 'vitest';
import { campaignReducer, createCampaignState, initialCampaignState, logEvent } from '../campaignReducer';
import { hydrateCampaignState } from '../../persistence/campaignStorage';
import { DEFAULT_STUDY_CONFIG } from '../../constants';
import { selectContactByName, selectContacts, selectStudyConfig, selectStudyProjects, selectStudyProjectsForCharacter } from '../selectors';
import type { ContactEntry, StudyProject } from '../../types/campaign';
import type { MapModel } from '../../types/map';

describe('campaignReducer', () => {
  const studyProject: StudyProject = {
    id: 'study-1', characterId: 'char-1', skillName: 'Research', attribute: 'IQ', difficulty: 'A',
    accumulatedHours: 198, pointsAwarded: 0, createdAt: 1, updatedAt: 1,
  };
  const contact: ContactEntry = { id: 'contact-1', name: 'Dockworkers Guild', kind: 'faction', modifier: 3, notes: 'Harbor allies', history: [], createdAt: 1, updatedAt: 1 };

  it('upserts, selects by normalized name, and removes contacts', () => {
    const added = campaignReducer(createCampaignState(), { type: 'upsertContact', payload: contact });
    expect(selectContacts(added)[contact.id]).toEqual(contact);
    expect(selectContactByName(added, '  dockworkers guild ')).toEqual(contact);
    const removed = campaignReducer(added, { type: 'removeContact', payload: contact.id });
    expect(selectContacts(removed)).toEqual({});
  });

  it('clamps positive shifts and records the post-clamp delta, cause, and day', () => {
    const added = campaignReducer(createCampaignState(), { type: 'upsertContact', payload: contact });
    const shifted = campaignReducer(added, { type: 'shiftContactModifier', payload: { id: contact.id, delta: 2, cause: 'Diplomacy success by Rina', dayKey: 7 } });
    expect(shifted.entities.contacts?.[contact.id]?.modifier).toBe(4);
    expect(shifted.entities.contacts?.[contact.id]?.history[0]).toMatchObject({ delta: 1, newModifier: 4, cause: 'Diplomacy success by Rina', dayKey: 7 });
  });

  it('clamps negative shifts at -4', () => {
    const added = campaignReducer(createCampaignState(), { type: 'upsertContact', payload: { ...contact, modifier: -3 } });
    const shifted = campaignReducer(added, { type: 'shiftContactModifier', payload: { id: contact.id, delta: -2, cause: 'Critical failure', dayKey: 2 } });
    expect(shifted.entities.contacts?.[contact.id]?.history[0]).toMatchObject({ delta: -1, newModifier: -4 });
  });

  it('appends a zero-delta history line at the cap', () => {
    const added = campaignReducer(createCampaignState(), { type: 'upsertContact', payload: { ...contact, modifier: 4 } });
    const shifted = campaignReducer(added, { type: 'shiftContactModifier', payload: { id: contact.id, delta: 1, cause: 'Carousing success', dayKey: 4 } });
    expect(shifted.entities.contacts?.[contact.id]?.history).toHaveLength(1);
    expect(shifted.entities.contacts?.[contact.id]?.history[0]).toMatchObject({ delta: 0, newModifier: 4, cause: 'Carousing success', dayKey: 4 });
  });

  it('setActiveModule updates state', () => {
    const nextState = campaignReducer(initialCampaignState, {
      type: 'setActiveModule',
      payload: 'rules'
    });

    expect(nextState.ui.activeModule).toBe('rules');
  });

  it('sets currency configuration', () => {
    const config = { currencies: [{ key: 'sp', name: 'Silver' }], primaryKey: 'sp' };
    const next = campaignReducer(createCampaignState(), { type: 'setCurrencyConfig', payload: config });
    expect(next.entities.currencyConfig).toEqual(config);
  });

  it('upserts and removes price book entries', () => {
    const state = createCampaignState();
    const first = { key: 'material:iron', name: 'Iron', kind: 'material' as const, price: 3, updatedAt: 1 };
    const second = { ...first, price: 5, updatedAt: 2 };
    const added = campaignReducer(state, { type: 'setPriceBookEntry', payload: first });
    const updated = campaignReducer(added, { type: 'setPriceBookEntry', payload: second });
    expect(updated.entities.priceBook?.[first.key]).toEqual(second);
    const removed = campaignReducer(updated, { type: 'removePriceBookEntry', payload: first.key });
    expect(removed.entities.priceBook).toEqual({});
  });

  it('upserts, selects, and removes study projects', () => {
    const added = campaignReducer(createCampaignState(), { type: 'upsertStudyProject', payload: studyProject });
    expect(selectStudyProjects(added)[studyProject.id]).toEqual(studyProject);
    expect(selectStudyProjectsForCharacter(added, 'char-1')).toEqual([studyProject]);
    const removed = campaignReducer(added, { type: 'removeStudyProject', payload: studyProject.id });
    expect(selectStudyProjects(removed)).toEqual({});
  });

  it('credits study hours and stamps updatedAt', () => {
    const added = campaignReducer(createCampaignState(), { type: 'upsertStudyProject', payload: studyProject });
    const credited = campaignReducer(added, { type: 'creditStudyHours', payload: { projectId: studyProject.id, hours: 4 } });
    expect(credited.entities.studyProjects?.[studyProject.id]?.accumulatedHours).toBe(202);
    expect(credited.entities.studyProjects?.[studyProject.id]?.updatedAt).toBeGreaterThan(1);
  });

  it('awards a point with rollover at the configured threshold', () => {
    let state = campaignReducer(createCampaignState(), { type: 'setStudyConfig', payload: { hoursPerPoint: 200 } });
    state = campaignReducer(state, { type: 'upsertStudyProject', payload: { ...studyProject, accumulatedHours: 205 } });
    const awarded = campaignReducer(state, { type: 'awardStudyPoint', payload: studyProject.id });
    expect(awarded.entities.studyProjects?.[studyProject.id]).toMatchObject({ accumulatedHours: 5, pointsAwarded: 1 });
  });

  it('does not award below the threshold', () => {
    const added = campaignReducer(createCampaignState(), { type: 'upsertStudyProject', payload: studyProject });
    const awarded = campaignReducer(added, { type: 'awardStudyPoint', payload: studyProject.id });
    expect(awarded.entities.studyProjects?.[studyProject.id]).toEqual(studyProject);
  });

  it('sets study config and selects the default fallback', () => {
    const state = createCampaignState();
    expect(selectStudyConfig(state)).toEqual(DEFAULT_STUDY_CONFIG);
    const configured = campaignReducer(state, { type: 'setStudyConfig', payload: { hoursPerPoint: 100 } });
    expect(selectStudyConfig(configured)).toEqual({ hoursPerPoint: 100 });
  });

  it('stores and clears a pending intent', () => {
    const withIntent = campaignReducer(initialCampaignState, {
      type: 'setPendingIntent',
      payload: { kind: 'cook', foodIds: ['trout', 'berries'] },
    });

    expect(withIntent.ui.pendingIntent).toEqual({
      kind: 'cook',
      foodIds: ['trout', 'berries'],
    });

    const cleared = campaignReducer(withIntent, { type: 'clearPendingIntent' });
    expect(cleared.ui.pendingIntent).toBeNull();
  });

  it('drops a persisted pending intent during hydration', () => {
    const persisted = createCampaignState();
    persisted.ui.pendingIntent = { kind: 'craft' };

    expect(hydrateCampaignState(persisted).ui.pendingIntent).toBeNull();
  });

  it('toggleGmMode flips boolean', () => {
    const nextState = campaignReducer(initialCampaignState, { type: 'toggleGmMode' });

    expect(nextState.ui.gmModeEnabled).toBe(true);
  });

  it('selectCharacter sets id', () => {
    const nextState = campaignReducer(initialCampaignState, {
      type: 'selectCharacter',
      payload: 'char-123'
    });

    expect(nextState.ui.selectedCharacterId).toBe('char-123');
  });

  it('advanceTime increments slot', () => {
    const state = createCampaignState();
    const nextState = campaignReducer(state, { type: 'advanceTime' });

    expect(nextState.time.slot).toBe(1);
    expect(nextState.time.day).toBe(1);
    // At least 1 log for time advance, may have additional weather log
    expect(nextState.logs.entries.length).toBeGreaterThanOrEqual(1);
    expect(nextState.logs.entries.some(e => e.type === 'time.advance')).toBe(true);
  });

  it('advanceTime rolls over and increments day', () => {
    const state = createCampaignState();
    state.time.slot = state.time.slotsPerDay - 1;

    const nextState = campaignReducer(state, { type: 'advanceTime' });

    expect(nextState.time.slot).toBe(0);
    expect(nextState.time.day).toBe(2);
  });

  it('advanceTime is blocked by paused sessions', () => {
    const state = createCampaignState();
    state.activities.pausedSessionIds = ['session-1'];

    const nextState = campaignReducer(state, { type: 'advanceTime' });

    expect(nextState.time.slot).toBe(0);
    expect(nextState.ui.blockingError?.system).toBe('time');
  });

  it('clearing paused sessions allows advanceTime', () => {
    const state = createCampaignState();
    state.activities.pausedSessionIds = ['session-1'];

    const blockedState = campaignReducer(state, { type: 'advanceTime' });
    const clearedState = campaignReducer(blockedState, { type: 'setPausedSessionIds', payload: [] });
    const nextState = campaignReducer(clearedState, { type: 'advanceTime' });

    expect(nextState.time.slot).toBe(1);
    expect(nextState.ui.blockingError).toBeNull();
  });

  it('stamps appended log entries with the current game day and slot', () => {
    const state = createCampaignState();
    state.time.day = 7;
    state.time.slot = 3;

    const nextState = campaignReducer(state, {
      type: 'addLogEntry',
      payload: logEvent('inventory.item_added', 'player', { message: 'Added Rope' })
    });

    expect(nextState.logs.entries[0].day).toBe(7);
    expect(nextState.logs.entries[0].slot).toBe(3);
  });

  it('preserves pre-stamped day and slot values on appended log entries', () => {
    const state = createCampaignState();
    state.time.day = 7;
    state.time.slot = 3;
    const entry = {
      ...logEvent('inventory.item_added', 'player', { message: 'Added Rope' }),
      day: 2,
      slot: 1,
    };

    const nextState = campaignReducer(state, { type: 'addLogEntry', payload: entry });

    expect(nextState.logs.entries[0].day).toBe(2);
    expect(nextState.logs.entries[0].slot).toBe(1);
  });

  it('caps appended logs at 2,000 entries and drops the oldest entry', () => {
    const state = createCampaignState();
    state.logs.entries = Array.from({ length: 2000 }, (_, index) => ({
      ...logEvent('inventory.item_added', 'player', { message: `Entry ${index}` }),
      id: `entry-${index}`,
    }));

    const nextState = campaignReducer(state, {
      type: 'addLogEntry',
      payload: { ...logEvent('inventory.item_added', 'player', { message: 'Newest' }), id: 'newest' }
    });

    expect(nextState.logs.entries).toHaveLength(2000);
    expect(nextState.logs.entries[0].id).toBe('newest');
    expect(nextState.logs.entries[nextState.logs.entries.length - 1]?.id).toBe('entry-1998');
    expect(nextState.logs.entries.some(entry => entry.id === 'entry-1999')).toBe(false);
  });

  it('caps wholesale log replacement at 2,000 entries without stamping legacy entries', () => {
    const state = createCampaignState();
    const entries = Array.from({ length: 2001 }, (_, index) => ({
      ...logEvent('inventory.item_added', 'player', { message: `Entry ${index}` }),
      id: `entry-${index}`,
    }));

    const nextState = campaignReducer(state, { type: 'setLogsEntries', payload: entries });

    expect(nextState.logs.entries).toHaveLength(2000);
    expect(nextState.logs.entries[0].id).toBe('entry-0');
    expect(nextState.logs.entries[nextState.logs.entries.length - 1]?.id).toBe('entry-1999');
    expect(nextState.logs.entries[0].day).toBeUndefined();
    expect(nextState.logs.entries[0].slot).toBeUndefined();
  });

  it('createCheckpoint adds to ring and respects max size', () => {
    const state = createCampaignState();
    state.checkpoints.maxSize = 2;

    const first = campaignReducer(state, { type: 'createCheckpoint', payload: 'First' });
    const second = campaignReducer(first, { type: 'createCheckpoint', payload: 'Second' });
    const third = campaignReducer(second, { type: 'createCheckpoint', payload: 'Third' });

    expect(third.checkpoints.entries).toHaveLength(2);
    expect(third.checkpoints.entries[0].label).toBe('Third');
    expect(third.checkpoints.entries[1].label).toBe('Second');
  });

  it('restoreCheckpoint rewinds time state', () => {
    const state = createCampaignState();
    const withCheckpoint = campaignReducer(state, { type: 'createCheckpoint', payload: 'Before time' });
    const checkpointId = withCheckpoint.checkpoints.entries[0].id;
    const advanced = campaignReducer(withCheckpoint, { type: 'advanceTime' });

    const restored = campaignReducer(advanced, { type: 'restoreCheckpoint', payload: checkpointId });

    expect(restored.time.slot).toBe(0);
    expect(restored.time.day).toBe(1);
  });

  it('restoreCheckpoint with malformed (non-serializable) snapshot leaves state unchanged', () => {
    const state = createCampaignState();
    const circular: Record<string, unknown> = { foo: 'bar' };
    circular.self = circular;
    state.checkpoints.entries.push({
      id: 'bad-cp',
      label: 'bad',
      createdAt: 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      snapshot: circular as any
    });
    const dayBefore = state.time.day;
    const slotBefore = state.time.slot;
    const logsBefore = state.logs.entries.length;

    const result = campaignReducer(state, { type: 'restoreCheckpoint', payload: 'bad-cp' });

    expect(result.time.day).toBe(dayBefore);
    expect(result.time.slot).toBe(slotBefore);
    expect(result.logs.entries.length).toBe(logsBefore);
    expect(result.checkpoints.entries).toHaveLength(1);
  });

  it('checkpoint round-trip preserves map and combat reveal Sets', () => {
    const makeMap = (): MapModel => ({
      id: 'map-1',
      name: 'Test Map',
      climate: 'temperate',
      visionMode: 'lineOfSight',
      scaleMilesPerTile: 12,
      rows: 1,
      cols: 1,
      grid: [['tile-1']],
      tilesById: {
        'tile-1': { id: 'tile-1', terrainId: null, markerIds: [], linkIds: [] }
      },
      terrainById: {},
      markersById: {},
      linksById: {},
      revealedTileIds: new Set(['tile-1', 'tile-2']),
      lastSelectedTerrainId: '',
      lastPlacedTerrainId: ''
    });
    const state = createCampaignState();
    state.maps = { ...state.maps, mapsById: { 'map-1': makeMap() } };
    state.combat.reveal.revealedTargets.add('target-a');
    state.combat.reveal.revealedTargets.add('target-b');
    state.combat.reveal.revealedHP.add('target-a');

    const withCheckpoint = campaignReducer(state, { type: 'createCheckpoint', payload: 'Before wipe' });
    const checkpointId = withCheckpoint.checkpoints.entries[0].id;

    // Snapshots store Sets as arrays so they survive campaign save/load too.
    const snapshot = withCheckpoint.checkpoints.entries[0].snapshot;
    expect(Array.isArray(snapshot.combat.reveal.revealedTargets)).toBe(true);
    expect(Array.isArray(snapshot.maps.mapsById['map-1'].revealedTileIds)).toBe(true);

    const diverged = campaignReducer(withCheckpoint, {
      type: 'registerCombatDamage',
      payload: { targetId: 'target-c', remainingHp: 5 }
    });
    const restored = campaignReducer(diverged, { type: 'restoreCheckpoint', payload: checkpointId });

    expect(restored.combat.reveal.revealedTargets).toBeInstanceOf(Set);
    expect(restored.combat.reveal.revealedTargets.has('target-a')).toBe(true);
    expect(restored.combat.reveal.revealedTargets.has('target-b')).toBe(true);
    expect(restored.combat.reveal.revealedTargets.has('target-c')).toBe(false);
    expect(restored.combat.reveal.revealedHP).toBeInstanceOf(Set);
    expect(restored.combat.reveal.revealedHP.has('target-a')).toBe(true);
    const map = restored.maps.mapsById['map-1'];
    expect(map.revealedTileIds).toBeInstanceOf(Set);
    expect(map.revealedTileIds.has('tile-1')).toBe(true);
    expect(map.revealedTileIds.has('tile-2')).toBe(true);
    expect(map.revealedTileIds.size).toBe(2);

    // The restored Sets must be mutable through subsequent actions.
    const afterRestore = campaignReducer(restored, {
      type: 'registerCombatDamage',
      payload: { targetId: 'target-d', remainingHp: 3 }
    });
    expect(afterRestore.combat.reveal.revealedTargets.has('target-d')).toBe(true);
  });

  it('restoreCheckpoint tolerates pre-fix snapshots whose Sets were corrupted to {}', () => {
    const state = createCampaignState();
    state.maps = { ...state.maps, mapsById: { 'map-1': {
      id: 'map-1',
      name: 'Test Map',
      climate: 'temperate',
      visionMode: 'lineOfSight',
      scaleMilesPerTile: 12,
      rows: 1,
      cols: 1,
      grid: [['tile-1']],
      tilesById: {
        'tile-1': { id: 'tile-1', terrainId: null, markerIds: [], linkIds: [] }
      },
      terrainById: {},
      markersById: {},
      linksById: {},
      revealedTileIds: new Set(['tile-1']),
      lastSelectedTerrainId: '',
      lastPlacedTerrainId: ''
    } } };
    // Snapshots written before Sets were serialized went through a plain JSON
    // round-trip, which turned every Set into {}.
    const { checkpoints: _checkpoints, ...rest } = state;
    const legacySnapshot = JSON.parse(JSON.stringify(rest));
    expect(legacySnapshot.combat.reveal.revealedTargets).toEqual({});
    state.checkpoints.entries.push({
      id: 'legacy-cp',
      label: 'Legacy',
      createdAt: 0,
      snapshot: legacySnapshot
    });

    const restored = campaignReducer(state, { type: 'restoreCheckpoint', payload: 'legacy-cp' });

    expect(restored.combat.reveal.revealedTargets).toBeInstanceOf(Set);
    expect(restored.combat.reveal.revealedTargets.size).toBe(0);
    expect(restored.combat.reveal.revealedHP).toBeInstanceOf(Set);
    expect(restored.maps.mapsById['map-1'].revealedTileIds).toBeInstanceOf(Set);
    expect(restored.maps.mapsById['map-1'].revealedTileIds.size).toBe(0);
  });

  it('restoreCheckpoint appends player-visible rollback log', () => {
    const state = createCampaignState();
    const withCheckpoint = campaignReducer(state, { type: 'createCheckpoint', payload: 'Before rollback' });
    const checkpointId = withCheckpoint.checkpoints.entries[0].id;
    const advanced = campaignReducer(withCheckpoint, { type: 'advanceTime' });

    const restored = campaignReducer(advanced, { type: 'restoreCheckpoint', payload: checkpointId });

    expect(restored.logs.entries[0].visibility).toBe('player');
    expect(restored.logs.entries[0].payload.message).toContain('Rollback occurred');
  });

  it('importCampaignState replaces time and creates checkpoint', () => {
    const state = createCampaignState();
    const importedState = createCampaignState();
    importedState.time.day = 3;
    importedState.time.slot = 2;

    const nextState = campaignReducer(state, {
      type: 'importCampaignState',
      payload: { state: importedState }
    });

    expect(nextState.time.day).toBe(3);
    expect(nextState.time.slot).toBe(2);
    expect(nextState.checkpoints.entries).toHaveLength(1);
  });

  it('startCombat creates a checkpoint and activates combat', () => {
    const state = createCampaignState();
    const nextState = campaignReducer(state, { type: 'startCombat' });

    expect(nextState.combat.active).toBe(true);
    expect(nextState.checkpoints.entries).toHaveLength(1);
    expect(nextState.combat.encounterId).toBeTruthy();
  });

  it('registerCombatDamage reveals target and HP when dropped', () => {
    const state = createCampaignState();
    const damaged = campaignReducer(state, {
      type: 'registerCombatDamage',
      payload: { targetId: 'target-1', remainingHp: 5 }
    });
    const downed = campaignReducer(damaged, {
      type: 'registerCombatDamage',
      payload: { targetId: 'target-1', remainingHp: 0 }
    });

    expect(damaged.combat.reveal.revealedTargets.has('target-1')).toBe(true);
    expect(damaged.combat.reveal.revealedHP.has('target-1')).toBe(false);
    expect(downed.combat.reveal.revealedHP.has('target-1')).toBe(true);
  });

  it('registerCombatDefenseSuccess reveals defense value', () => {
    const state = createCampaignState();
    const nextState = campaignReducer(state, {
      type: 'registerCombatDefenseSuccess',
      payload: { targetId: 'target-1', defense: { dodge: 9 } }
    });

    expect(nextState.combat.reveal.revealedDefenseValues['target-1'].dodge).toBe(9);
  });
});
