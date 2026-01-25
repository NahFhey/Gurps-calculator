import type { Character, GlobalState, Id, ToolTemplate } from '../types/partyTool';

export const BASIC_TOOL_TEMPLATE_ID = 'basic-plus-zero';

export interface SystemInitializationResult {
  state: GlobalState;
  warnings: string[];
  errors: string[];
}

export const initializeSystem = (state: GlobalState): SystemInitializationResult => {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!state.toolTemplates[BASIC_TOOL_TEMPLATE_ID]) {
    const basicTemplate: ToolTemplate = {
      templateId: BASIC_TOOL_TEMPLATE_ID,
      name: 'Basic +0 Tool',
      activityCategories: {
        basic: {},
      },
    };

    state.toolTemplates[BASIC_TOOL_TEMPLATE_ID] = basicTemplate;
  }

  return { state, warnings, errors };
};

export const validatePlayerWorkers = (
  characters: Record<Id, Character>,
  workerIds: Id[]
): string[] => {
  const errors: string[] = [];

  workerIds.forEach(workerId => {
    const worker = characters[workerId];
    if (!worker) {
      errors.push(`Worker not found: ${workerId}`);
      return;
    }

    if (!worker.isPlayer) {
      errors.push(`Worker is not a player: ${workerId}`);
    }
  });

  return errors;
};
