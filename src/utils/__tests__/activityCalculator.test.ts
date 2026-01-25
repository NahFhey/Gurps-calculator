import { describe, expect, it } from 'vitest';
import {
  BROKEN_TOOL_MESSAGE,
  calculateActivityBonuses,
} from '../activityCalculator';

const baseInput = {
  primaryWorkerId: 'worker-1',
  helperWorkerIds: ['worker-2'],
};

describe('calculateActivityBonuses', () => {
  it('aggregates tool and facility modifiers with stacking', () => {
    const result = calculateActivityBonuses({
      ...baseInput,
      toolsUsed: [
        {
          toolId: 'tool-1',
          assignedWorkerId: 'worker-1',
          conditionId: 'Good',
          modifiers: {
            skillBonus: 1,
            yieldFlat: 2,
            yieldPercent: 5,
          },
        },
        {
          toolId: 'tool-2',
          assignedWorkerId: 'worker-2',
          conditionId: 'Good',
          modifiers: {
            timeBonus: -1,
            qualityModifier: 3,
          },
        },
      ],
      facility: {
        facilityId: 'facility-1',
        conditionId: 'Good',
        modifiers: {
          skillBonus: 2,
          yieldPercent: 10,
          riskModifier: -2,
        },
      },
    });

    expect(result).toEqual({
      skillBonus: 3,
      yieldFlat: 2,
      yieldPercent: 15,
      timeBonus: -1,
      riskModifier: -2,
      qualityModifier: 3,
      hardStop: false,
    });
  });

  it('returns a hard stop when a tool is broken', () => {
    const result = calculateActivityBonuses({
      ...baseInput,
      toolsUsed: [
        {
          toolId: 'tool-1',
          assignedWorkerId: 'worker-1',
          conditionId: 'Broken',
          modifiers: {
            skillBonus: 1,
          },
        },
      ],
      facility: null,
    });

    expect(result.hardStop).toBe(true);
    expect(result.errorMessage).toBe(BROKEN_TOOL_MESSAGE);
  });

  it('rejects multiple tools for the same worker', () => {
    expect(() =>
      calculateActivityBonuses({
        ...baseInput,
        toolsUsed: [
          {
            toolId: 'tool-1',
            assignedWorkerId: 'worker-1',
            conditionId: 'Good',
            modifiers: {},
          },
          {
            toolId: 'tool-2',
            assignedWorkerId: 'worker-1',
            conditionId: 'Good',
            modifiers: {},
          },
        ],
        facility: null,
      })
    ).toThrow('Worker already has a tool assigned: worker-1');
  });
});
