/**
 * Type definitions for taskResolution.js utilities
 */

import type { InventoryDelta } from '../types/dayplanner';

export interface TaskResolution {
  payload?: any;
  inventoryDelta?: InventoryDelta[];
  notes?: string;
  warnings?: string[];
}

export interface ResolveTaskParams {
  task: any;
  leader?: any;
  environment?: any;
  tools?: any[];
  species?: any[];
  categories?: any[];
  items?: any[];
  tables?: any[];
  manualRolls?: {
    skillRoll?: number;
    eventCheckRoll?: number;
    eventTableRoll?: number | null;
    tableRoll?: number;
  };
}

export function resolveTask(params: ResolveTaskParams): TaskResolution;
