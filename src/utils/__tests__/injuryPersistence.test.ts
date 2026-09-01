import { describe, expect, it } from 'vitest';
import {
  buildCharacterStatus,
  buildPersistedConditions,
  seedParticipantFromStatus,
} from '../injuryPersistence';
import type { CharacterStatus } from '../../types/campaign';
import type { ConditionInstance, Participant } from '../../types/combatTracker';

function participant(overrides: Partial<Participant> = {}): Participant {
  return {
    instanceId: 'participant-1',
    name: 'Aldric',
    category: 'player',
    st: 10,
    dx: 10,
    iq: 10,
    ht: 10,
    hp: 10,
    fp: 10,
    mp: 0,
    basicSpeed: 5,
    basicMove: 5,
    ...overrides,
  };
}

describe('buildPersistedConditions', () => {
  it('keeps only live catalog-persistent conditions and trims combat fields', () => {
    const conditions: ConditionInstance[] = [
      {
        instanceId: 'poison', conditionId: 'poisoned', label: 'Venom', severity: 2,
        source: 'Spider', notes: 'Slow acting', revealed: 'half', startedAtRound: 2,
        startedAtTurn: 1, duration: { type: 'rounds', value: 10 },
        expiresAt: { type: 'round', round: 20 },
      },
      { instanceId: 'stun', conditionId: 'stunned', label: 'Stunned' },
      { instanceId: 'unknown', conditionId: 'homebrew', label: 'Homebrew' },
      {
        instanceId: 'combat-ko', conditionId: 'unconscious', label: 'Unconscious',
        expiresAt: { type: 'endOfCombat' },
      },
      {
        instanceId: 'expired-blind', conditionId: 'blinded', label: 'Blinded',
        expiresAt: { type: 'turn', turnsRemaining: 0 },
      },
      { instanceId: 'ko', conditionId: 'unconscious', label: 'Unconscious' },
    ];

    expect(buildPersistedConditions(conditions)).toEqual([
      {
        instanceId: 'poison', conditionId: 'poisoned', label: 'Venom', severity: 2,
        source: 'Spider', notes: 'Slow acting', revealed: 'half',
      },
      { instanceId: 'ko', conditionId: 'unconscious', label: 'Unconscious' },
    ]);
  });

  it('omits null and undefined optional fields', () => {
    expect(buildPersistedConditions([{
      instanceId: 'blind', conditionId: 'blinded', label: 'Blinded',
      severity: null, source: null, notes: null,
    }])).toEqual([{ instanceId: 'blind', conditionId: 'blinded', label: 'Blinded' }]);
  });
});

describe('buildCharacterStatus', () => {
  it('returns undefined for an all-clear participant', () => {
    expect(buildCharacterStatus(participant())).toBeUndefined();
  });

  it('builds dead-only, crippled, and combined replacement status', () => {
    expect(buildCharacterStatus(participant({ isDead: true }))).toEqual({ dead: true });

    const crippled = ['armR'];
    const crippledStatus = buildCharacterStatus(participant({ crippled }));
    expect(crippledStatus).toEqual({ crippled: ['armR'] });
    expect(crippledStatus?.crippled).not.toBe(crippled);

    expect(buildCharacterStatus(participant({
      isDead: true,
      crippled: ['legL'],
      conditions: [{ instanceId: 'ko', conditionId: 'unconscious', label: 'Unconscious' }],
    }))).toEqual({
      conditions: [{ instanceId: 'ko', conditionId: 'unconscious', label: 'Unconscious' }],
      crippled: ['legL'],
      dead: true,
    });
  });
});

describe('seedParticipantFromStatus', () => {
  it('round-trips persisted fields into permanent combat conditions', () => {
    const status: CharacterStatus = {
      conditions: [{
        instanceId: 'poison', conditionId: 'poisoned', label: 'Venom', severity: 3,
        source: 'Needle', notes: 'Hidden dose', revealed: 'closed',
      }],
      crippled: ['armL'],
      dead: true,
    };

    const seeded = seedParticipantFromStatus(status);
    expect(seeded).toEqual({
      conditions: [{
        instanceId: 'poison', conditionId: 'poisoned', label: 'Venom', severity: 3,
        source: 'Needle', notes: 'Hidden dose', revealed: 'closed',
        duration: { type: 'permanent' }, expiresAt: null,
      }],
      crippled: ['armL'],
    });
    expect(seeded.crippled).not.toBe(status.crippled);
  });

  it('seeds empty arrays from undefined status', () => {
    expect(seedParticipantFromStatus(undefined)).toEqual({ conditions: [], crippled: [] });
  });
});
