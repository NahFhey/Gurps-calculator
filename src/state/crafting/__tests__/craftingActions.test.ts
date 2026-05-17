import { describe, expect, it } from 'vitest';
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
  isCraftingAction,
  type CraftingAction
} from '../craftingActions';
import type { Craft, CraftDesign, CustomTemplates } from '../../../types/campaign';

const mockCraft = (overrides?: Partial<Craft>): Craft =>
  ({
    id: 'craft-1',
    name: 'Iron Sword',
    ...overrides
  }) as Craft;

const mockDesign = (overrides?: Partial<CraftDesign>): CraftDesign =>
  ({
    id: 'design-1',
    name: 'Sword Design',
    ...overrides
  }) as CraftDesign;

const mockTemplates = (overrides?: Partial<CustomTemplates>): CustomTemplates =>
  ({
    ...overrides
  }) as CustomTemplates;

describe('craftingActions', () => {
  describe('action type constants', () => {
    it('exposes stable string literals', () => {
      expect(CRAFT_ADD).toBe('addCraft');
      expect(CRAFT_UPDATE).toBe('updateCraft');
      expect(CRAFT_REMOVE).toBe('removeCraft');
      expect(CRAFT_COMPLETE).toBe('completeCraft');
      expect(CRAFTS_SET).toBe('setCrafts');
      expect(CRAFT_DESIGN_ADD).toBe('addCraftDesign');
      expect(CRAFT_DESIGN_UPDATE).toBe('updateCraftDesign');
      expect(CRAFT_DESIGN_REMOVE).toBe('removeCraftDesign');
      expect(CRAFT_DESIGNS_SET).toBe('setCraftDesigns');
      expect(CUSTOM_TEMPLATES_SET).toBe('setCustomTemplates');
      expect(CUSTOM_TEMPLATE_ADD).toBe('addCustomTemplate');
    });

    it('constants are all unique', () => {
      const values = [
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
        CUSTOM_TEMPLATE_ADD
      ];
      expect(new Set(values).size).toBe(values.length);
    });
  });

  describe('isCraftingAction', () => {
    it('returns true for craft actions', () => {
      const add: CraftingAction = { type: CRAFT_ADD, payload: mockCraft() };
      const update: CraftingAction = {
        type: CRAFT_UPDATE,
        payload: { id: 'craft-1', changes: { name: 'Renamed' } }
      };
      const remove: CraftingAction = { type: CRAFT_REMOVE, payload: 'craft-1' };
      const complete: CraftingAction = {
        type: CRAFT_COMPLETE,
        payload: { id: 'craft-1', finalStats: undefined as unknown as Craft['finalStats'] }
      };
      const set: CraftingAction = {
        type: CRAFTS_SET,
        payload: { 'craft-1': mockCraft() }
      };
      expect(isCraftingAction(add)).toBe(true);
      expect(isCraftingAction(update)).toBe(true);
      expect(isCraftingAction(remove)).toBe(true);
      expect(isCraftingAction(complete)).toBe(true);
      expect(isCraftingAction(set)).toBe(true);
    });

    it('returns true for craft design actions', () => {
      const add: CraftingAction = { type: CRAFT_DESIGN_ADD, payload: mockDesign() };
      const update: CraftingAction = {
        type: CRAFT_DESIGN_UPDATE,
        payload: { id: 'design-1', changes: { name: 'Renamed' } }
      };
      const remove: CraftingAction = { type: CRAFT_DESIGN_REMOVE, payload: 'design-1' };
      const set: CraftingAction = {
        type: CRAFT_DESIGNS_SET,
        payload: { 'design-1': mockDesign() }
      };
      expect(isCraftingAction(add)).toBe(true);
      expect(isCraftingAction(update)).toBe(true);
      expect(isCraftingAction(remove)).toBe(true);
      expect(isCraftingAction(set)).toBe(true);
    });

    it('returns true for custom template actions', () => {
      const set: CraftingAction = {
        type: CUSTOM_TEMPLATES_SET,
        payload: mockTemplates()
      };
      const add: CraftingAction = {
        type: CUSTOM_TEMPLATE_ADD,
        payload: { category: 'weapons' as keyof CustomTemplates, templateName: 'foo', template: {} }
      };
      expect(isCraftingAction(set)).toBe(true);
      expect(isCraftingAction(add)).toBe(true);
    });

    it('returns false for unrelated action types', () => {
      expect(isCraftingAction({ type: 'addCharacter' })).toBe(false);
      expect(isCraftingAction({ type: 'startCombat' })).toBe(false);
      expect(isCraftingAction({ type: 'addAlchemyReagent' })).toBe(false);
    });

    it('returns false for empty string type', () => {
      expect(isCraftingAction({ type: '' })).toBe(false);
    });

    it('returns false for substrings or near-misses', () => {
      expect(isCraftingAction({ type: 'craft' })).toBe(false);
      expect(isCraftingAction({ type: 'Craft' })).toBe(false);
      expect(isCraftingAction({ type: 'addCrafting' })).toBe(false);
    });

    it('narrows the action type for TypeScript consumers', () => {
      const unknownAction: { type: string; payload?: unknown } = {
        type: CRAFT_ADD,
        payload: mockCraft()
      };
      if (isCraftingAction(unknownAction)) {
        expect([
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
          CUSTOM_TEMPLATE_ADD
        ]).toContain(unknownAction.type);
      } else {
        throw new Error('expected type guard to accept CRAFT_ADD');
      }
    });
  });
});
