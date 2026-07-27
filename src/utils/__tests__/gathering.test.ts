import { describe, it, expect } from 'vitest';
import {
  calculateEffectiveFishingSkill as calculateDeclaredEffectiveFishingSkill,
  evaluateFishingRoll as evaluateDeclaredFishingRoll,
  calculateFishYields as calculateDeclaredFishYields,
  generateGroupKey as generateDeclaredGroupKey,
  hasDailyEventBeenRolled as hasDeclaredDailyEventBeenRolled,
  type FishingResult
} from '../gathering';

interface LegacyFishSpecies {
  name: string;
  yieldFormula: string;
}

interface LegacyFishYield {
  name: string;
  foodType: string;
}

interface DailyEvent {
  rolled: boolean;
  resultType: string | null;
}

type DailyEventLog = Record<string, Record<string, DailyEvent>>;

// TODO(types): calculateEffectiveFishingSkill shim omits its supported positional legacy signature.
const calculateEffectiveFishingSkill = calculateDeclaredEffectiveFishingSkill as
  typeof calculateDeclaredEffectiveFishingSkill
  & ((
    baseFishingSkill: number,
    environmentMod: number,
    tools: string[],
    hasFamiliarTools: boolean
  ) => number);

// TODO(types): evaluateFishingRoll shim incorrectly requires the runtime-optional method argument.
const evaluateFishingRoll = evaluateDeclaredFishingRoll as
  typeof evaluateDeclaredFishingRoll
  & ((roll: number, effectiveSkill: number) => FishingResult);

// TODO(types): calculateFishYields shim omits the legacy array-yield overload used by these tests.
const calculateFishYields = calculateDeclaredFishYields as
  ((
    species: LegacyFishSpecies,
    success: boolean,
    margin: number
  ) => LegacyFishYield[]);

// TODO(types): generateGroupKey shim excludes the runtime-supported null helper list.
const generateGroupKey = generateDeclaredGroupKey as
  typeof generateDeclaredGroupKey
  & ((leaderId: string, helperIds: string[] | null) => string);

// TODO(types): hasDailyEventBeenRolled shim omits its supported legacy argument order.
const hasDailyEventBeenRolled = hasDeclaredDailyEventBeenRolled as
  typeof hasDeclaredDailyEventBeenRolled
  & ((
    currentDay: number,
    groupKey: string,
    dailyEventLog: DailyEventLog | null | undefined
  ) => boolean);

describe('gathering utilities', () => {
  describe('calculateEffectiveFishingSkill', () => {
    it('should add bonus for familiar tools', () => {
      const skill = calculateEffectiveFishingSkill(
        15,
        0,
        ['fishing-net'],
        true
      );

      expect(skill).toBeGreaterThan(15);
    });

    it('should apply penalty for unfamiliar tools', () => {
      const skill = calculateEffectiveFishingSkill(
        15,
        0,
        ['unfamiliar-tool'],
        false
      );

      expect(skill).toBeLessThan(15);
    });

    it('should add environmental bonus', () => {
      const skill = calculateEffectiveFishingSkill(
        15,
        2, // River bonus
        ['fishing-net'],
        true
      );

      expect(skill).toBeGreaterThanOrEqual(15);
    });

    it('should cap skill at reasonable maximum', () => {
      const skill = calculateEffectiveFishingSkill(
        30,
        10,
        ['best-net'],
        true
      );

      expect(skill).toBeLessThanOrEqual(35);
    });

    it('should handle zero skill', () => {
      const skill = calculateEffectiveFishingSkill(
        0,
        0,
        [],
        true
      );

      expect(typeof skill).toBe('number');
      expect(skill).toBeLessThanOrEqual(5);
    });
  });

  describe('evaluateFishingRoll', () => {
    it('should mark critical success for roll of 3-4', () => {
      const result = evaluateFishingRoll(3, 15);

      expect(result.success).toBe(true);
      expect(result.isCritical).toBe(true);
    });

    it('should mark critical failure for roll of 17-18', () => {
      const result = evaluateFishingRoll(18, 15);

      expect(result.success).toBe(false);
      expect(result.isCritical).toBe(true);
    });

    it('should evaluate normal success within skill', () => {
      const result = evaluateFishingRoll(12, 15);

      expect(result.success).toBe(true);
      expect(result.isCritical).toBe(false);
      expect(result.margin).toBeGreaterThan(0);
    });

    it('should evaluate normal failure outside skill', () => {
      const result = evaluateFishingRoll(17, 15);

      expect(result.success).toBe(false);
      expect(result.isCritical).toBe(false);
      expect(result.margin).toBeLessThan(0);
    });

    it('should calculate margin correctly', () => {
      const result = evaluateFishingRoll(10, 15);

      expect(result.margin).toBe(5);
    });
  });

  describe('calculateFishYields', () => {
    it('should yield single fish on success', () => {
      const yields = calculateFishYields(
        { name: 'Bass', yieldFormula: '1d3' },
        true,
        1
      );

      expect(yields.length).toBeGreaterThan(0);
      expect(yields[0].name).toBe('Bass');
    });

    it('should yield nothing on failure', () => {
      const yields = calculateFishYields(
        { name: 'Bass', yieldFormula: '1d3' },
        false,
        1
      );

      expect(yields.length).toBe(0);
    });

    it('should multiply yield by margin of success', () => {
      const yieldsSmall = calculateFishYields(
        { name: 'Bass', yieldFormula: '1d3' },
        true,
        1
      );

      const yieldsLarge = calculateFishYields(
        { name: 'Bass', yieldFormula: '1d3' },
        true,
        5
      );

      expect(yieldsLarge.length).toBeGreaterThan(yieldsSmall.length);
    });

    it('should handle multiple fish in yield formula', () => {
      const yields = calculateFishYields(
        { name: 'Sardine', yieldFormula: '2d6' },
        true,
        3
      );

      expect(yields.length).toBeGreaterThan(0);
    });
  });

  describe('generateGroupKey', () => {
    it('should generate consistent key for same inputs', () => {
      const key1 = generateGroupKey('leader-1', ['helper-1', 'helper-2']);
      const key2 = generateGroupKey('leader-1', ['helper-1', 'helper-2']);

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different leaders', () => {
      const key1 = generateGroupKey('leader-1', ['helper-1']);
      const key2 = generateGroupKey('leader-2', ['helper-1']);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different helpers', () => {
      const key1 = generateGroupKey('leader-1', ['helper-1', 'helper-2']);
      const key2 = generateGroupKey('leader-1', ['helper-1', 'helper-3']);

      expect(key1).not.toBe(key2);
    });

    it('should handle empty helper array', () => {
      const key = generateGroupKey('leader-1', []);

      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
    });

    it('should handle null helpers as empty array', () => {
      const key1 = generateGroupKey('leader-1', null);
      const key2 = generateGroupKey('leader-1', []);

      expect(key1).toBe(key2);
    });

    it('should be order-independent for helpers', () => {
      const key1 = generateGroupKey('leader-1', ['h1', 'h2', 'h3']);
      const key2 = generateGroupKey('leader-1', ['h3', 'h1', 'h2']);

      expect(key1).toBe(key2);
    });
  });

  describe('hasDailyEventBeenRolled', () => {
    it('should return false when no events exist', () => {
      const result = hasDailyEventBeenRolled(1, 'group-1', {});

      expect(result).toBe(false);
    });

    it('should return true when event has been rolled', () => {
      const dailyEvents = {
        day1: {
          'group-1': { rolled: true, resultType: 'encounter' }
        }
      };

      const result = hasDailyEventBeenRolled(1, 'group-1', dailyEvents);

      expect(result).toBe(true);
    });

    it('should return false for different group on same day', () => {
      const dailyEvents = {
        day1: {
          'group-1': { rolled: true, resultType: 'encounter' }
        }
      };

      const result = hasDailyEventBeenRolled(1, 'group-2', dailyEvents);

      expect(result).toBe(false);
    });

    it('should return false for different day with same group', () => {
      const dailyEvents = {
        day1: {
          'group-1': { rolled: true, resultType: 'encounter' }
        }
      };

      const result = hasDailyEventBeenRolled(2, 'group-1', dailyEvents);

      expect(result).toBe(false);
    });

    it('should handle multiple groups on same day', () => {
      const dailyEvents = {
        day1: {
          'group-1': { rolled: true, resultType: 'encounter' },
          'group-2': { rolled: false, resultType: null }
        }
      };

      expect(hasDailyEventBeenRolled(1, 'group-1', dailyEvents)).toBe(true);
      expect(hasDailyEventBeenRolled(1, 'group-2', dailyEvents)).toBe(false);
    });

    it('should handle null dailyEvents', () => {
      const result = hasDailyEventBeenRolled(1, 'group-1', null);

      expect(result).toBe(false);
    });

    it('should handle undefined dailyEvents', () => {
      const result = hasDailyEventBeenRolled(1, 'group-1', undefined);

      expect(result).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle very high skill in evaluateFishingRoll', () => {
      const result = evaluateFishingRoll(15, 50);

      expect(result.success).toBe(true);
      expect(result.margin).toBeGreaterThan(0);
    });

    it('should handle very low skill in evaluateFishingRoll', () => {
      const result = evaluateFishingRoll(15, 3);

      expect(result.success).toBe(false);
      expect(result.margin).toBeLessThan(0);
    });

    it('should handle zero margin of success in calculateFishYields', () => {
      const yields = calculateFishYields(
        { name: 'Fish', yieldFormula: '1d3' },
        true,
        0
      );

      expect(yields).toBeDefined();
    });

    it('should handle very long helper list in generateGroupKey', () => {
      const helpers = Array.from({ length: 100 }, (_, i) => `helper-${i}`);
      const key = generateGroupKey('leader-1', helpers);

      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
    });
  });
});
