import { describe, expect, it, beforeEach } from 'vitest';
import { produce } from 'immer';
import { handleCraftingAction } from '../craftingReducer';
import {
  CRAFT_ADD,
  CRAFT_UPDATE,
  CRAFT_REMOVE,
  CRAFT_COMPLETE,
  CRAFTS_SET,
  CRAFT_DESIGN_ADD,
  CRAFT_DESIGN_UPDATE,
  CRAFT_DESIGN_REMOVE,
  CRAFT_DESIGNS_SET,
  CUSTOM_TEMPLATES_SET,
  CUSTOM_TEMPLATE_ADD,
  type CraftingAction
} from '../craftingActions';
import type { CampaignState } from '../../campaignReducer';
import type { Craft, CraftDesign, CustomTemplates } from '../../../types/campaign';

const createCraft = (overrides?: Partial<Craft>): Craft => ({
  id: 'craft-1',
  phase: 'setup',
  templateType: 'weapons',
  template: 'Broadsword',
  quality: 'fine',
  currentQuality: 'fine',
  mods: [],
  selectedMaterials: [],
  shifts: [],
  startDate: '2026-01-01',
  startDay: 1,
  ...overrides
});

const createDesign = (overrides?: Partial<CraftDesign>): CraftDesign => ({
  id: 'design-1',
  name: 'Standard Broadsword',
  templateType: 'weapons',
  template: 'Broadsword',
  quality: 'fine',
  mods: [],
  selectedMaterials: [],
  savedDate: '2026-01-01',
  ...overrides
});

const createCustomTemplates = (): CustomTemplates => ({
  weapons: {},
  armor: {},
  ranged: {},
  explosives: {}
});

const createMinimalCampaignState = (): CampaignState => (({
  entities: {
    crafts: {},
    craftDesigns: {},
    customTemplates: createCustomTemplates()
  }
} as unknown)) as CampaignState;

function applyAction(state: CampaignState, action: CraftingAction): CampaignState {
  return produce(state, draft => {
    handleCraftingAction(draft, action);
  });
}

describe('craftingReducer', () => {
  let state: CampaignState;

  beforeEach(() => {
    state = createMinimalCampaignState();
  });

  describe('crafts', () => {
    it('CRAFT_ADD adds a craft', () => {
      const craft = createCraft();
      const next = applyAction(state, { type: CRAFT_ADD, payload: craft });
      expect(next.entities.crafts['craft-1']).toEqual(craft);
    });

    it('CRAFT_UPDATE merges changes into an existing craft', () => {
      state = applyAction(state, { type: CRAFT_ADD, payload: createCraft() });
      const next = applyAction(state, {
        type: CRAFT_UPDATE,
        payload: { id: 'craft-1', changes: { phase: 'craft', name: 'Hero Blade' } }
      });
      expect(next.entities.crafts['craft-1'].phase).toBe('craft');
      expect(next.entities.crafts['craft-1'].name).toBe('Hero Blade');
      expect(next.entities.crafts['craft-1'].template).toBe('Broadsword');
    });

    it('CRAFT_UPDATE is a no-op when the craft does not exist', () => {
      const next = applyAction(state, {
        type: CRAFT_UPDATE,
        payload: { id: 'missing', changes: { phase: 'craft' } }
      });
      expect(next.entities.crafts['missing']).toBeUndefined();
    });

    it('CRAFT_REMOVE deletes the craft', () => {
      state = applyAction(state, { type: CRAFT_ADD, payload: createCraft() });
      const next = applyAction(state, { type: CRAFT_REMOVE, payload: 'craft-1' });
      expect(next.entities.crafts['craft-1']).toBeUndefined();
    });

    it('CRAFT_COMPLETE marks craft complete and sets finalStats', () => {
      state = applyAction(state, { type: CRAFT_ADD, payload: createCraft() });
      const finalStats = { weight: 3, hp: 12, ht: 11, damage: 'sw+1 cut' };
      const next = applyAction(state, {
        type: CRAFT_COMPLETE,
        payload: { id: 'craft-1', finalStats }
      });
      expect(next.entities.crafts['craft-1'].phase).toBe('complete');
      expect(next.entities.crafts['craft-1'].finalStats).toEqual(finalStats);
    });

    it('CRAFT_COMPLETE is a no-op when the craft does not exist', () => {
      const next = applyAction(state, {
        type: CRAFT_COMPLETE,
        payload: { id: 'missing', finalStats: { weight: 1, hp: 1, ht: 1 } }
      });
      expect(next.entities.crafts['missing']).toBeUndefined();
    });

    it('CRAFTS_SET replaces the entire crafts map', () => {
      state = applyAction(state, { type: CRAFT_ADD, payload: createCraft() });
      const replacement = { 'craft-2': createCraft({ id: 'craft-2', template: 'Dagger' }) };
      const next = applyAction(state, { type: CRAFTS_SET, payload: replacement });
      expect(next.entities.crafts).toEqual(replacement);
      expect(next.entities.crafts['craft-1']).toBeUndefined();
    });
  });

  describe('craft designs', () => {
    it('CRAFT_DESIGN_ADD adds a design', () => {
      const design = createDesign();
      const next = applyAction(state, { type: CRAFT_DESIGN_ADD, payload: design });
      expect(next.entities.craftDesigns['design-1']).toEqual(design);
    });

    it('CRAFT_DESIGN_UPDATE merges changes into an existing design', () => {
      state = applyAction(state, { type: CRAFT_DESIGN_ADD, payload: createDesign() });
      const next = applyAction(state, {
        type: CRAFT_DESIGN_UPDATE,
        payload: { id: 'design-1', changes: { name: 'Master Blade' } }
      });
      expect(next.entities.craftDesigns['design-1'].name).toBe('Master Blade');
      expect(next.entities.craftDesigns['design-1'].template).toBe('Broadsword');
    });

    it('CRAFT_DESIGN_UPDATE is a no-op when the design does not exist', () => {
      const next = applyAction(state, {
        type: CRAFT_DESIGN_UPDATE,
        payload: { id: 'missing', changes: { name: 'Nothing' } }
      });
      expect(next.entities.craftDesigns['missing']).toBeUndefined();
    });

    it('CRAFT_DESIGN_REMOVE deletes the design', () => {
      state = applyAction(state, { type: CRAFT_DESIGN_ADD, payload: createDesign() });
      const next = applyAction(state, { type: CRAFT_DESIGN_REMOVE, payload: 'design-1' });
      expect(next.entities.craftDesigns['design-1']).toBeUndefined();
    });

    it('CRAFT_DESIGNS_SET replaces the entire designs map', () => {
      state = applyAction(state, { type: CRAFT_DESIGN_ADD, payload: createDesign() });
      const replacement = { 'design-2': createDesign({ id: 'design-2', name: 'Cheap Knife' }) };
      const next = applyAction(state, { type: CRAFT_DESIGNS_SET, payload: replacement });
      expect(next.entities.craftDesigns).toEqual(replacement);
      expect(next.entities.craftDesigns['design-1']).toBeUndefined();
    });
  });

  describe('custom templates', () => {
    it('CUSTOM_TEMPLATES_SET replaces the entire custom templates map', () => {
      const replacement: CustomTemplates = {
        weapons: { Katana: { name: 'Katana', weight: 3, hp: 12, damage: 'sw+2 cut', reach: '1,2', materials: [] } },
        armor: {},
        ranged: {},
        explosives: {}
      };
      const next = applyAction(state, { type: CUSTOM_TEMPLATES_SET, payload: replacement });
      expect(next.entities.customTemplates).toEqual(replacement);
    });

    it('CUSTOM_TEMPLATE_ADD inserts a template into the right category', () => {
      const template = { name: 'Katana', weight: 3, hp: 12, damage: 'sw+2 cut', reach: '1,2', materials: [] };
      const next = applyAction(state, {
        type: CUSTOM_TEMPLATE_ADD,
        payload: { category: 'weapons', templateName: 'Katana', template }
      });
      expect(next.entities.customTemplates.weapons['Katana']).toEqual(template);
    });
  });

  describe('action handling', () => {
    it('returns true for handled crafting actions', () => {
      const draft = createMinimalCampaignState();
      const handled = handleCraftingAction(draft, { type: CRAFT_ADD, payload: createCraft() });
      expect(handled).toBe(true);
    });

    it('returns false for unknown action types', () => {
      const draft = createMinimalCampaignState();
      const handled = handleCraftingAction(draft, { type: 'unknown' } as unknown as CraftingAction);
      expect(handled).toBe(false);
    });
  });
});
