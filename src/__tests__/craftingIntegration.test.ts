/**
 * Crafting Project Lifecycle Integration Tests
 *
 * End-to-end tests for the crafting workflow:
 * create project → advance through phases → add work shifts
 * → complete project → verify final stats → save/load designs.
 *
 * Tests exercise the campaign reducer directly — no UI, no store wrapper.
 */

import { describe, expect, it } from 'vitest';
import {
  campaignReducer,
  createCampaignState,
  type CampaignAction,
} from '../state/campaignReducer';
import type { Craft, CraftDesign } from '../types/campaign';

// ============================================================================
// TEST FIXTURES
// ============================================================================

function createCraft(overrides?: Partial<Craft>): Craft {
  return {
    id: 'craft-longsword',
    phase: 'setup',
    templateType: 'weapons',
    template: 'Longsword',
    quality: 'good',
    currentQuality: 'good',
    name: 'Steel Longsword',
    mods: [],
    selectedMaterials: [
      {
        requirementIndex: 0,
        requiredType: 'metal',
        requiredAmount: 3,
        selectedMaterialId: 'mat-steel',
      },
    ],
    shifts: [],
    designShifts: [],
    startDate: '2026-01-01',
    startDay: 1,
    ...overrides,
  };
}

function createShift(overrides?: Record<string, unknown>) {
  return {
    id: `shift-${Date.now()}`,
    date: '2026-01-01',
    day: 1,
    worker: 'smith-1',
    skill: 14,
    roll: 10,
    effectiveSkill: 14,
    result: 'Success',
    hoursAdded: 8,
    qualityChange: 0,
    phase: 'craft',
    ...overrides,
  };
}

function createCraftDesign(overrides?: Partial<CraftDesign>): CraftDesign {
  return {
    id: 'design-longsword',
    name: 'Steel Longsword Design',
    templateType: 'weapons',
    template: 'Longsword',
    quality: 'good',
    mods: [],
    selectedMaterials: [
      {
        requirementIndex: 0,
        requiredType: 'metal',
        requiredAmount: 3,
        selectedMaterialId: 'mat-steel',
      },
    ],
    savedDate: '2026-01-01',
    ...overrides,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('Crafting Project Lifecycle Integration', () => {
  // --------------------------------------------------------------------------
  // Project creation
  // --------------------------------------------------------------------------

  describe('project creation', () => {
    it('addCraft stores a new project in entities.crafts', () => {
      const state = createCampaignState();
      const craft = createCraft();

      const next = campaignReducer(state, {
        type: 'addCraft' as CampaignAction['type'],
        payload: craft,
      } as CampaignAction);

      expect(next.entities.crafts['craft-longsword']).toBeDefined();
      expect(next.entities.crafts['craft-longsword'].phase).toBe('setup');
      expect(next.entities.crafts['craft-longsword'].template).toBe('Longsword');
    });

    it('multiple projects can coexist', () => {
      let state = createCampaignState();

      state = campaignReducer(state, {
        type: 'addCraft' as CampaignAction['type'],
        payload: createCraft({ id: 'craft-1', template: 'Longsword' }),
      } as CampaignAction);

      state = campaignReducer(state, {
        type: 'addCraft' as CampaignAction['type'],
        payload: createCraft({ id: 'craft-2', template: 'Shield', templateType: 'armor' }),
      } as CampaignAction);

      expect(Object.keys(state.entities.crafts)).toHaveLength(2);
    });
  });

  // --------------------------------------------------------------------------
  // Phase progression
  // --------------------------------------------------------------------------

  describe('phase progression', () => {
    it('project advances through setup → design → craft → complete', () => {
      let state = createCampaignState();
      const craft = createCraft();

      // Add in setup phase
      state = campaignReducer(state, {
        type: 'addCraft' as CampaignAction['type'],
        payload: craft,
      } as CampaignAction);
      expect(state.entities.crafts['craft-longsword'].phase).toBe('setup');

      // Advance to design
      state = campaignReducer(state, {
        type: 'updateCraft' as CampaignAction['type'],
        payload: { id: 'craft-longsword', changes: { phase: 'design' } },
      } as CampaignAction);
      expect(state.entities.crafts['craft-longsword'].phase).toBe('design');

      // Advance to craft
      state = campaignReducer(state, {
        type: 'updateCraft' as CampaignAction['type'],
        payload: { id: 'craft-longsword', changes: { phase: 'craft' } },
      } as CampaignAction);
      expect(state.entities.crafts['craft-longsword'].phase).toBe('craft');

      // Complete
      state = campaignReducer(state, {
        type: 'completeCraft' as CampaignAction['type'],
        payload: {
          id: 'craft-longsword',
          finalStats: { weight: 4.0, hp: 10, ht: 12, damage: '2d+3' },
        },
      } as CampaignAction);
      expect(state.entities.crafts['craft-longsword'].phase).toBe('complete');
      expect(state.entities.crafts['craft-longsword'].finalStats).toBeDefined();
      expect(state.entities.crafts['craft-longsword'].finalStats!.damage).toBe('2d+3');
    });
  });

  // --------------------------------------------------------------------------
  // Work shifts
  // --------------------------------------------------------------------------

  describe('work shifts', () => {
    it('design shifts accumulate during design phase', () => {
      let state = createCampaignState();

      state = campaignReducer(state, {
        type: 'addCraft' as CampaignAction['type'],
        payload: createCraft({ phase: 'design' }),
      } as CampaignAction);

      const designShift = createShift({ phase: 'design', day: 1 });

      state = campaignReducer(state, {
        type: 'updateCraft' as CampaignAction['type'],
        payload: {
          id: 'craft-longsword',
          changes: { designShifts: [designShift] },
        },
      } as CampaignAction);

      expect(state.entities.crafts['craft-longsword'].designShifts).toHaveLength(1);
      expect(state.entities.crafts['craft-longsword'].designShifts![0].phase).toBe('design');
    });

    it('craft shifts accumulate during craft phase', () => {
      let state = createCampaignState();

      state = campaignReducer(state, {
        type: 'addCraft' as CampaignAction['type'],
        payload: createCraft({ phase: 'craft' }),
      } as CampaignAction);

      const shift1 = createShift({ day: 1, roll: 10 });
      const shift2 = createShift({ day: 2, roll: 8 });

      state = campaignReducer(state, {
        type: 'updateCraft' as CampaignAction['type'],
        payload: {
          id: 'craft-longsword',
          changes: { shifts: [shift1] },
        },
      } as CampaignAction);

      state = campaignReducer(state, {
        type: 'updateCraft' as CampaignAction['type'],
        payload: {
          id: 'craft-longsword',
          changes: { shifts: [shift1, shift2] },
        },
      } as CampaignAction);

      expect(state.entities.crafts['craft-longsword'].shifts).toHaveLength(2);
    });

    it('quality can change based on shift results', () => {
      let state = createCampaignState();

      state = campaignReducer(state, {
        type: 'addCraft' as CampaignAction['type'],
        payload: createCraft({ phase: 'craft', quality: 'good', currentQuality: 'good' }),
      } as CampaignAction);

      // Simulate a critical success improving quality
      state = campaignReducer(state, {
        type: 'updateCraft' as CampaignAction['type'],
        payload: {
          id: 'craft-longsword',
          changes: { currentQuality: 'fine' },
        },
      } as CampaignAction);

      expect(state.entities.crafts['craft-longsword'].quality).toBe('good'); // intent unchanged
      expect(state.entities.crafts['craft-longsword'].currentQuality).toBe('fine'); // actual quality upgraded
    });
  });

  // --------------------------------------------------------------------------
  // Completion
  // --------------------------------------------------------------------------

  describe('project completion', () => {
    it('completeCraft sets phase to complete with finalStats', () => {
      let state = createCampaignState();

      state = campaignReducer(state, {
        type: 'addCraft' as CampaignAction['type'],
        payload: createCraft({ phase: 'craft' }),
      } as CampaignAction);

      state = campaignReducer(state, {
        type: 'completeCraft' as CampaignAction['type'],
        payload: {
          id: 'craft-longsword',
          finalStats: {
            weight: 4.0,
            hp: 10,
            ht: 12,
            damage: '2d+3',
          },
        },
      } as CampaignAction);

      const craft = state.entities.crafts['craft-longsword'];
      expect(craft.phase).toBe('complete');
      expect(craft.finalStats).toEqual({
        weight: 4.0,
        hp: 10,
        ht: 12,
        damage: '2d+3',
      });
    });

    it('completed projects can be removed', () => {
      let state = createCampaignState();

      state = campaignReducer(state, {
        type: 'addCraft' as CampaignAction['type'],
        payload: createCraft({ phase: 'complete' }),
      } as CampaignAction);

      expect(state.entities.crafts['craft-longsword']).toBeDefined();

      state = campaignReducer(state, {
        type: 'removeCraft' as CampaignAction['type'],
        payload: 'craft-longsword',
      } as CampaignAction);

      expect(state.entities.crafts['craft-longsword']).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // Craft designs (save/load templates)
  // --------------------------------------------------------------------------

  describe('craft designs', () => {
    it('addCraftDesign saves a design template', () => {
      const state = createCampaignState();
      const design = createCraftDesign();

      const next = campaignReducer(state, {
        type: 'addCraftDesign' as CampaignAction['type'],
        payload: design,
      } as CampaignAction);

      expect(next.entities.craftDesigns['design-longsword']).toBeDefined();
      expect(next.entities.craftDesigns['design-longsword'].template).toBe('Longsword');
    });

    it('designs persist independently of active projects', () => {
      let state = createCampaignState();

      // Save a design
      state = campaignReducer(state, {
        type: 'addCraftDesign' as CampaignAction['type'],
        payload: createCraftDesign(),
      } as CampaignAction);

      // Create and remove a project — design should still exist
      state = campaignReducer(state, {
        type: 'addCraft' as CampaignAction['type'],
        payload: createCraft(),
      } as CampaignAction);

      state = campaignReducer(state, {
        type: 'removeCraft' as CampaignAction['type'],
        payload: 'craft-longsword',
      } as CampaignAction);

      expect(state.entities.crafts['craft-longsword']).toBeUndefined();
      expect(state.entities.craftDesigns['design-longsword']).toBeDefined();
    });

    it('designs can be updated', () => {
      let state = createCampaignState();

      state = campaignReducer(state, {
        type: 'addCraftDesign' as CampaignAction['type'],
        payload: createCraftDesign(),
      } as CampaignAction);

      state = campaignReducer(state, {
        type: 'updateCraftDesign' as CampaignAction['type'],
        payload: {
          id: 'design-longsword',
          changes: { name: 'Updated Longsword Design', quality: 'fine' },
        },
      } as CampaignAction);

      expect(state.entities.craftDesigns['design-longsword'].name).toBe('Updated Longsword Design');
      expect(state.entities.craftDesigns['design-longsword'].quality).toBe('fine');
    });

    it('designs can be removed', () => {
      let state = createCampaignState();

      state = campaignReducer(state, {
        type: 'addCraftDesign' as CampaignAction['type'],
        payload: createCraftDesign(),
      } as CampaignAction);

      state = campaignReducer(state, {
        type: 'removeCraftDesign' as CampaignAction['type'],
        payload: 'design-longsword',
      } as CampaignAction);

      expect(state.entities.craftDesigns['design-longsword']).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // Batch operations
  // --------------------------------------------------------------------------

  describe('batch operations', () => {
    it('setCrafts replaces all crafts at once', () => {
      let state = createCampaignState();

      // Add two crafts individually
      state = campaignReducer(state, {
        type: 'addCraft' as CampaignAction['type'],
        payload: createCraft({ id: 'craft-1' }),
      } as CampaignAction);
      state = campaignReducer(state, {
        type: 'addCraft' as CampaignAction['type'],
        payload: createCraft({ id: 'craft-2' }),
      } as CampaignAction);

      expect(Object.keys(state.entities.crafts)).toHaveLength(2);

      // Replace all with a single craft
      state = campaignReducer(state, {
        type: 'setCrafts' as CampaignAction['type'],
        payload: { 'craft-new': createCraft({ id: 'craft-new', template: 'Axe' }) },
      } as CampaignAction);

      expect(Object.keys(state.entities.crafts)).toHaveLength(1);
      expect(state.entities.crafts['craft-new'].template).toBe('Axe');
    });
  });

  // --------------------------------------------------------------------------
  // Full lifecycle scenario
  // --------------------------------------------------------------------------

  describe('full lifecycle scenario', () => {
    it('complete workflow: create → design → craft with shifts → complete → save design → remove', () => {
      let state = createCampaignState();

      // 1. Create project
      state = campaignReducer(state, {
        type: 'addCraft' as CampaignAction['type'],
        payload: createCraft(),
      } as CampaignAction);

      // 2. Move to design
      state = campaignReducer(state, {
        type: 'updateCraft' as CampaignAction['type'],
        payload: { id: 'craft-longsword', changes: { phase: 'design' } },
      } as CampaignAction);

      // 3. Add design shift
      state = campaignReducer(state, {
        type: 'updateCraft' as CampaignAction['type'],
        payload: {
          id: 'craft-longsword',
          changes: {
            designShifts: [createShift({ phase: 'design', day: 1, roll: 11, result: 'Success' })],
          },
        },
      } as CampaignAction);

      // 4. Move to craft
      state = campaignReducer(state, {
        type: 'updateCraft' as CampaignAction['type'],
        payload: { id: 'craft-longsword', changes: { phase: 'craft' } },
      } as CampaignAction);

      // 5. Add multiple work shifts over several days
      const shifts = [
        createShift({ day: 2, roll: 10, result: 'Success', hoursAdded: 8 }),
        createShift({ day: 3, roll: 7, result: 'Success', hoursAdded: 8 }),
        createShift({ day: 4, roll: 4, result: 'Critical Success', hoursAdded: 12, qualityChange: 1 }),
      ];

      for (let i = 0; i < shifts.length; i++) {
        state = campaignReducer(state, {
          type: 'updateCraft' as CampaignAction['type'],
          payload: {
            id: 'craft-longsword',
            changes: { shifts: shifts.slice(0, i + 1) },
          },
        } as CampaignAction);
      }

      expect(state.entities.crafts['craft-longsword'].shifts).toHaveLength(3);

      // 6. Complete the project
      state = campaignReducer(state, {
        type: 'completeCraft' as CampaignAction['type'],
        payload: {
          id: 'craft-longsword',
          finalStats: { weight: 3.5, hp: 11, ht: 12, damage: '2d+4' },
        },
      } as CampaignAction);

      const completed = state.entities.crafts['craft-longsword'];
      expect(completed.phase).toBe('complete');
      expect(completed.finalStats!.damage).toBe('2d+4');

      // 7. Save the design for future use
      state = campaignReducer(state, {
        type: 'addCraftDesign' as CampaignAction['type'],
        payload: createCraftDesign({
          consumedMaterials: completed.consumedMaterials,
          designShifts: completed.designShifts,
        }),
      } as CampaignAction);

      expect(state.entities.craftDesigns['design-longsword']).toBeDefined();

      // 8. Remove the completed project
      state = campaignReducer(state, {
        type: 'removeCraft' as CampaignAction['type'],
        payload: 'craft-longsword',
      } as CampaignAction);

      expect(state.entities.crafts['craft-longsword']).toBeUndefined();
      expect(state.entities.craftDesigns['design-longsword']).toBeDefined();
    });
  });
});
