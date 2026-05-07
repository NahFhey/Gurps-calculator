// @ts-nocheck
import { describe, it, expect } from 'vitest';
import {
  calculateFormulaStats,
  calculateConcentrationRefinement,
  applyWorkBlockResult
} from '../alchemy';

describe('alchemy utilities', () => {
  describe('calculateFormulaStats', () => {
    it('should calculate base WR correctly', () => {
      const formula = {
        tier: 2,
        vector: 'Potion',
        dominantAspect: 'Fire',
        ingredients: [
          { unitsUsed: 2, potency: 'P2' }
        ]
      };

      const stats = calculateFormulaStats(formula);

      expect(stats).toHaveProperty('baseWR');
      expect(stats.baseWR).toBeGreaterThan(0);
    });

    it('should calculate base DM based on tier', () => {
      const formula = {
        tier: 1,
        vector: 'Potion',
        dominantAspect: 'Water',
        ingredients: []
      };

      const stats = calculateFormulaStats(formula);

      expect(stats).toHaveProperty('baseDM');
      expect(typeof stats.baseDM).toBe('number');
    });

    it('should handle complex formulas with multiple ingredients', () => {
      const formula = {
        tier: 3,
        vector: 'Tincture',
        dominantAspect: 'Life',
        secondaryAspect: 'Death',
        ingredients: [
          { unitsUsed: 1, potency: 'P1' },
          { unitsUsed: 2, potency: 'P2' },
          { unitsUsed: 3, potency: 'P3' }
        ]
      };

      const stats = calculateFormulaStats(formula);

      expect(stats).toHaveProperty('baseWR');
      expect(stats).toHaveProperty('baseDM');
      expect(stats.baseWR).toBeGreaterThan(0);
    });

    it('should return valid stats for potion vector', () => {
      const formula = {
        tier: 1,
        vector: 'Potion',
        dominantAspect: 'Fire',
        ingredients: [{ unitsUsed: 1, potency: 'P1' }]
      };

      const stats = calculateFormulaStats(formula);

      expect(stats.vector).toBe('Potion');
    });

    it('should return valid stats for tincture vector', () => {
      const formula = {
        tier: 1,
        vector: 'Tincture',
        dominantAspect: 'Water',
        ingredients: [{ unitsUsed: 1, potency: 'P1' }]
      };

      const stats = calculateFormulaStats(formula);

      expect(stats.vector).toBe('Tincture');
    });
  });

  describe('calculateConcentrationRefinement', () => {
    it('should increase concentration for valid configurations', () => {
      const result = calculateConcentrationRefinement({
        basePotency: 'P1',
        concentrationSteps: 0
      }, 1);

      expect(result.concentrationSteps).toBe(1);
    });

    it('should not exceed maximum potency', () => {
      const result = calculateConcentrationRefinement({
        basePotency: 'P4',
        concentrationSteps: 3
      }, 2);

      // Should cap at P4
      expect(result.concentrationSteps).toBeLessThanOrEqual(3);
    });

    it('should track refinement history', () => {
      const result = calculateConcentrationRefinement({
        basePotency: 'P1',
        concentrationSteps: 1,
        refinementHistory: []
      }, 1);

      expect(result).toHaveProperty('refinementHistory');
    });
  });

  describe('applyWorkBlockResult', () => {
    it('should update batch CP correctly', () => {
      const batch = {
        id: 'batch-1',
        phase: 'brewing',
        CP: 0,
        DM: 0
      };

      const roll = { total: 12, modifier: 0 };
      const result = applyWorkBlockResult(batch, roll, 'standard');

      expect(result).toHaveProperty('CP');
      expect(typeof result.CP).toBe('number');
    });

    it('should handle critical success', () => {
      const batch = {
        id: 'batch-1',
        phase: 'brewing',
        CP: 0,
        DM: 0
      };

      const roll = { total: 18, modifier: 0 };
      const result = applyWorkBlockResult(batch, roll, 'standard');

      expect(result.CP).toBeGreaterThan(0);
    });

    it('should handle critical failure', () => {
      const batch = {
        id: 'batch-1',
        phase: 'brewing',
        CP: 0,
        DM: 0
      };

      const roll = { total: 3, modifier: 0 };
      const result = applyWorkBlockResult(batch, roll, 'standard');

      expect(result.phase).toBe('failed');
    });

    it('should accumulate CP on multiple work blocks', () => {
      let batch = {
        id: 'batch-1',
        phase: 'brewing',
        CP: 0,
        DM: 0
      };

      const roll1 = { total: 13, modifier: 0 };
      const roll2 = { total: 14, modifier: 0 };

      batch = applyWorkBlockResult(batch, roll1, 'standard');
      const cp1 = batch.CP;

      batch = applyWorkBlockResult(batch, roll2, 'standard');
      const cp2 = batch.CP;

      expect(cp2).toBeGreaterThanOrEqual(cp1);
    });

    it('should not modify original batch', () => {
      const batch = {
        id: 'batch-1',
        phase: 'brewing',
        CP: 0,
        DM: 0
      };

      const originalCP = batch.CP;
      const roll = { total: 12, modifier: 0 };

      applyWorkBlockResult(batch, roll, 'standard');

      expect(batch.CP).toBe(originalCP);
    });
  });

  describe('edge cases', () => {
    it('should handle empty ingredient list', () => {
      const formula = {
        tier: 1,
        vector: 'Potion',
        dominantAspect: 'Fire',
        ingredients: []
      };

      const stats = calculateFormulaStats(formula);

      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('baseWR');
    });

    it('should handle null secondary aspect', () => {
      const formula = {
        tier: 1,
        vector: 'Potion',
        dominantAspect: 'Fire',
        secondaryAspect: null,
        ingredients: [{ unitsUsed: 1, potency: 'P1' }]
      };

      const stats = calculateFormulaStats(formula);

      expect(stats).toBeDefined();
    });

    it('should handle batch with maximum CP', () => {
      const batch = {
        id: 'batch-1',
        phase: 'brewing',
        CP: 5,
        DM: 0
      };

      const roll = { total: 15, modifier: 0 };
      const result = applyWorkBlockResult(batch, roll, 'standard');

      expect(result).toBeDefined();
    });
  });
});
