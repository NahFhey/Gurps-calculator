import { describe, expect, it } from 'vitest';
import type { Character } from '../../../types/campaign';
import type { CreateTaskPayload } from '../downtimeActions';
import { downtimeInitialState } from '../downtimeInitialState';
import { isCharacterIncapacitated } from '../downtimeSelectors';
import { validateTaskCreation } from '../downtimeValidation';

function character(id: string, status?: Character['status']): Character {
  return { id, name: id === 'leader' ? 'Aldric' : 'Brenna', work: { skills: {} }, status };
}

function payload(
  activityType: 'social' | 'rest',
  helperIds: string[] = []
): CreateTaskPayload {
  return activityType === 'rest'
    ? {
        activityType,
        dayKey: 1,
        slot: 0,
        leaderId: 'leader',
        helperIds,
        activityData: { type: 'rest', restType: 'sleep', recoveryBonus: 0 },
      }
    : {
        activityType,
        dayKey: 1,
        slot: 0,
        leaderId: 'leader',
        helperIds,
        activityData: { type: 'social', contactId: 'contact', contactName: 'Contact', skillKey: 'Diplomacy' },
      };
}

describe('isCharacterIncapacitated', () => {
  it('recognizes dead and unconscious statuses only', () => {
    expect(isCharacterIncapacitated(undefined)).toBe(false);
    expect(isCharacterIncapacitated(character('leader'))).toBe(false);
    expect(isCharacterIncapacitated(character('leader', { dead: false }))).toBe(false);
    expect(isCharacterIncapacitated(character('leader', {
      conditions: [{ instanceId: 'p', conditionId: 'poisoned', label: 'Poisoned' }],
    }))).toBe(false);
    expect(isCharacterIncapacitated(character('leader', { dead: true }))).toBe(true);
    expect(isCharacterIncapacitated(character('leader', {
      conditions: [{ instanceId: 'ko', conditionId: 'unconscious', label: 'Unconscious' }],
    }))).toBe(true);
  });
});

describe('validateTaskCreation incapacitation gate', () => {
  it('rejects an incapacitated leader for non-rest work with a clear cause', () => {
    const dead = character('leader', { dead: true });
    expect(validateTaskCreation(downtimeInitialState, payload('social'), [dead])).toMatchObject({
      valid: false,
      message: 'Aldric is dead',
    });

    const unconscious = character('leader', {
      conditions: [{ instanceId: 'ko', conditionId: 'unconscious', label: 'Unconscious' }],
    });
    expect(validateTaskCreation(downtimeInitialState, payload('social'), [unconscious])).toMatchObject({
      valid: false,
      message: 'Aldric is unconscious',
    });
  });

  it('allows an incapacitated leader to be the patient of a rest task', () => {
    const dead = character('leader', { dead: true });
    expect(validateTaskCreation(downtimeInitialState, payload('rest'), [dead])).toEqual({ valid: true });
  });

  it('always rejects an incapacitated helper, including on rest tasks', () => {
    const leader = character('leader');
    const helper = character('helper', {
      conditions: [{ instanceId: 'ko', conditionId: 'unconscious', label: 'Unconscious' }],
    });
    expect(validateTaskCreation(
      downtimeInitialState,
      payload('rest', ['helper']),
      [leader, helper]
    )).toMatchObject({ valid: false, message: 'Brenna is unconscious' });
  });
});
