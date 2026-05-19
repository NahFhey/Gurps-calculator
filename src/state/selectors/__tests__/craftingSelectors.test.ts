import { describe, expect, it } from 'vitest';
import { initialCampaignState, type CampaignState } from '../../campaignReducer';
import type {
  Craft,
  CraftDesign,
  CustomTemplates,
} from '../../../types/campaign';
import {
  selectCraftsRecord,
  selectAllCrafts,
  selectCraftById,
  selectCraftsByPhase,
  selectActiveCrafts,
  selectCompletedCrafts,
  selectCraftCount,
  selectActiveCraftCount,
  selectCraftDesignsRecord,
  selectAllCraftDesigns,
  selectCraftDesignById,
  selectCraftDesignCount,
  selectCustomTemplates,
  selectCustomTemplatesByCategory,
  selectWeaponTemplates,
  selectArmorTemplates,
  selectRangedTemplates,
  selectExplosivesTemplates,
  selectCurrentCraftingProjectId,
  selectCurrentCraftingProject,
} from '../craftingSelectors';

const craftSetup: Craft = {
  id: 'c1',
  phase: 'setup',
  templateType: 'weapons',
  template: 'Longsword',
  quality: 'good',
  currentQuality: 'good',
  mods: [],
  selectedMaterials: [],
  shifts: [],
  startDate: '2026-01-01',
  startDay: 1,
};
const craftDesign: Craft = { ...craftSetup, id: 'c2', phase: 'design' };
const craftComplete: Craft = { ...craftSetup, id: 'c3', phase: 'complete' };

const designA: CraftDesign = {
  id: 'd1',
  name: 'My Sword',
  templateType: 'weapons',
  template: 'Longsword',
  quality: 'good',
  mods: [],
  selectedMaterials: [],
  savedDate: '2026-01-01',
};

const customTemplates: CustomTemplates = {
  weapons: { mySword: { name: 'My Sword' } as CustomTemplates['weapons'][string] },
  armor: { myArmor: { name: 'My Armor' } as CustomTemplates['armor'][string] },
  ranged: { myBow: { name: 'My Bow' } as CustomTemplates['ranged'][string] },
  explosives: { myBomb: { name: 'My Bomb' } as CustomTemplates['explosives'][string] },
};

function buildState(): CampaignState {
  const base = initialCampaignState;
  return {
    ...base,
    entities: {
      ...base.entities,
      crafts: { c1: craftSetup, c2: craftDesign, c3: craftComplete },
      craftDesigns: { d1: designA },
      customTemplates,
    },
    crafting: { currentProject: 'c1' },
  };
}

describe('craftingSelectors — crafts', () => {
  it('returns craft record and array', () => {
    const state = buildState();
    expect(selectCraftsRecord(state)).toEqual({
      c1: craftSetup,
      c2: craftDesign,
      c3: craftComplete,
    });
    expect(selectAllCrafts(state)).toHaveLength(3);
  });

  it('selects a craft by id and undefined for missing', () => {
    const state = buildState();
    expect(selectCraftById(state, 'c1')).toEqual(craftSetup);
    expect(selectCraftById(state, 'missing')).toBeUndefined();
  });

  it('filters crafts by phase', () => {
    const state = buildState();
    expect(selectCraftsByPhase(state, 'setup')).toEqual([craftSetup]);
    expect(selectCraftsByPhase(state, 'design')).toEqual([craftDesign]);
    expect(selectCraftsByPhase(state, 'craft')).toEqual([]);
  });

  it('selects active and completed crafts', () => {
    const state = buildState();
    expect(selectActiveCrafts(state)).toEqual([craftSetup, craftDesign]);
    expect(selectCompletedCrafts(state)).toEqual([craftComplete]);
  });

  it('returns craft counts', () => {
    const state = buildState();
    expect(selectCraftCount(state)).toBe(3);
    expect(selectActiveCraftCount(state)).toBe(2);
    expect(selectCraftCount(initialCampaignState)).toBe(0);
    expect(selectActiveCraftCount(initialCampaignState)).toBe(0);
  });
});

describe('craftingSelectors — designs', () => {
  it('returns design record and array', () => {
    const state = buildState();
    expect(selectCraftDesignsRecord(state)).toEqual({ d1: designA });
    expect(selectAllCraftDesigns(state)).toEqual([designA]);
  });

  it('selects design by id and undefined for missing', () => {
    const state = buildState();
    expect(selectCraftDesignById(state, 'd1')).toEqual(designA);
    expect(selectCraftDesignById(state, 'missing')).toBeUndefined();
  });

  it('returns design count', () => {
    expect(selectCraftDesignCount(buildState())).toBe(1);
    expect(selectCraftDesignCount(initialCampaignState)).toBe(0);
  });
});

describe('craftingSelectors — custom templates', () => {
  it('returns the full custom templates object', () => {
    expect(selectCustomTemplates(buildState())).toEqual(customTemplates);
  });

  it('selects templates by category', () => {
    const state = buildState();
    expect(selectCustomTemplatesByCategory(state, 'weapons')).toEqual(customTemplates.weapons);
    expect(selectCustomTemplatesByCategory(state, 'armor')).toEqual(customTemplates.armor);
  });

  it('exposes per-category convenience selectors', () => {
    const state = buildState();
    expect(selectWeaponTemplates(state)).toEqual(customTemplates.weapons);
    expect(selectArmorTemplates(state)).toEqual(customTemplates.armor);
    expect(selectRangedTemplates(state)).toEqual(customTemplates.ranged);
    expect(selectExplosivesTemplates(state)).toEqual(customTemplates.explosives);
  });

  it('returns empty template buckets on initial state', () => {
    expect(selectWeaponTemplates(initialCampaignState)).toEqual({});
    expect(selectArmorTemplates(initialCampaignState)).toEqual({});
    expect(selectRangedTemplates(initialCampaignState)).toEqual({});
    expect(selectExplosivesTemplates(initialCampaignState)).toEqual({});
  });
});

describe('craftingSelectors — UI state', () => {
  it('returns current crafting project id and resolved craft', () => {
    const state = buildState();
    expect(selectCurrentCraftingProjectId(state)).toBe('c1');
    expect(selectCurrentCraftingProject(state)).toEqual(craftSetup);
  });

  it('returns undefined when no current project set', () => {
    const state: CampaignState = { ...buildState(), crafting: { currentProject: null } };
    expect(selectCurrentCraftingProjectId(state)).toBeNull();
    expect(selectCurrentCraftingProject(state)).toBeUndefined();
  });

  it('returns undefined craft when current project id points to missing craft', () => {
    const state: CampaignState = { ...buildState(), crafting: { currentProject: 'missing' } };
    expect(selectCurrentCraftingProject(state)).toBeUndefined();
  });
});
