import type { ActivityBonusTotals } from './activityCalculator';
import { calculateActivityBonuses } from './activityCalculator';
import type { Id, Inventory, ToolModifierSet } from '../types/partyTool';

export interface ActivityWorker {
  id: Id;
  skills: Record<string, number>;
}

export interface ActivityToolUse {
  toolId: Id;
  name: string;
  assignedWorkerId: Id;
  conditionId?: Id;
  modifiers: ToolModifierSet;
}

export interface ActivityFacilityUse {
  facilityId: Id;
  name: string;
  conditionId?: Id;
  modifiers: ToolModifierSet;
}

export interface ActivityConsumableRequirement {
  inventoryId: Id;
  itemId: Id;
  quantity: number;
}

export interface ActivityConfig {
  sessionId: Id;
  skillKey: string;
  primaryWorker: ActivityWorker;
  helpers: ActivityWorker[];
  toolsUsed: ActivityToolUse[];
  facility?: ActivityFacilityUse | null;
  inventories: Record<Id, Inventory>;
  consumables: ActivityConsumableRequirement[];
  reservedToolSessions: Record<Id, Id>;
}

export interface ActivityLogEntry {
  primaryWorkerId: Id;
  helperIds: Id[];
  toolNames: string[];
  totalModifiers: ActivityBonusTotals;
  outcome: string;
  gmOverrideUsed?: boolean;
}

export interface PreResolutionResult {
  warnings: string[];
  errors: string[];
}

const assertWholeNumber = (value: number, message: string) => {
  if (!Number.isInteger(value)) {
    throw new Error(message);
  }
};

const findInventoryItem = (inventory: Inventory, itemId: Id) =>
  inventory.items.find(item => item.id === itemId);

export const preResolutionCheck = (activityConfig: ActivityConfig): PreResolutionResult => {
  const warnings: string[] = [];
  const errors: string[] = [];

  const { primaryWorker, helpers, skillKey, toolsUsed, consumables, inventories, reservedToolSessions, sessionId } =
    activityConfig;

  const allWorkers = [primaryWorker, ...helpers];
  allWorkers.forEach(worker => {
    if (!(skillKey in worker.skills)) {
      errors.push(`Worker lacks skill: ${worker.id}`);
    }
  });

  toolsUsed.forEach(tool => {
    const reservedSession = reservedToolSessions[tool.toolId];
    if (reservedSession && reservedSession !== sessionId) {
      errors.push(`Tool reserved elsewhere: ${tool.toolId}`);
    }
  });

  consumables.forEach(req => {
    assertWholeNumber(req.quantity, 'Consumable quantities must be whole numbers');
    if (req.quantity <= 0) {
      errors.push(`Consumable quantity must be positive: ${req.itemId}`);
      return;
    }

    const inventory = inventories[req.inventoryId];
    if (!inventory) {
      errors.push(`Inventory not found: ${req.inventoryId}`);
      return;
    }

    const item = findInventoryItem(inventory, req.itemId);
    const available = item?.quantity ?? 0;
    if (available < req.quantity) {
      errors.push(`Consumables missing: ${req.itemId}`);
    }
  });

  if (activityConfig.facility && activityConfig.facility.conditionId === 'Broken') {
    errors.push('Facility is broken');
  }

  toolsUsed.forEach(tool => {
    if (tool.conditionId === 'Broken') {
      errors.push('Tool is broken');
    }
  });

  if (toolsUsed.length === 0) {
    warnings.push('No tools selected');
  }

  return { warnings, errors };
};

export const resolveActivity = (
  activityConfig: ActivityConfig,
  isGMOverride: boolean
): { logEntry: ActivityLogEntry; warnings: string[]; errors: string[] } => {
  const validation = preResolutionCheck(activityConfig);

  if (validation.errors.length > 0 && !isGMOverride) {
    return {
      logEntry: {
        primaryWorkerId: activityConfig.primaryWorker.id,
        helperIds: activityConfig.helpers.map(helper => helper.id),
        toolNames: activityConfig.toolsUsed.map(tool => tool.name),
        totalModifiers: {
          skillBonus: 0,
          yieldFlat: 0,
          yieldPercent: 0,
          timeBonus: 0,
          riskModifier: 0,
          qualityModifier: 0,
          hardStop: true,
          errorMessage: 'Blocked by validation',
        },
        outcome: 'blocked',
      },
      warnings: validation.warnings,
      errors: validation.errors,
    };
  }

  const totalModifiers = calculateActivityBonuses({
    primaryWorkerId: activityConfig.primaryWorker.id,
    helperWorkerIds: activityConfig.helpers.map(helper => helper.id),
    toolsUsed: activityConfig.toolsUsed.map(tool => ({
      toolId: tool.toolId,
      assignedWorkerId: tool.assignedWorkerId,
      modifiers: tool.modifiers,
      conditionId: tool.conditionId,
    })),
    facility: activityConfig.facility
      ? {
          facilityId: activityConfig.facility.facilityId,
          modifiers: activityConfig.facility.modifiers,
          conditionId: activityConfig.facility.conditionId,
        }
      : null,
  });

  activityConfig.consumables.forEach(req => {
    const inventory = activityConfig.inventories[req.inventoryId];
    if (!inventory) {
      return;
    }
    const item = findInventoryItem(inventory, req.itemId);
    if (!item) {
      return;
    }
    assertWholeNumber(req.quantity, 'Consumable quantities must be whole numbers');
    const nextQuantity = (item.quantity ?? 0) - req.quantity;
    item.quantity = Math.max(0, nextQuantity);
  });

  const logEntry: ActivityLogEntry = {
    primaryWorkerId: activityConfig.primaryWorker.id,
    helperIds: activityConfig.helpers.map(helper => helper.id),
    toolNames: activityConfig.toolsUsed.map(tool => tool.name),
    totalModifiers,
    outcome: isGMOverride && validation.errors.length > 0 ? 'resolved-with-override' : 'resolved',
    gmOverrideUsed: isGMOverride ? true : undefined,
  };

  return {
    logEntry,
    warnings: validation.warnings,
    errors: validation.errors,
  };
};
