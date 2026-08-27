import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateFishingResultsAuto } from '../FishingActivity';
import type { DowntimeTask, FishingData } from '../../../../types/downtime';
import type {
  AcquiredItem,
  AcquisitionSource,
  GatheringBait,
  GatheringSpecies,
  InventoryOwner,
} from '../../../../types/campaign';

/**
 * Deterministic auto-resolve tests. Math.random is pinned to 0, so every die
 * face is 1: the 3d6 fishing roll totals 3 (a success against the default
 * skill of 10), '1d' yield formulas total 1, and '1d-4' clamps to 0.
 */

function makeSpecies(overrides: Partial<GatheringSpecies> = {}): GatheringSpecies {
  return {
    id: 'sp-crab',
    name: 'Armor Crab',
    type: 'crustacean',
    tags: [],
    foodType: 'shellfish',
    yieldMeatFormula: '1d',
    secondaryMaterialType: 'shell',
    yieldSecondaryFormula: '1d',
    secondaryNameOverride: null,
    st: null,
    specialRules: [],
    ...overrides,
  };
}

function makeTask(species: GatheringSpecies): DowntimeTask {
  const activityData: FishingData = {
    type: 'fishing',
    method: 'Line',
    speciesId: species.id,
    isRandomCatch: false,
    spotId: 'spot-1',
    toolIds: [],
    baitId: null,
    retryAttempt: 0,
    skillModifier: 0,
    targetYield: 0,
  };
  return {
    id: 'task-1',
    activityType: 'fishing',
    dayKey: 1,
    slot: 0,
    leaderId: 'char-1',
    helperIds: [],
    status: 'pending',
    activityData,
    createdAt: 0,
    updatedAt: 0,
  };
}

function makeCampaignActions() {
  return {
    acquireItem: vi.fn<
      (item: AcquiredItem, owner: InventoryOwner, source: AcquisitionSource) => void
    >(),
    addGatheringBait: vi.fn<(bait: GatheringBait) => void>(),
  };
}

function runAutoResolve(species: GatheringSpecies) {
  const campaignActions = makeCampaignActions();
  const results = calculateFishingResultsAuto(
    makeTask(species),
    undefined,
    [species],
    [],
    [],
    undefined,
    campaignActions,
  );
  return { results, campaignActions };
}

describe('calculateFishingResultsAuto yield persistence', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('persists the secondary material even when the meat yield is zero', () => {
    // '1d-4' with all-ones dice clamps to 0 meat; '1d' gives 1 shell.
    const species = makeSpecies({ yieldMeatFormula: '1d-4' });
    const { results, campaignActions } = runAutoResolve(species);

    expect(results.success).toBe(true);
    const acquiredKinds = campaignActions.acquireItem.mock.calls.map(([item]) => item.kind);
    expect(acquiredKinds).toContain('material');
    expect(acquiredKinds).not.toContain('food');

    const changeKinds = (results.inventoryChanges ?? []).map((change) => change.kind);
    expect(changeKinds).toContain('material');
    expect(changeKinds).not.toContain('food');
  });

  it('persists both meat and secondary material when both yields are positive', () => {
    const species = makeSpecies();
    const { results, campaignActions } = runAutoResolve(species);

    expect(results.success).toBe(true);
    const acquiredKinds = campaignActions.acquireItem.mock.calls.map(([item]) => item.kind);
    expect(acquiredKinds).toContain('food');
    expect(acquiredKinds).toContain('material');

    const changeKinds = (results.inventoryChanges ?? []).map((change) => change.kind);
    expect(changeKinds).toContain('food');
    expect(changeKinds).toContain('material');
  });

  it('persists only meat when the species has no secondary material', () => {
    const species = makeSpecies({ secondaryMaterialType: null, yieldSecondaryFormula: null });
    const { results, campaignActions } = runAutoResolve(species);

    expect(results.success).toBe(true);
    const acquiredKinds = campaignActions.acquireItem.mock.calls.map(([item]) => item.kind);
    expect(acquiredKinds).toContain('food');
    expect(acquiredKinds).not.toContain('material');
  });
});
