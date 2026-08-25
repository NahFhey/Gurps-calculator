import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createCampaignState } from '../../../state/campaignReducer';
import type { CampaignState } from '../../../state/campaignReducer';
import { CampaignStoreProvider, useCampaignStore } from '../../../state/campaignStore';
import type { CraftingWorker } from '../../../hooks/useCraftingData';
import type { Craft, CustomTemplates, Material, MaterialType } from '../../../types/campaign';
import { CraftingWorkbench } from '../CraftingWorkbench';

vi.mock('../../DiceRoller', () => ({
  DiceRoller: ({ onRoll }: { onRoll: (dice: number[], total: number) => void }) => (
    <button type="button" onClick={() => onRoll([3, 3, 3], 9)}>
      Roll completion
    </button>
  ),
}));

const materials: Material[] = [
  { id: 'mat-1', name: 'Iron Bar', type: 'metal', quantity: 10 },
];

const materialTypes: MaterialType[] = [
  {
    name: 'metal',
    ht: 12,
    difficulty: -1,
    effects: '',
    drShift: 0,
    weightMod: 0,
    hpMod: 0,
  },
];

const customTemplates: CustomTemplates = {
  weapons: {
    Longsword: {
      name: 'Longsword',
      weight: 4,
      hp: 10,
      damage: 'sw+1 cut',
      reach: '1',
      materials: [{ type: 'metal', amount: 3 }],
    },
  },
  armor: {},
  ranged: {},
  explosives: {},
};

const smith: CraftingWorker = {
  id: 'char-smith',
  name: 'Smith',
  skills: { crafting: 14, designing: 12 },
};

function makeCraft(worker: string): Craft {
  return {
    id: 'craft-1',
    phase: 'craft',
    templateType: 'weapons',
    template: 'Longsword',
    quality: 'good',
    currentQuality: 'good',
    mods: [],
    selectedMaterials: [{
      requirementIndex: 0,
      requiredType: 'metal',
      requiredAmount: 3,
      selectedMaterialId: 'mat-1',
    }],
    shifts: [{
      id: 'shift-1',
      date: '2026-01-05',
      day: 5,
      worker,
      skill: 14,
      roll: 8,
      effectiveSkill: 13,
      result: 'Success',
      hoursAdded: 8,
      qualityChange: 0,
      phase: 'craft',
    }],
    startDate: '2026-01-01',
    startDay: 1,
  };
}

function makeState(): CampaignState {
  const state = createCampaignState();
  state.entities.characters = {
    [smith.id]: { id: smith.id, name: smith.name, work: { skills: smith.skills } },
  };
  return state;
}

function renderCompletion(workerName: string, workers: CraftingWorker[]) {
  let latestState = makeState();

  function StateObserver() {
    latestState = useCampaignStore().state;
    return null;
  }

  render(
    <CampaignStoreProvider initialCampaignState={latestState}>
      <CraftingWorkbench
        craft={makeCraft(workerName)}
        materials={materials}
        materialTypes={materialTypes}
        customTemplates={customTemplates}
        workers={workers}
        crafts={[]}
        craftDesigns={[]}
        saveMaterials={() => undefined}
        saveCrafts={() => undefined}
        saveCraftDesigns={() => undefined}
        addLogEntry={() => undefined}
        weatherSkillBonus={0}
        onProjectCompleted={() => undefined}
        onProjectAbandoned={() => undefined}
        onDesignPhaseComplete={() => undefined}
        onCraftUpdated={() => undefined}
      />
      <StateObserver />
    </CampaignStoreProvider>
  );

  return { getState: () => latestState };
}

function setSkill(value: string): void {
  const input = screen.getByText('Skill').parentElement?.querySelector('input');
  if (!input) throw new Error('expected skill input');
  fireEvent.change(input, { target: { value } });
}

function completeShift(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Roll completion' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add Shift' }));
}

function getCraftedItem(state: CampaignState) {
  const partyInventory = Object.values(state.entities.inventories).find(
    inventory => inventory.ownerType === 'party'
  );
  if (!partyInventory) throw new Error('expected party inventory');
  const item = partyInventory.items.find(candidate => candidate.id === 'crafted-craft-1');
  if (!item) throw new Error('expected completed craft item');
  return item;
}

describe('CraftingWorkbench completion attribution', () => {
  it('writes the completing shift worker character id through the real store', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const { getState } = renderCompletion('Smith', [smith]);
    setSkill('14');

    completeShift();

    expect(alertSpy).toHaveBeenCalledWith('Craft complete!');
    expect(getCraftedItem(getState())).toMatchObject({
      id: 'crafted-craft-1',
      source: 'crafting',
      crafterId: 'char-smith',
    });
    alertSpy.mockRestore();
  });

  it('omits crafter attribution when the completing worker name cannot be resolved', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const { getState } = renderCompletion('Unknown Smith', [smith]);
    setSkill('14');

    completeShift();

    expect(alertSpy).toHaveBeenCalledWith('Craft complete!');
    expect(getCraftedItem(getState())).not.toHaveProperty('crafterId');
    alertSpy.mockRestore();
  });
});
