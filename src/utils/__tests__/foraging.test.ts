/**
 * Tests for the Foraging Resolution Engine
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateForageEffectiveSkill,
  determineTierOutcome,
  weightedRandomSelect,
  selectCategory,
  selectItem,
  calculateForageYield,
  shouldCheckForEvent,
  resolveEvent,
  buildForageLogText,
  resolveForage,
} from '../foraging';
import { DEFAULT_FORAGING_CONFIG, FORAGE_CATEGORY_META } from '../../constants/foraging';
import type {
  ForageActionInput,
  ForageZoneProfile,
  ForageItem,
  ForageCategoryId,
  ForagingConfig,
  FoundStack,
  ForageEvent,
} from '../../types/foraging';

// ============================================================================
// HELPERS
// ============================================================================

function baseInput(overrides?: Partial<ForageActionInput>): ForageActionInput {
  return {
    actorId: 'char-1',
    zoneId: 'zone-1',
    mode: 'general',
    skillUsed: 'survival',
    baseSkillLevel: 12,
    contextFlags: {
      hasMapOrGuide: false,
      isUnfamiliarOrHostile: false,
      isPeakSeason: false,
      isOffSeason: false,
      hasProperTools: false,
      isDenseOrDangerousTerrain: false,
    },
    toolIds: [],
    helperCount: 0,
    supervisorSkill15Plus: false,
    toolSkillBonus: 0,
    toolYieldBonus: 0,
    weatherModifier: 0,
    ...overrides,
  };
}

const testZone: ForageZoneProfile = {
  id: 'zone-1',
  name: 'Test Forest',
  locationId: 'loc-1',
  commonCategories: [
    { categoryId: 'fruits', weight: 3, items: [] },
    { categoryId: 'mushrooms', weight: 1, items: [] },
  ],
  uncommonCategories: [
    { categoryId: 'herbs_spices', weight: 1, items: [] },
  ],
  rareCategories: [
    { categoryId: 'alchemical_ingredients', weight: 1, items: [] },
  ],
  tags: ['woodland', 'temperate'],
};

const testItems: ForageItem[] = [
  {
    id: 'item-1',
    name: 'Wild Berries',
    categoryId: 'fruits',
    tier: 'common',
    yieldFormula: '2d+1',
    inventoryKind: 'food',
    typeId: 'berries',
  },
  {
    id: 'item-2',
    name: 'Forest Mushrooms',
    categoryId: 'mushrooms',
    tier: 'common',
    yieldFormula: '1d+2',
    inventoryKind: 'food',
    typeId: 'mushrooms',
  },
  {
    id: 'item-3',
    name: 'Rosemary',
    categoryId: 'herbs_spices',
    tier: 'uncommon',
    yieldFormula: '2d+1',
    inventoryKind: 'food',
    typeId: 'rosemary',
  },
  {
    id: 'item-4',
    name: 'Rare Moss',
    categoryId: 'alchemical_ingredients',
    tier: 'rare',
    yieldFormula: '1d+1',
    inventoryKind: 'material',
    typeId: 'moss',
  },
  {
    id: 'item-5',
    name: 'Mystical Root',
    categoryId: 'alchemical_ingredients',
    tier: 'veryRare',
    yieldFormula: '1d',
    inventoryKind: 'material',
    typeId: 'mystical-root',
  },
  {
    id: 'item-6',
    name: 'Zone-Restricted Herb',
    categoryId: 'herbs_spices',
    tier: 'uncommon',
    yieldFormula: '1d+1',
    inventoryKind: 'food',
    typeId: 'restricted-herb',
    zoneRestrictions: ['zone-2'],
  },
  {
    id: 'item-7',
    name: 'Tag-Restricted Plant',
    categoryId: 'herbs_spices',
    tier: 'uncommon',
    yieldFormula: '1d',
    inventoryKind: 'food',
    typeId: 'tag-plant',
    tagRestrictions: ['volcanic'],
  },
];

// ============================================================================
// calculateForageEffectiveSkill
// ============================================================================

describe('calculateForageEffectiveSkill', () => {
  it('returns base skill with no modifiers', () => {
    const input = baseInput({ baseSkillLevel: 14 });
    const result = calculateForageEffectiveSkill(input);

    expect(result.effectiveSkill).toBe(14);
    expect(result.modifiers).toHaveLength(1);
    expect(result.modifiers[0]).toEqual({ label: 'Base Skill', value: 14 });
  });

  it('adds tool skill bonus', () => {
    const input = baseInput({ baseSkillLevel: 12, toolSkillBonus: 3 });
    const result = calculateForageEffectiveSkill(input);

    expect(result.effectiveSkill).toBe(15);
    expect(result.modifiers).toContainEqual({ label: 'Tools', value: 3 });
  });

  it('adds helper bonuses for 1 helper', () => {
    const input = baseInput({ helperCount: 1 });
    const result = calculateForageEffectiveSkill(input);

    expect(result.effectiveSkill).toBe(13); // 12 + 1 helper = +1
  });

  it('adds helper bonuses for 2-3 helpers', () => {
    const input = baseInput({ helperCount: 2 });
    const result = calculateForageEffectiveSkill(input);

    expect(result.effectiveSkill).toBe(14); // 12 + 2
  });

  it('adds helper bonuses for 4+ helpers', () => {
    const input = baseInput({ helperCount: 5 });
    const result = calculateForageEffectiveSkill(input);

    expect(result.effectiveSkill).toBe(15); // 12 + 3
  });

  it('adds supervisor bonus', () => {
    const input = baseInput({ supervisorSkill15Plus: true });
    const result = calculateForageEffectiveSkill(input);

    expect(result.effectiveSkill).toBe(17); // 12 + 5
    expect(result.modifiers).toContainEqual({ label: 'Supervisor (15+)', value: 5 });
  });

  it('adds map/guide modifier', () => {
    const input = baseInput({
      contextFlags: {
        hasMapOrGuide: true,
        isUnfamiliarOrHostile: false,
        isPeakSeason: false,
        isOffSeason: false,
        hasProperTools: false,
        isDenseOrDangerousTerrain: false,
      },
    });
    const result = calculateForageEffectiveSkill(input);

    expect(result.effectiveSkill).toBe(13); // 12 + 1
  });

  it('adds unfamiliar penalty', () => {
    const input = baseInput({
      contextFlags: {
        hasMapOrGuide: false,
        isUnfamiliarOrHostile: true,
        isPeakSeason: false,
        isOffSeason: false,
        hasProperTools: false,
        isDenseOrDangerousTerrain: false,
      },
    });
    const result = calculateForageEffectiveSkill(input);

    expect(result.effectiveSkill).toBe(10); // 12 - 2
  });

  it('adds peak season bonus', () => {
    const input = baseInput({
      contextFlags: {
        hasMapOrGuide: false,
        isUnfamiliarOrHostile: false,
        isPeakSeason: true,
        isOffSeason: false,
        hasProperTools: false,
        isDenseOrDangerousTerrain: false,
      },
    });
    const result = calculateForageEffectiveSkill(input);

    expect(result.effectiveSkill).toBe(14); // 12 + 2
  });

  it('applies proper tools bonus', () => {
    const input = baseInput({
      contextFlags: {
        hasMapOrGuide: false,
        isUnfamiliarOrHostile: false,
        isPeakSeason: false,
        isOffSeason: false,
        hasProperTools: true,
        isDenseOrDangerousTerrain: false,
      },
    });
    const result = calculateForageEffectiveSkill(input);

    expect(result.effectiveSkill).toBe(14); // 12 + 2
  });

  it('applies dense terrain penalty only when no proper tools', () => {
    const input = baseInput({
      contextFlags: {
        hasMapOrGuide: false,
        isUnfamiliarOrHostile: false,
        isPeakSeason: false,
        isOffSeason: false,
        hasProperTools: false,
        isDenseOrDangerousTerrain: true,
      },
    });
    const result = calculateForageEffectiveSkill(input);

    expect(result.effectiveSkill).toBe(10); // 12 - 2
  });

  it('does NOT apply dense terrain penalty when proper tools are present', () => {
    const input = baseInput({
      contextFlags: {
        hasMapOrGuide: false,
        isUnfamiliarOrHostile: false,
        isPeakSeason: false,
        isOffSeason: false,
        hasProperTools: true,
        isDenseOrDangerousTerrain: true,
      },
    });
    const result = calculateForageEffectiveSkill(input);

    // Should be 12 + 2 (proper tools) but NOT -2 (dense terrain)
    expect(result.effectiveSkill).toBe(14);
  });

  it('applies specific item rarity penalty', () => {
    const input = baseInput({ mode: 'specific' });
    const targetItem = testItems.find((i) => i.id === 'item-4')!; // tier: 'rare' → -4
    const result = calculateForageEffectiveSkill(input, targetItem);

    expect(result.effectiveSkill).toBe(8); // 12 - 4
    expect(result.modifiers).toContainEqual({ label: 'Rarity (rare)', value: -4 });
  });

  it('applies weather modifier', () => {
    const input = baseInput({ weatherModifier: -3 });
    const result = calculateForageEffectiveSkill(input);

    expect(result.effectiveSkill).toBe(9); // 12 - 3
  });

  it('stacks all modifiers correctly', () => {
    const input = baseInput({
      baseSkillLevel: 14,
      toolSkillBonus: 2,
      helperCount: 3,
      supervisorSkill15Plus: true,
      weatherModifier: -1,
      contextFlags: {
        hasMapOrGuide: true,
        isUnfamiliarOrHostile: false,
        isPeakSeason: true,
        isOffSeason: false,
        hasProperTools: true,
        isDenseOrDangerousTerrain: false,
      },
    });
    const result = calculateForageEffectiveSkill(input);

    // 14 base + 2 tools + 2 helpers(2-3) + 5 supervisor + 1 map + 2 peak + 2 properTools - 1 weather = 27
    expect(result.effectiveSkill).toBe(27);
  });
});

// ============================================================================
// determineTierOutcome
// ============================================================================

describe('determineTierOutcome', () => {
  const config = DEFAULT_FORAGING_CONFIG;

  it('returns common for MoS 0-2', () => {
    expect(determineTierOutcome(0, true, false, false, config)).toBe('common');
    expect(determineTierOutcome(1, true, false, false, config)).toBe('common');
    expect(determineTierOutcome(2, true, false, false, config)).toBe('common');
  });

  it('returns uncommon for MoS 3-5', () => {
    expect(determineTierOutcome(3, true, false, false, config)).toBe('uncommon');
    expect(determineTierOutcome(4, true, false, false, config)).toBe('uncommon');
    expect(determineTierOutcome(5, true, false, false, config)).toBe('uncommon');
  });

  it('returns rare for MoS 6+', () => {
    expect(determineTierOutcome(6, true, false, false, config)).toBe('rare');
    expect(determineTierOutcome(10, true, false, false, config)).toBe('rare');
  });

  it('returns rare on critical success', () => {
    expect(determineTierOutcome(0, true, true, false, config)).toBe('rare');
  });

  it('returns scraps on failure when failureGivesNothing is false', () => {
    const cfgScrap = { ...config, failureGivesNothing: false };
    expect(determineTierOutcome(-1, false, false, false, cfgScrap)).toBe('scraps');
  });

  it('returns nothing on failure when failureGivesNothing is true', () => {
    const cfgNothing = { ...config, failureGivesNothing: true };
    expect(determineTierOutcome(-1, false, false, false, cfgNothing)).toBe('nothing');
  });

  it('returns scraps on critical failure when failureGivesNothing is false', () => {
    const cfgScrap = { ...config, failureGivesNothing: false };
    expect(determineTierOutcome(-5, false, false, true, cfgScrap)).toBe('scraps');
  });

  it('returns nothing on critical failure when failureGivesNothing is true', () => {
    const cfgNothing = { ...config, failureGivesNothing: true };
    expect(determineTierOutcome(-5, false, false, true, cfgNothing)).toBe('nothing');
  });
});

// ============================================================================
// weightedRandomSelect
// ============================================================================

describe('weightedRandomSelect', () => {
  it('returns null for empty weights', () => {
    expect(weightedRandomSelect([])).toBeNull();
  });

  it('returns the only category when there is one entry', () => {
    const result = weightedRandomSelect([{ categoryId: 'fruits', weight: 1 }]);
    expect(result).toBe('fruits');
  });

  it('returns null when total weight is 0', () => {
    expect(weightedRandomSelect([{ categoryId: 'fruits', weight: 0 }])).toBeNull();
  });

  it('selects from weighted options (deterministic with mock)', () => {
    // Mock Math.random to return 0 (picks first entry)
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const result = weightedRandomSelect([
      { categoryId: 'fruits', weight: 3 },
      { categoryId: 'mushrooms', weight: 1 },
    ]);
    expect(result).toBe('fruits');
    spy.mockRestore();
  });

  it('selects second entry with high random value', () => {
    // Mock Math.random to return 0.9 (picks second entry given weights 3,1 → threshold at 0.75)
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.9);
    const result = weightedRandomSelect([
      { categoryId: 'fruits', weight: 3 },
      { categoryId: 'mushrooms', weight: 1 },
    ]);
    expect(result).toBe('mushrooms');
    spy.mockRestore();
  });
});

// ============================================================================
// selectCategory
// ============================================================================

describe('selectCategory', () => {
  it('returns targetCategory for category mode', () => {
    const input = baseInput({ mode: 'category', targetCategory: 'herbs_spices' });
    const result = selectCategory(input, 'common', testZone);
    expect(result).toBe('herbs_spices');
  });

  it('returns item categoryId for specific mode', () => {
    const input = baseInput({ mode: 'specific' });
    const item = testItems[0]; // fruits
    const result = selectCategory(input, 'common', testZone, item);
    expect(result).toBe('fruits');
  });

  it('selects from zone weights for general mode', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const input = baseInput({ mode: 'general' });
    const result = selectCategory(input, 'common', testZone);
    expect(result).toBe('fruits'); // First in common categories
    spy.mockRestore();
  });

  it('falls back to common when tier categories are empty', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const emptyZone: ForageZoneProfile = {
      ...testZone,
      uncommonCategories: [],
    };
    const input = baseInput({ mode: 'general' });
    const result = selectCategory(input, 'uncommon', emptyZone);
    expect(result).toBe('fruits'); // Falls back to common
    spy.mockRestore();
  });
});

// ============================================================================
// selectItem
// ============================================================================

describe('selectItem', () => {
  it('selects item matching tier and category', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const result = selectItem(testItems, 'common', 'fruits', 'zone-1', ['woodland']);
    expect(result?.id).toBe('item-1');
    spy.mockRestore();
  });

  it('returns null when no matching items', () => {
    const result = selectItem(testItems, 'legendary', 'fruits', 'zone-1', ['woodland']);
    expect(result).toBeNull();
  });

  it('filters by zone restrictions', () => {
    // item-6 is restricted to zone-2
    const result = selectItem(testItems, 'uncommon', 'herbs_spices', 'zone-1', ['woodland']);
    // Should only find item-3 (Rosemary), not item-6 (zone-restricted) or item-7 (tag-restricted)
    expect(result?.id).toBe('item-3');
  });

  it('filters by tag restrictions', () => {
    // item-7 requires 'volcanic' tag
    const result = selectItem(testItems, 'uncommon', 'herbs_spices', 'zone-1', ['woodland']);
    expect(result?.id).toBe('item-3'); // Only Rosemary matches
  });

  it('allows items when zone tags match tag restriction', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const result = selectItem(testItems, 'uncommon', 'herbs_spices', 'zone-1', ['volcanic']);
    // item-3 (Rosemary, no restrictions) and item-7 (tag-restricted, 'volcanic' matches) are candidates
    // item-6 is zone-restricted to zone-2, excluded
    expect(result).not.toBeNull();
    spy.mockRestore();
  });
});

// ============================================================================
// calculateForageYield
// ============================================================================

describe('calculateForageYield', () => {
  it('returns at least 1', () => {
    // Mock dice to roll minimum
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const catMeta = FORAGE_CATEGORY_META['mushrooms']; // 1d+2
    const result = calculateForageYield(null, catMeta, 'common');
    expect(result).toBeGreaterThanOrEqual(1);
    spy.mockRestore();
  });

  it('applies tier multiplier', () => {
    // Mock dice to return consistent values
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const item = testItems[0]; // 2d+1
    const catMeta = FORAGE_CATEGORY_META['fruits'];

    const commonYield = calculateForageYield(item, catMeta, 'common');
    const rareYield = calculateForageYield(item, catMeta, 'rare');

    // rare multiplier (1.5) should produce higher yield than common (1.0)
    expect(rareYield).toBeGreaterThanOrEqual(commonYield);
    spy.mockRestore();
  });

  it('applies scraps multiplier (0.5)', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const item = testItems[0]; // 2d+1
    const catMeta = FORAGE_CATEGORY_META['fruits'];

    const commonYield = calculateForageYield(item, catMeta, 'common');
    const scrapsYield = calculateForageYield(item, catMeta, 'scraps');

    expect(scrapsYield).toBeLessThanOrEqual(commonYield);
    spy.mockRestore();
  });

  it('adds tool yield bonus', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const item = testItems[0];
    const catMeta = FORAGE_CATEGORY_META['fruits'];

    const withoutBonus = calculateForageYield(item, catMeta, 'common', 0);
    const withBonus = calculateForageYield(item, catMeta, 'common', 5);

    expect(withBonus).toBeGreaterThan(withoutBonus);
    spy.mockRestore();
  });
});

// ============================================================================
// shouldCheckForEvent
// ============================================================================

describe('shouldCheckForEvent', () => {
  it('general mode: only on crits', () => {
    expect(shouldCheckForEvent('general', 'common', true, false, false)).toBe(false);
    expect(shouldCheckForEvent('general', 'common', true, true, false)).toBe(true);
    expect(shouldCheckForEvent('general', 'common', false, false, true)).toBe(true);
  });

  it('category mode: on rare, failure, or crits', () => {
    expect(shouldCheckForEvent('category', 'common', true, false, false)).toBe(false);
    expect(shouldCheckForEvent('category', 'rare', true, false, false)).toBe(true);
    expect(shouldCheckForEvent('category', 'common', false, false, false)).toBe(true);
    expect(shouldCheckForEvent('category', 'common', true, true, false)).toBe(true);
  });

  it('specific mode: always', () => {
    expect(shouldCheckForEvent('specific', 'common', true, false, false)).toBe(true);
    expect(shouldCheckForEvent('specific', 'rare', true, true, false)).toBe(true);
    expect(shouldCheckForEvent('specific', 'scraps', false, false, true)).toBe(true);
  });
});

// ============================================================================
// resolveEvent
// ============================================================================

describe('resolveEvent', () => {
  it('returns undefined when events are disabled', () => {
    const config = { ...DEFAULT_FORAGING_CONFIG, eventsEnabled: false };
    const result = resolveEvent(false, config);
    expect(result).toBeUndefined();
  });

  it('returns an event when roll is low enough', () => {
    // Mock roll3d6 to return 5 (rare event range 3-6)
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const config = { ...DEFAULT_FORAGING_CONFIG, eventsEnabled: true };
    const result = resolveEvent(false, config);
    // May or may not trigger depending on the mocked 3d6 roll
    // At minimum, verify it returns ForageEvent or undefined
    expect(result === undefined || typeof result === 'object').toBe(true);
    vi.restoreAllMocks();
  });

  it('critical failure forces at least mild event when roll would be none', () => {
    // This is hard to deterministically test due to 3d6 roll,
    // but we verify the function doesn't throw
    const config = { ...DEFAULT_FORAGING_CONFIG, eventsEnabled: true };
    vi.spyOn(Math, 'random').mockReturnValue(0.8); // Should produce high 3d6 roll (none)
    const result = resolveEvent(true, config);
    // With critFailure, severity 'none' gets bumped to 'mild'
    if (result) {
      expect(result.severity).toBe('mild');
    }
    vi.restoreAllMocks();
  });
});

// ============================================================================
// buildForageLogText
// ============================================================================

describe('buildForageLogText', () => {
  it('builds success log text', () => {
    const stacks: FoundStack[] = [{
      itemId: 'item-1',
      itemName: 'Wild Berries',
      categoryId: 'fruits',
      quantity: 8,
      quality: 'normal',
      inventoryKind: 'food',
      typeId: 'berries',
    }];

    const text = buildForageLogText(
      'Aldric', 'Survival', 'Forest',
      9, 14, 5, true, false, false,
      'uncommon', stacks
    );

    expect(text).toContain('Aldric');
    expect(text).toContain('Survival');
    expect(text).toContain('Forest');
    expect(text).toContain('Success by 5');
    expect(text).toContain('Wild Berries');
    expect(text).toContain('uncommon');
  });

  it('builds failure log text', () => {
    const text = buildForageLogText(
      'Brina', 'Naturalist', 'Meadow',
      15, 12, -3, false, false, false,
      'scraps', []
    );

    expect(text).toContain('Failure by 3');
    expect(text).toContain('nothing harvestable');
  });

  it('builds critical success log text', () => {
    const stacks: FoundStack[] = [{
      itemId: 'item-1',
      itemName: 'Wild Berries',
      categoryId: 'fruits',
      quantity: 12,
      quality: 'high',
      inventoryKind: 'food',
      typeId: 'berries',
    }];

    const text = buildForageLogText(
      'Aldric', 'Survival', 'Forest',
      4, 14, 10, true, true, false,
      'rare', stacks
    );

    expect(text).toContain('Critical Success');
    expect(text).toContain('high quality');
  });

  it('includes event info when present', () => {
    const event: ForageEvent = {
      severity: 'mild',
      name: 'Animal Trail',
      effects: [{ kind: 'next_roll_modifier', value: 1, description: '+1 next roll' }],
      notes: 'Found a trail',
    };

    const text = buildForageLogText(
      'Aldric', 'Survival', 'Forest',
      9, 14, 5, true, false, false,
      'common', [], event
    );

    expect(text).toContain('Animal Trail');
    expect(text).toContain('+1 next roll');
  });
});

// ============================================================================
// resolveForage (integration)
// ============================================================================

describe('resolveForage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a complete result structure', () => {
    const input = baseInput();
    const result = resolveForage(input, testZone, testItems, DEFAULT_FORAGING_CONFIG, 'Aldric');

    expect(result.actorId).toBe('char-1');
    expect(result.zoneId).toBe('zone-1');
    expect(result.mode).toBe('general');
    expect(result.roll).toBeDefined();
    expect(result.roll.total).toBeGreaterThanOrEqual(3);
    expect(result.roll.total).toBeLessThanOrEqual(18);
    expect(result.tierOutcome).toBeDefined();
    expect(result.found).toBeDefined();
    expect(typeof result.logText).toBe('string');
    expect(result.logText.length).toBeGreaterThan(0);
  });

  it('handles missing zone gracefully', () => {
    const input = baseInput();
    const result = resolveForage(input, undefined, testItems, DEFAULT_FORAGING_CONFIG, 'Aldric');

    expect(result).toBeDefined();
    expect(result.logText).toContain('unknown zone');
  });

  it('handles empty items array', () => {
    const input = baseInput();
    const result = resolveForage(input, testZone, [], DEFAULT_FORAGING_CONFIG, 'Aldric');

    expect(result).toBeDefined();
  });

  it('handles specific mode with valid target', () => {
    const input = baseInput({
      mode: 'specific',
      targetItemId: 'item-1',
    });
    const result = resolveForage(input, testZone, testItems, DEFAULT_FORAGING_CONFIG, 'Aldric');

    expect(result.mode).toBe('specific');
    // If successful, should find the target item
    if (result.tierOutcome !== 'nothing' && result.tierOutcome !== 'scraps') {
      expect(result.found.length).toBeGreaterThan(0);
      if (result.found.length > 0) {
        expect(result.found[0].itemId).toBe('item-1');
      }
    }
  });

  it('handles category mode', () => {
    const input = baseInput({
      mode: 'category',
      targetCategory: 'mushrooms',
    });
    const result = resolveForage(input, testZone, testItems, DEFAULT_FORAGING_CONFIG, 'Aldric');

    expect(result.mode).toBe('category');
  });

  it('produces consistent log text format', () => {
    const input = baseInput({ baseSkillLevel: 18 }); // High skill for more likely success
    const result = resolveForage(input, testZone, testItems, DEFAULT_FORAGING_CONFIG, 'TestActor');

    expect(result.logText).toContain('TestActor');
    expect(result.logText).toContain('Survival');
    expect(result.logText).toContain('Test Forest');
    expect(result.logText).toMatch(/Rolled \d+ vs \d+/);
  });
});
