/**
 * Tests for PostCombatSummary component and buildCombatSummary helper (Phase 11c)
 */

import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PostCombatSummary, { buildCombatSummary } from '../PostCombatSummary';
import { CampaignStoreProvider, useCampaignStore } from '../../../state/campaignStore';
import { createCampaignState } from '../../../state/campaignReducer';
import { createDefaultGCSData } from '../../../types/characterSheet';
import type { CombatState, Participant } from '../../../types/combatTracker';

// ============================================================================
// buildCombatSummary tests
// ============================================================================

function makeParticipant(overrides: Partial<Participant> & { instanceId: string; name: string }): Participant {
  return {
    category: 'enemy',
    st: 10,
    dx: 10,
    iq: 10,
    ht: 10,
    hp: 12,
    fp: 10,
    mp: 0,
    maxHP: 12,
    maxFP: 10,
    maxMP: 0,
    currentHP: 12,
    currentFP: 10,
    currentMP: 0,
    basicSpeed: 5.5,
    basicMove: 5,
    ...overrides
  };
}

function makeCombat(participants: Participant[], overrides?: Partial<CombatState>): CombatState {
  return {
    id: 'combat-1',
    name: 'Test Combat',
    version: 2,
    startTime: 1000000,
    endTime: 1060000,
    participants,
    turnOrder: participants.map(p => p.instanceId),
    currentTurnIndex: 0,
    currentRound: 3,
    turnDecisions: {},
    log: [],
    ...overrides
  };
}

describe('buildCombatSummary', () => {
  it('generates summary with correct round count and duration', () => {
    const combat = makeCombat([
      makeParticipant({ instanceId: 'p1', name: 'Fighter' })
    ]);
    const summary = buildCombatSummary(combat);

    expect(summary.combatId).toBe('combat-1');
    expect(summary.combatName).toBe('Test Combat');
    expect(summary.rounds).toBe(3);
    expect(summary.durationMs).toBe(60000);
  });

  it('tracks HP/FP loss for participants', () => {
    const combat = makeCombat([
      makeParticipant({
        instanceId: 'p1',
        name: 'Fighter',
        maxHP: 12,
        currentHP: 7,
        maxFP: 10,
        currentFP: 8
      })
    ]);
    const summary = buildCombatSummary(combat);

    expect(summary.participants).toHaveLength(1);
    expect(summary.participants[0].endHP).toBe(7);
    expect(summary.participants[0].maxHP).toBe(12);
    expect(summary.participants[0].endFP).toBe(8);
  });

  it('generates healing estimates for party characters', () => {
    const p = makeParticipant({
      instanceId: 'p1',
      name: 'Fighter',
      category: 'player',
      maxHP: 14,
      currentHP: 6,
      maxFP: 12,
      currentFP: 9,
      isFromParty: true,
      partyCharacterId: 'char-1',
    });

    const combat = makeCombat([p]);
    const summary = buildCombatSummary(combat);

    expect(summary.healingEstimates['char-1']).toBeDefined();
    expect(summary.healingEstimates['char-1'].daysToFullHP).toBe(8); // 14 - 6 = 8 days
    expect(summary.healingEstimates['char-1'].firstAidEstimate.max).toBe(4); // min(8, 4)
  });

  it('does not generate healing estimates for non-party participants', () => {
    const combat = makeCombat([
      makeParticipant({
        instanceId: 'e1',
        name: 'Goblin',
        category: 'enemy',
        maxHP: 8,
        currentHP: 0
      })
    ]);
    const summary = buildCombatSummary(combat);

    expect(Object.keys(summary.healingEstimates)).toHaveLength(0);
  });

  it('captures status flags (dead, unconscious, stunned) — stun/unconsciousness derive from conditions[] since 12a.6', () => {
    const combat = makeCombat([
      makeParticipant({
        instanceId: 'p1',
        name: 'Casualty',
        isDead: true,
        conditions: [
          { instanceId: 'c-ko', conditionId: 'unconscious', label: 'Unconscious', revealed: 'open' }
        ]
      })
    ]);
    const summary = buildCombatSummary(combat);

    expect(summary.participants[0].isDead).toBe(true);
    expect(summary.participants[0].isUnconscious).toBe(true);
    expect(summary.participants[0].isStunned).toBe(false);
  });

  it('derives isStunned from a Stunned condition instance', () => {
    const combat = makeCombat([
      makeParticipant({
        instanceId: 'p1',
        name: 'Dazed',
        conditions: [
          { instanceId: 'c-stun', conditionId: 'stunned', label: 'Stunned', revealed: 'open' }
        ]
      })
    ]);
    const summary = buildCombatSummary(combat);

    expect(summary.participants[0].isStunned).toBe(true);
    expect(summary.participants[0].isUnconscious).toBe(false);
    expect(summary.participants[0].isDead).toBe(false);
  });

  it('captures conditions and crippled locations', () => {
    const combat = makeCombat([
      makeParticipant({
        instanceId: 'p1',
        name: 'Injured',
        crippled: ['Right Arm', 'Left Leg'],
        conditions: [
          { instanceId: 'c1', conditionId: 'stun', label: 'Stunned' }
        ],
        bleeding: { rate: 1, round: 2 }
      })
    ]);
    const summary = buildCombatSummary(combat);
    const ps = summary.participants[0];

    expect(ps.crippled).toEqual(['Right Arm', 'Left Leg']);
    expect(ps.conditions).toHaveLength(1);
    expect(ps.conditions[0].label).toBe('Stunned');
    expect(ps.bleeding).toEqual({ rate: 1, round: 2 });
  });

  it('handles participants with numeric hp (no maxHP field)', () => {
    const combat = makeCombat([
      makeParticipant({
        instanceId: 'p1',
        name: 'Simple',
        hp: 10,
        maxHP: undefined,
        currentHP: 7
      })
    ]);
    const summary = buildCombatSummary(combat);

    expect(summary.participants[0].maxHP).toBe(10);
    expect(summary.participants[0].endHP).toBe(7);
  });

  it('handles zero-damage combat', () => {
    const combat = makeCombat([
      makeParticipant({
        instanceId: 'p1',
        name: 'Untouched',
        maxHP: 12,
        currentHP: 12
      })
    ]);
    const summary = buildCombatSummary(combat);

    expect(summary.participants[0].endHP).toBe(12);
    expect(summary.participants[0].maxHP).toBe(12);
  });

  it('handles multiple party characters with independent healing estimates', () => {
    const p1 = makeParticipant({
      instanceId: 'p1',
      name: 'Tank',
      category: 'player',
      maxHP: 16,
      currentHP: 4,
      isFromParty: true,
      partyCharacterId: 'char-1',
    });

    const p2 = makeParticipant({
      instanceId: 'p2',
      name: 'Mage',
      category: 'player',
      maxHP: 10,
      currentHP: 9,
      isFromParty: true,
      partyCharacterId: 'char-2',
    });

    const combat = makeCombat([p1, p2]);
    const summary = buildCombatSummary(combat);

    expect(summary.healingEstimates['char-1'].daysToFullHP).toBe(12);
    expect(summary.healingEstimates['char-2'].daysToFullHP).toBe(1);
  });
});

function CharacterStateObserver() {
  const { state } = useCampaignStore();
  return <pre data-testid="character-state">{JSON.stringify(state.entities.characters)}</pre>;
}

describe('PostCombatSummary persistence sync', () => {
  it('syncs pools and replacement status, clears stale status, ignores library participants, and supports sheetless characters', async () => {
    const campaign = createCampaignState();
    const gcsData = createDefaultGCSData();
    campaign.entities.characters = {
      injured: { id: 'injured', name: 'Injured', work: { skills: {} }, gcsData },
      clear: {
        id: 'clear', name: 'Clear', work: { skills: {} }, gcsData: createDefaultGCSData(),
        status: { conditions: [{ instanceId: 'old', conditionId: 'poisoned', label: 'Old poison' }] },
      },
      sheetless: { id: 'sheetless', name: 'Sheetless', work: { skills: {} } },
      library: { id: 'library', name: 'Library', work: { skills: {} }, status: { dead: true } },
    };

    const combat = makeCombat([
      makeParticipant({
        instanceId: 'p-injured', name: 'Injured', isFromParty: true,
        partyCharacterId: 'injured', currentHP: 3, currentFP: 4, isDead: true,
        crippled: ['armR'],
      }),
      makeParticipant({
        instanceId: 'p-clear', name: 'Clear', isFromParty: true,
        partyCharacterId: 'clear', currentHP: 12, currentFP: 10, conditions: [], crippled: [],
      }),
      makeParticipant({
        instanceId: 'p-sheetless', name: 'Sheetless', isFromParty: true,
        partyCharacterId: 'sheetless',
        conditions: [{ instanceId: 'poison', conditionId: 'poisoned', label: 'Poisoned', revealed: 'closed' }],
      }),
      makeParticipant({
        instanceId: 'p-library', name: 'Library template', libraryId: 'library',
        partyCharacterId: 'library', isFromParty: false, isDead: false,
      }),
    ]);

    render(
      <CampaignStoreProvider initialCampaignState={campaign}>
        <PostCombatSummary combat={combat} onComplete={() => undefined} onProceedToLoot={() => undefined} />
        <CharacterStateObserver />
      </CampaignStoreProvider>
    );

    await waitFor(() => {
      const characters = JSON.parse(screen.getByTestId('character-state').textContent ?? '{}');
      expect(characters.injured.gcsData.pools.HP.current).toBe(3);
      expect(characters.injured.gcsData.pools.FP.current).toBe(4);
      expect(characters.injured.status).toEqual({ crippled: ['armR'], dead: true });
      expect(characters.clear).not.toHaveProperty('status');
      expect(characters.sheetless.status).toEqual({
        conditions: [{
          instanceId: 'poison', conditionId: 'poisoned', label: 'Poisoned', revealed: 'closed',
        }],
      });
      expect(characters.library.status).toEqual({ dead: true });
    });
  });
});
