import { describe, expect, it } from 'vitest';
import { campaignReducer, createCampaignState, initialCampaignState, logEvent } from '../campaignReducer';

describe('campaignReducer', () => {
  it('setActiveModule updates state', () => {
    const nextState = campaignReducer(initialCampaignState, {
      type: 'setActiveModule',
      payload: 'rules'
    });

    expect(nextState.ui.activeModule).toBe('rules');
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
