import type { Id, ToolModifierSet } from '../types/partyTool';

export interface ActivityToolSelection {
  toolId: Id;
  assignedWorkerId: Id;
  modifiers: ToolModifierSet;
  conditionId?: Id;
}

export interface ActivityFacilitySelection {
  facilityId: Id;
  modifiers: ToolModifierSet;
  conditionId?: Id;
}

/**
 * Weather modifiers that affect activities
 * These come from the current location's weather
 */
export interface WeatherModifiers {
  skillBonus?: number;      // Applied to skill rolls
  yieldFlat?: number;       // Flat addition to yield
  yieldPercent?: number;    // Percentage multiplier
  description?: string;     // Weather description for display
}

export interface ActivityCalculatorInput {
  primaryWorkerId: Id;
  helperWorkerIds: Id[];
  toolsUsed: ActivityToolSelection[];
  facility?: ActivityFacilitySelection | null;
  weatherModifiers?: WeatherModifiers | null;  // Weather effects on the activity
}

export interface ActivityBonusTotals {
  skillBonus: number;
  yieldFlat: number;
  yieldPercent: number;
  timeBonus: number;
  riskModifier: number;
  qualityModifier: number;
  hardStop: boolean;
  errorMessage?: string;
}

export const BROKEN_CONDITION_ID = 'Broken';
export const BROKEN_TOOL_MESSAGE =
  'How are you going to perform this activity with a broken tool?';

export const checkBrokenStatus = (
  tools: ActivityToolSelection[],
  facility?: ActivityFacilitySelection | null
): { hardStop: boolean; errorMessage?: string } => {
  const hasBrokenTool = tools.some(tool => tool.conditionId === BROKEN_CONDITION_ID);
  if (hasBrokenTool) {
    return { hardStop: true, errorMessage: BROKEN_TOOL_MESSAGE };
  }

  if (facility?.conditionId === BROKEN_CONDITION_ID) {
    return { hardStop: true, errorMessage: BROKEN_TOOL_MESSAGE };
  }

  return { hardStop: false };
};

const mergeModifiers = (totals: ActivityBonusTotals, modifiers: ToolModifierSet) => {
  totals.skillBonus += modifiers.skillBonus ?? 0;
  totals.yieldFlat += modifiers.yieldFlat ?? 0;
  totals.yieldPercent += modifiers.yieldPercent ?? 0;
  totals.timeBonus += modifiers.timeBonus ?? 0;
  totals.riskModifier += modifiers.riskModifier ?? 0;
  totals.qualityModifier += modifiers.qualityModifier ?? 0;
};

export const calculateActivityBonuses = ({
  primaryWorkerId,
  helperWorkerIds,
  toolsUsed,
  facility,
  weatherModifiers,
}: ActivityCalculatorInput): ActivityBonusTotals => {
  const { hardStop, errorMessage } = checkBrokenStatus(toolsUsed, facility);
  if (hardStop) {
    return {
      skillBonus: 0,
      yieldFlat: 0,
      yieldPercent: 0,
      timeBonus: 0,
      riskModifier: 0,
      qualityModifier: 0,
      hardStop,
      errorMessage,
    };
  }

  const workerIds = [primaryWorkerId, ...helperWorkerIds];
  const workerToolMap = new Map<Id, Id>();

  toolsUsed.forEach(tool => {
    if (!workerIds.includes(tool.assignedWorkerId)) {
      throw new Error(`Tool assigned to unknown worker: ${tool.assignedWorkerId}`);
    }
    if (workerToolMap.has(tool.assignedWorkerId)) {
      throw new Error(`Worker already has a tool assigned: ${tool.assignedWorkerId}`);
    }
    workerToolMap.set(tool.assignedWorkerId, tool.toolId);
  });

  const totals: ActivityBonusTotals = {
    skillBonus: 0,
    yieldFlat: 0,
    yieldPercent: 0,
    timeBonus: 0,
    riskModifier: 0,
    qualityModifier: 0,
    hardStop: false,
  };

  toolsUsed.forEach(tool => mergeModifiers(totals, tool.modifiers));
  if (facility) {
    mergeModifiers(totals, facility.modifiers);
  }

  // Apply weather modifiers
  if (weatherModifiers) {
    totals.skillBonus += weatherModifiers.skillBonus ?? 0;
    totals.yieldFlat += weatherModifiers.yieldFlat ?? 0;
    totals.yieldPercent += weatherModifiers.yieldPercent ?? 0;
  }

  return totals;
};
