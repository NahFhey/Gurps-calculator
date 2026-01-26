import { describe, expect, it } from 'vitest';
import { campaignReducer, createCampaignState, initialCampaignState } from '../campaignReducer';

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
    expect(nextState.logs.entries).toHaveLength(1);
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
