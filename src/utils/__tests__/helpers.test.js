import { describe, it, expect } from 'vitest';
import {
  safeParse,
  toNumberOr,
  determineQuality,
  refundMaterialsFromProject
} from '../helpers';

describe('helper functions', () => {
  describe('safeParse', () => {
    it('should parse valid JSON string', () => {
      const result = safeParse('{"key": "value"}', {});
      expect(result).toEqual({ key: 'value' });
    });

    it('should return fallback for invalid JSON', () => {
      const fallback = { default: true };
      const result = safeParse('invalid json', fallback);
      expect(result).toEqual(fallback);
    });

    it('should return fallback for null input', () => {
      const fallback = [];
      const result = safeParse(null, fallback);
      expect(result).toEqual(fallback);
    });

    it('should return fallback for undefined input', () => {
      const fallback = {};
      const result = safeParse(undefined, fallback);
      expect(result).toEqual(fallback);
    });

    it('should handle array JSON', () => {
      const result = safeParse('[1, 2, 3]', []);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should handle nested objects', () => {
      const json = '{"nested": {"key": "value"}}';
      const result = safeParse(json, {});
      expect(result.nested.key).toBe('value');
    });

    it('should return fallback for empty string', () => {
      const fallback = { empty: true };
      const result = safeParse('', fallback);
      expect(result).toEqual(fallback);
    });
  });

  describe('toNumberOr', () => {
    it('should convert string to number', () => {
      expect(toNumberOr('42', 0)).toBe(42);
    });

    it('should return number as-is', () => {
      expect(toNumberOr(123, 0)).toBe(123);
    });

    it('should return fallback for non-numeric string', () => {
      expect(toNumberOr('abc', 10)).toBe(10);
    });

    it('should return fallback for NaN', () => {
      expect(toNumberOr(NaN, 5)).toBe(5);
    });

    it('should return fallback for Infinity', () => {
      expect(toNumberOr(Infinity, 0)).toBe(0);
    });

    it('should return fallback for -Infinity', () => {
      expect(toNumberOr(-Infinity, 0)).toBe(0);
    });

    it('should handle decimal strings', () => {
      expect(toNumberOr('3.14', 0)).toBe(3.14);
    });

    it('should use default fallback of 0', () => {
      expect(toNumberOr('invalid')).toBe(0);
    });

    it('should handle negative numbers', () => {
      expect(toNumberOr('-42', 0)).toBe(-42);
    });

    it('should handle zero', () => {
      expect(toNumberOr(0, 10)).toBe(0);
    });
  });

  describe('determineQuality', () => {
    it('should return Clean for 0 CP', () => {
      expect(determineQuality(0)).toBe('Clean');
    });

    it('should return Works (Minor Drawback) for 1 CP', () => {
      expect(determineQuality(1)).toBe('Works (Minor Drawback)');
    });

    it('should return Unstable for 2 CP', () => {
      expect(determineQuality(2)).toBe('Unstable');
    });

    it('should return Flawed for 3 CP', () => {
      expect(determineQuality(3)).toBe('Flawed');
    });

    it('should return Mishap for 4+ CP', () => {
      expect(determineQuality(4)).toBe('Mishap');
      expect(determineQuality(5)).toBe('Mishap');
      expect(determineQuality(100)).toBe('Mishap');
    });

    it('should handle negative CP as Mishap', () => {
      expect(determineQuality(-1)).toBe('Mishap');
    });
  });

  describe('refundMaterialsFromProject', () => {
    it('should refund consumed materials', () => {
      const project = {
        consumedMaterials: [
          { materialId: 'mat-1', amount: 5, name: 'Wood', type: 'material' },
          { materialId: 'mat-2', amount: 3, name: 'Iron', type: 'material' }
        ]
      };

      const materials = [
        { id: 'mat-1', name: 'Wood', type: 'material', quantity: 10 },
        { id: 'mat-2', name: 'Iron', type: 'material', quantity: 20 }
      ];

      const result = refundMaterialsFromProject(project, materials);

      expect(result[0].quantity).toBe(15);
      expect(result[1].quantity).toBe(23);
    });

    it('should recreate material entry if deleted', () => {
      const project = {
        consumedMaterials: [
          { materialId: 'mat-1', amount: 5, name: 'Wood', type: 'material' }
        ]
      };

      const materials = []; // Material was deleted

      const result = refundMaterialsFromProject(project, materials);

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('mat-1');
      expect(result[0].quantity).toBe(5);
      expect(result[0].name).toBe('Wood');
    });

    it('should not modify original materials array', () => {
      const project = {
        consumedMaterials: [
          { materialId: 'mat-1', amount: 5, name: 'Wood', type: 'material' }
        ]
      };

      const materials = [
        { id: 'mat-1', name: 'Wood', type: 'material', quantity: 10 }
      ];

      const originalQuantity = materials[0].quantity;
      refundMaterialsFromProject(project, materials);

      expect(materials[0].quantity).toBe(originalQuantity);
    });

    it('should handle empty consumed materials', () => {
      const project = {
        consumedMaterials: []
      };

      const materials = [
        { id: 'mat-1', name: 'Wood', type: 'material', quantity: 10 }
      ];

      const result = refundMaterialsFromProject(project, materials);

      expect(result).toEqual(materials);
    });

    it('should handle null consumed materials', () => {
      const project = {
        consumedMaterials: null
      };

      const materials = [
        { id: 'mat-1', name: 'Wood', type: 'material', quantity: 10 }
      ];

      const result = refundMaterialsFromProject(project, materials);

      expect(result).toEqual(materials);
    });

    it('should handle null project', () => {
      const materials = [
        { id: 'mat-1', name: 'Wood', type: 'material', quantity: 10 }
      ];

      const result = refundMaterialsFromProject(null, materials);

      expect(result).toEqual(materials);
    });

    it('should handle multiple refunds for same material', () => {
      const project = {
        consumedMaterials: [
          { materialId: 'mat-1', amount: 5, name: 'Wood', type: 'material' },
          { materialId: 'mat-1', amount: 3, name: 'Wood', type: 'material' }
        ]
      };

      const materials = [
        { id: 'mat-1', name: 'Wood', type: 'material', quantity: 10 }
      ];

      const result = refundMaterialsFromProject(project, materials);

      expect(result[0].quantity).toBe(18);
    });
  });

  describe('edge cases', () => {
    it('should handle very large numbers in toNumberOr', () => {
      expect(toNumberOr('999999999999999999', 0)).toBe(1e18);
    });

    it('should handle scientific notation in toNumberOr', () => {
      expect(toNumberOr('1e5', 0)).toBe(100000);
    });

    it('should handle whitespace in safeParse', () => {
      const result = safeParse('  {"key": "value"}  ', {});
      expect(result).toEqual({ key: 'value' });
    });

    it('should handle malformed JSON gracefully', () => {
      const fallback = { error: true };
      const result = safeParse('{"key": "unclosed', fallback);
      expect(result).toEqual(fallback);
    });
  });
});
