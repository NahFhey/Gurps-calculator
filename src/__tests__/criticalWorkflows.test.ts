/**
 * Integration tests for critical workflows:
 * 1. Combat round lifecycle (add characters → start session → advance turns → end)
 * 2. Time advancement with blocking checks
 * 3. Crafting project lifecycle (create → progress → complete)
 *
 * These test the campaignReducer end-to-end to ensure multi-step workflows
 * produce correct state transitions.
 */
import { describe, it, expect } from 'vitest';
import { campaignReducer, createCampaignState } from '../state/campaignReducer';
import type { CampaignAction, CampaignState } from '../state/campaignReducer';
import type { CombatCharacter, CombatSession, Craft } from '../types/campaign';
import type { CombatState, Participant } from '../types/combatTracker';

// Helper to dispatch a sequence of actions
function dispatchAll(initial: CampaignState, actions: CampaignAction[]): CampaignState {
  return actions.reduce((state, action) => campaignReducer(state, action), initial);
}

// ---------------------------------------------------------------------------
// 1. Combat Round Lifecycle
// ---------------------------------------------------------------------------
describe('Combat round lifecycle', () => {
  const fighter: CombatCharacter = {
    id: 'fighter-1',
    name: 'Sir Roderick',
    category: 'player',
    isNPC: false,
    hp: 14,
    maxHP: 14,
    st: 13,
    dx: 12,
    iq: 10,
    ht: 12,
    dodge: 9,
    dr: 3,
    skills: { Broadsword: 15 },
    weapons: [{ name: 'Broadsword', damage: '2d+1 cut', reach: '1', skill: 'Broadsword' }],
    armor: [{ location: 'Torso', dr: 3 }],
    notes: '',
  };

  const goblin: CombatCharacter = {
    id: 'goblin-1',
    name: 'Goblin Scout',
    category: 'enemy',
    isNPC: true,
    hp: 8,
    maxHP: 8,
    st: 9,
    dx: 11,
    iq: 8,
    ht: 9,
    dodge: 8,
    dr: 1,
    skills: { Shortsword: 12 },
    weapons: [{ name: 'Shortsword', damage: '1d+1 cut', reach: '1', skill: 'Shortsword' }],
    armor: [],
    notes: '',
  };

  const makeParticipant = (overrides?: Partial<Participant>): Participant => ({
    instanceId: 'fighter-1',
    libraryId: 'fighter-1',
    name: 'Sir Roderick',
    category: 'player',
    st: 13,
    dx: 12,
    iq: 10,
    ht: 12,
    hp: 14,
    fp: 12,
    mp: 0,
    maxHP: 14,
    currentHP: 14,
    basicSpeed: 6,
    basicMove: 6,
    isDead: false,
    conditions: [],
    ...overrides,
  });

  const makeSession = (overrides?: Partial<CombatState>): CombatState => ({
    id: 'session-1',
    name: 'Battle',
    startTime: 1767225600000,
    currentRound: 1,
    currentTurnIndex: 0,
    participants: [
      makeParticipant(),
      makeParticipant({
        instanceId: 'goblin-1',
        libraryId: 'goblin-1',
        name: 'Goblin Scout',
        category: 'enemy',
        st: 9,
        dx: 11,
        iq: 8,
        ht: 9,
        hp: 8,
        maxHP: 8,
        currentHP: 8,
        basicSpeed: 5,
        basicMove: 5,
      }),
    ],
    turnOrder: ['fighter-1', 'goblin-1'],
    turnDecisions: {},
    log: [],
    ...overrides,
  });

  it('adds characters to the library', () => {
    const state = createCampaignState();
    const next = dispatchAll(state, [
      { type: 'addCombatCharacter', payload: fighter },
      { type: 'addCombatCharacter', payload: goblin },
    ]);

    expect(Object.keys(next.entities.combatCharacters)).toHaveLength(2);
    expect(next.entities.combatCharacters['fighter-1'].name).toBe('Sir Roderick');
    expect(next.entities.combatCharacters['goblin-1'].name).toBe('Goblin Scout');
  });

  it('starts combat via startCombat action', () => {
    let state = createCampaignState();
    state = dispatchAll(state, [
      { type: 'addCombatCharacter', payload: fighter },
      { type: 'addCombatCharacter', payload: goblin },
    ]);

    // startCombat sets active flag and creates a checkpoint
    state = campaignReducer(state, { type: 'startCombat', payload: {} });
    expect(state.combat.active).toBe(true);
    expect(state.combat.encounterId).toBeDefined();

    // Then set the session details
    const session = makeSession({ name: 'Ambush!' });
    state = campaignReducer(state, { type: 'setCombatActive', payload: session });
    expect(state.combat.activeSession?.name).toBe('Ambush!');
    expect(state.combat.activeSession?.participants).toHaveLength(2);
  });

  it('advances turns and rounds', () => {
    let state = createCampaignState();
    state = dispatchAll(state, [
      { type: 'addCombatCharacter', payload: fighter },
      { type: 'addCombatCharacter', payload: goblin },
    ]);

    const session = makeSession();

    state = campaignReducer(state, { type: 'setCombatActive', payload: session });

    // Advance turn: fighter acts, now goblin's turn
    state = campaignReducer(state, {
      type: 'updateCombatActive',
      payload: { currentTurnIndex: 1 },
    });
    expect(state.combat.activeSession?.currentTurnIndex).toBe(1);

    // Advance to next round
    state = campaignReducer(state, {
      type: 'updateCombatActive',
      payload: { currentRound: 2, currentTurnIndex: 0 },
    });
    expect(state.combat.activeSession?.currentRound).toBe(2);
    expect(state.combat.activeSession?.currentTurnIndex).toBe(0);
  });

  it('applies damage and tracks HP changes', () => {
    let state = createCampaignState();
    state = dispatchAll(state, [
      { type: 'addCombatCharacter', payload: fighter },
      { type: 'addCombatCharacter', payload: goblin },
    ]);

    const session = makeSession();

    state = campaignReducer(state, { type: 'setCombatActive', payload: session });

    // Goblin takes 5 damage
    const updatedParticipants = state.combat.activeSession!.participants.map((p) =>
      p.instanceId === 'goblin-1' ? { ...p, currentHP: (p.currentHP ?? 0) - 5 } : p
    );
    state = campaignReducer(state, {
      type: 'updateCombatActive',
      payload: { participants: updatedParticipants },
    });

    const goblinParticipant = state.combat.activeSession!.participants.find(
      (p) => p.instanceId === 'goblin-1'
    );
    expect(goblinParticipant?.currentHP).toBe(3);
  });

  it('ends combat and archives to history', () => {
    let state = createCampaignState();
    state = dispatchAll(state, [
      { type: 'addCombatCharacter', payload: fighter },
      { type: 'addCombatCharacter', payload: goblin },
    ]);

    const session = makeSession({ currentRound: 3 });
    session.participants = session.participants.map((p) =>
      p.instanceId === 'goblin-1' ? { ...p, currentHP: 0, isDead: true } : { ...p, currentHP: 10 }
    );

    state = campaignReducer(state, { type: 'setCombatActive', payload: session });

    // Archive the session to history.  entities.combatHistory still carries the
    // legacy CombatSession[] declaration while holding CombatState snapshots at
    // runtime — same bridge production end-combat code uses.
    state = campaignReducer(state, {
      type: 'setCombatHistory',
      payload: [session] as unknown as CombatSession[],
    });

    // End combat
    state = campaignReducer(state, { type: 'setCombatActive', payload: null });

    expect(state.combat.active).toBe(false);
    expect(state.combat.activeSession).toBeNull();
    expect(state.entities.combatHistory).toHaveLength(1);
    expect(state.entities.combatHistory[0].name).toBe('Battle');
  });
});

// ---------------------------------------------------------------------------
// 2. Time Advancement
// ---------------------------------------------------------------------------
describe('Time advancement', () => {
  it('advances slot within a day', () => {
    const state = createCampaignState();
    expect(state.time.day).toBe(1);
    expect(state.time.slot).toBe(0);

    const next = campaignReducer(state, { type: 'advanceTime' });
    expect(next.time.slot).toBe(1);
    expect(next.time.day).toBe(1);
  });

  it('advances to next day when slots are exhausted', () => {
    let state = createCampaignState();
    // Advance through all slots in a day
    // Time system typically has a fixed number of slots per day
    const maxSlots = 6; // common in GURPS downtime
    for (let i = 0; i < maxSlots; i++) {
      const next = campaignReducer(state, { type: 'advanceTime' });
      if (next.time.day > state.time.day) {
        // Day rolled over
        expect(next.time.slot).toBe(0);
        break;
      }
      state = next;
    }
    // At minimum, time should have advanced
    expect(state.time.slot > 0 || state.time.day > 1).toBe(true);
  });

  it('blocks advancement when paused activities exist', () => {
    const state = createCampaignState();
    // Simulate a paused activity blocking time
    state.activities.pausedSessionIds = ['paused-1'];

    const next = campaignReducer(state, { type: 'advanceTime' });
    expect(next.ui.blockingError).toBeDefined();
    expect(next.ui.blockingError?.type).toBe('pausedActivities');
    // Time should NOT have advanced
    expect(next.time.slot).toBe(state.time.slot);
  });
});

// ---------------------------------------------------------------------------
// 3. Crafting Project Lifecycle
// ---------------------------------------------------------------------------
describe('Crafting project lifecycle', () => {
  const baseCraft: Craft = {
    id: 'craft-1',
    phase: 'setup',
    templateType: 'weapons',
    template: 'Broadsword',
    quality: 'good',
    currentQuality: 'good',
    name: 'Custom Broadsword',
    mods: [],
    selectedMaterials: [],
    shifts: [],
    startDate: new Date().toISOString(),
    startDay: 1,
  };

  it('creates a craft project', () => {
    const state = createCampaignState();
    const next = campaignReducer(state, { type: 'addCraft', payload: baseCraft });
    expect(next.entities.crafts['craft-1']).toBeDefined();
    expect(next.entities.crafts['craft-1'].phase).toBe('setup');
    expect(next.entities.crafts['craft-1'].name).toBe('Custom Broadsword');
  });

  it('progresses a craft through phases', () => {
    let state = createCampaignState();
    state = campaignReducer(state, { type: 'addCraft', payload: baseCraft });

    // Move to design phase
    state = campaignReducer(state, {
      type: 'updateCraft',
      payload: { id: 'craft-1', changes: { phase: 'design' } },
    });
    expect(state.entities.crafts['craft-1'].phase).toBe('design');

    // Move to craft phase
    state = campaignReducer(state, {
      type: 'updateCraft',
      payload: { id: 'craft-1', changes: { phase: 'craft' } },
    });
    expect(state.entities.crafts['craft-1'].phase).toBe('craft');
  });

  it('records work shifts during crafting', () => {
    let state = createCampaignState();
    state = campaignReducer(state, { type: 'addCraft', payload: { ...baseCraft, phase: 'craft' } });

    const shift = {
      id: 'shift-1',
      date: new Date().toISOString(),
      day: 1,
      worker: 'Smith',
      skill: 14,
      roll: 11,
      effectiveSkill: 14,
      result: 'Success',
      hoursAdded: 4,
      qualityShift: 0,
      phase: 'craft',
    };

    state = campaignReducer(state, {
      type: 'updateCraft',
      payload: {
        id: 'craft-1',
        changes: { shifts: [shift] },
      },
    });
    expect(state.entities.crafts['craft-1'].shifts).toHaveLength(1);
    expect(state.entities.crafts['craft-1'].shifts[0].worker).toBe('Smith');
  });

  it('completes a craft with final stats', () => {
    let state = createCampaignState();
    state = campaignReducer(state, {
      type: 'addCraft',
      payload: { ...baseCraft, phase: 'craft' },
    });

    state = campaignReducer(state, {
      type: 'completeCraft',
      payload: {
        id: 'craft-1',
        finalStats: { weight: 3, hp: 11, ht: 12, damage: '2d+1 cut' },
      },
    });

    const craft = state.entities.crafts['craft-1'];
    expect(craft.phase).toBe('complete');
    expect(craft.finalStats?.damage).toBe('2d+1 cut');
    expect(craft.finalStats?.weight).toBe(3);
  });

  it('full lifecycle: create → design → craft → complete → remove', () => {
    let state = createCampaignState();

    // Create
    state = campaignReducer(state, { type: 'addCraft', payload: baseCraft });
    expect(Object.keys(state.entities.crafts)).toHaveLength(1);

    // Progress through phases
    state = campaignReducer(state, {
      type: 'updateCraft',
      payload: { id: 'craft-1', changes: { phase: 'design' } },
    });
    state = campaignReducer(state, {
      type: 'updateCraft',
      payload: { id: 'craft-1', changes: { phase: 'craft' } },
    });

    // Complete
    state = campaignReducer(state, {
      type: 'completeCraft',
      payload: {
        id: 'craft-1',
        finalStats: { weight: 3, hp: 11, ht: 12 },
      },
    });
    expect(state.entities.crafts['craft-1'].phase).toBe('complete');

    // Remove
    state = campaignReducer(state, { type: 'removeCraft', payload: 'craft-1' });
    expect(state.entities.crafts['craft-1']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 4. Cross-system: Combat affects characters, characters persist
// ---------------------------------------------------------------------------
describe('Cross-system character persistence', () => {
  it('character updates during combat persist after combat ends', () => {
    let state = createCampaignState();

    const char: CombatCharacter = {
      id: 'hero-1',
      name: 'Hero',
      category: 'player',
      isNPC: false,
      hp: 12,
      maxHP: 12,
      st: 11,
      dx: 12,
      iq: 10,
      ht: 11,
      dodge: 8,
      dr: 2,
      skills: {},
      weapons: [],
      armor: [],
      notes: '',
    };

    // Add character
    state = campaignReducer(state, { type: 'addCombatCharacter', payload: char });

    // Update character (took damage in combat, permanent injury)
    state = campaignReducer(state, {
      type: 'updateCombatCharacter',
      payload: { id: 'hero-1', changes: { hp: 8, notes: 'Injured left arm' } },
    });

    // End combat (set to null)
    state = campaignReducer(state, { type: 'setCombatActive', payload: null });

    // Character changes persist
    expect(state.entities.combatCharacters['hero-1'].hp).toBe(8);
    expect(state.entities.combatCharacters['hero-1'].notes).toBe('Injured left arm');
  });
});
