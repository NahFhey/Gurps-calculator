import { useEffect } from 'react';
import type { ComponentProps } from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CampaignStoreProvider, useCampaignStore } from '../../../state/campaignStore';
import type { Character, Inventory } from '../../../types/campaign';
import { InventoryTab } from '../InventoryTab';
import type { InventoryOverviewViewProps } from '../views/InventoryOverviewView';
import { InventoryOverviewView } from '../views/InventoryOverviewView';
import { PartyStashView } from '../views/PartyStashView';
import type { TransferConsoleProps } from '../views/TransferConsole';
import { TransferConsole } from '../views/TransferConsole';

type CampaignStateSnapshot = ReturnType<typeof useCampaignStore>['state'];

const characters: Record<string, Character> = {
  'char-z': { id: 'char-z', name: 'Zara', work: { skills: {} } },
  'char-a': { id: 'char-a', name: 'Alice', work: { skills: {} } },
};

function makeInventories(): Inventory[] {
  return [
    {
      id: 'party',
      ownerType: 'party',
      ownerId: null,
      currency: { cp: 12 },
      items: [
        { id: 'sword-1', name: 'Magic Sword', quantity: 1 },
        { id: 'rope-1', name: 'Rope', quantity: 2 },
      ],
      tools: [{ toolId: 'tool-1', templateId: 'missing-template', conditionId: 'good' }],
      materials: [],
      food: [],
    },
    {
      id: 'inv-char-a',
      ownerType: 'character',
      ownerId: 'char-a',
      currency: {},
      items: [{ id: 'private-1', name: 'Private Item', quantity: 1 }],
      tools: [],
      materials: [],
      food: [],
    },
  ];
}

function renderPartyStash(overrides: Partial<ComponentProps<typeof PartyStashView>> = {}) {
  const props = {
    inventories: makeInventories(),
    characters,
    toolTemplates: {},
    transferState: null,
    onTransferStateChange: vi.fn(),
    onConfirmTransfer: vi.fn(),
    onGiveItem: vi.fn(),
    ...overrides,
  };
  render(<PartyStashView {...props} />);
  return props;
}

function makeTransferConsoleProps(
  overrides: Partial<TransferConsoleProps> = {}
): TransferConsoleProps {
  return {
    inventories: makeInventories(),
    characters,
    transferState: null,
    onTransferStateChange: vi.fn(),
    onConfirmTransfer: vi.fn(),
    ...overrides,
  };
}

function makeOverviewProps(
  overrides: Partial<InventoryOverviewViewProps> = {}
): InventoryOverviewViewProps {
  return {
    view: 'materials',
    materials: [{ id: 'iron', name: 'Iron', type: 'metal', quantity: 4 }],
    foods: [{ id: 'berries', name: 'Berries', types: ['fruit'], quantity: 3 }],
    foodTypes: [{ name: 'fruit', color: '#ff0000' }],
    materialTypes: [{ name: 'metal', difficulty: 0, ht: 10 }],
    gmMode: false,
    showAddMat: false,
    setShowAddMat: vi.fn(),
    showAddFood: false,
    setShowAddFood: vi.fn(),
    useExistingMat: false,
    setUseExistingMat: vi.fn(),
    useExistingFood: false,
    setUseExistingFood: vi.fn(),
    selectedExistingMatId: '',
    setSelectedExistingMatId: vi.fn(),
    selectedExistingFoodId: '',
    setSelectedExistingFoodId: vi.fn(),
    newMatName: '',
    setNewMatName: vi.fn(),
    newMatQty: '',
    setNewMatQty: vi.fn(),
    newMatType: '',
    setNewMatType: vi.fn(),
    newFoodName: '',
    setNewFoodName: vi.fn(),
    newFoodQty: '',
    setNewFoodQty: vi.fn(),
    newFoodTypes: [],
    setNewFoodTypes: vi.fn(),
    expanded: {},
    setExpanded: vi.fn(),
    deleteConfirm: null,
    setDeleteConfirm: vi.fn(),
    onAddMaterial: vi.fn(),
    onAddFood: vi.fn(),
    onSaveMaterials: vi.fn(),
    onSaveFoods: vi.fn(),
    ...overrides,
  };
}

function SeedStash() {
  const { actions } = useCampaignStore();
  useEffect(() => {
    actions.setCharacters(characters);
    actions.setInventories(Object.fromEntries(makeInventories().map(inventory => [inventory.id, inventory])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function StateProbe({ snapshots }: { snapshots: CampaignStateSnapshot[] }) {
  const { state } = useCampaignStore();
  snapshots.push(state);
  return null;
}

describe('PartyStashView', () => {
  it('renders party-owned inventories and hides character-owned inventories', () => {
    renderPartyStash();

    expect(screen.getByText('Party Stash')).toBeInTheDocument();
    expect(screen.queryByText("Alice's Pack")).not.toBeInTheDocument();
    expect(screen.queryByText('Private Item')).not.toBeInTheDocument();
  });

  it('renders quick-assign selects only for party item rows', () => {
    renderPartyStash();

    expect(screen.getAllByRole('combobox')).toHaveLength(2);
    expect(screen.getByLabelText('Give Magic Sword to character')).toBeInTheDocument();
    expect(screen.getByLabelText('Give Rope to character')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Unknown Tool/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/cp/)).not.toBeInTheDocument();
  });

  it('renders selection checkboxes on party item rows only', () => {
    renderPartyStash();

    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    expect(screen.getByRole('checkbox', { name: 'Select Magic Sword' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select Rope' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Unknown Tool|cp/ })).not.toBeInTheDocument();
  });

  it('shows the bulk action bar with the selected item count', () => {
    renderPartyStash();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Magic Sword' }));
    expect(screen.getByText('1 selected — Give to')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Rope' }));
    expect(screen.getByText('2 selected — Give to')).toBeInTheDocument();
  });

  it('sorts the bulk character options by name', () => {
    renderPartyStash();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Magic Sword' }));

    const select = screen.getByLabelText('Give selected items to character');
    expect(within(select).getAllByRole('option').map(option => option.textContent)).toEqual([
      'Give to…',
      'Alice',
      'Zara',
    ]);
  });

  it('gives every selected item through the existing callback', () => {
    const onGiveItem = vi.fn();
    renderPartyStash({ onGiveItem });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Magic Sword' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Rope' }));
    fireEvent.change(screen.getByLabelText('Give selected items to character'), {
      target: { value: 'char-a' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Give' }));

    expect(onGiveItem.mock.calls).toEqual([
      ['party', 'sword-1', 'char-a'],
      ['party', 'rope-1', 'char-a'],
    ]);
  });

  it('clears selection after a bulk give', () => {
    renderPartyStash();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Magic Sword' }));
    fireEvent.change(screen.getByLabelText('Give selected items to character'), {
      target: { value: 'char-a' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Give' }));

    expect(screen.queryByText(/selected — Give to/)).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select Magic Sword' })).not.toBeChecked();
  });

  it('clears selection without giving items', () => {
    const onGiveItem = vi.fn();
    renderPartyStash({ onGiveItem });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Magic Sword' }));

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(onGiveItem).not.toHaveBeenCalled();
    expect(screen.queryByText(/selected — Give to/)).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select Magic Sword' })).not.toBeChecked();
  });

  it('sorts quick-assign character options by name', () => {
    renderPartyStash();

    const select = screen.getByLabelText('Give Magic Sword to character');
    expect(within(select).getAllByRole('option').map(option => option.textContent)).toEqual([
      'Give to…',
      'Alice',
      'Zara',
    ]);
  });

  it('passes the source inventory, item, and character ids on quick assign', () => {
    const onGiveItem = vi.fn();
    renderPartyStash({ onGiveItem });

    fireEvent.change(screen.getByLabelText('Give Magic Sword to character'), {
      target: { value: 'char-a' },
    });

    expect(onGiveItem).toHaveBeenCalledWith('party', 'sword-1', 'char-a');
  });

  it('preselects a resolvable crafter for a crafting-sourced quick assignment', () => {
    const inventories = makeInventories();
    inventories[0].items[0] = {
      ...inventories[0].items[0],
      source: 'crafting',
      crafterId: 'char-a',
    };
    renderPartyStash({ inventories });

    expect(screen.getByLabelText('Give Magic Sword to character')).toHaveValue('char-a');
  });

  it('gives to a preselected quick-assign crafter like a manual pick', () => {
    const inventories = makeInventories();
    inventories[0].items[0] = {
      ...inventories[0].items[0],
      source: 'crafting',
      crafterId: 'char-a',
    };
    const onGiveItem = vi.fn();
    renderPartyStash({ inventories, onGiveItem });

    fireEvent.change(screen.getByLabelText('Give Magic Sword to character'), {
      target: { value: 'char-a' },
    });

    expect(onGiveItem).toHaveBeenCalledWith('party', 'sword-1', 'char-a');
  });

  it('keeps a loot quick assignment neutral even if it has a crafter id', () => {
    const inventories = makeInventories();
    inventories[0].items[0] = {
      ...inventories[0].items[0],
      source: 'loot',
      crafterId: 'char-a',
    };
    renderPartyStash({ inventories });

    expect(screen.getByLabelText('Give Magic Sword to character')).toHaveValue('');
  });

  it('keeps a mixed bulk selection neutral', () => {
    const inventories = makeInventories();
    inventories[0].items[0] = {
      ...inventories[0].items[0],
      source: 'crafting',
      crafterId: 'char-a',
    };
    inventories[0].items[1] = {
      ...inventories[0].items[1],
      source: 'loot',
      crafterId: 'char-a',
    };
    renderPartyStash({ inventories });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Magic Sword' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Rope' }));

    expect(screen.getByLabelText('Give selected items to character')).toHaveValue('');
  });

  it('preselects the shared crafter for a uniform crafting bulk selection', () => {
    const inventories = makeInventories();
    inventories[0].items = inventories[0].items.map(item => ({
      ...item,
      source: 'crafting',
      crafterId: 'char-a',
    }));
    renderPartyStash({ inventories });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Magic Sword' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Rope' }));

    expect(screen.getByLabelText('Give selected items to character')).toHaveValue('char-a');
  });

  it('silently skips a selected item that vanished before bulk give', () => {
    const onGiveItem = vi.fn();
    const props = {
      inventories: makeInventories(),
      characters,
      toolTemplates: {},
      transferState: null,
      onTransferStateChange: vi.fn(),
      onConfirmTransfer: vi.fn(),
      onGiveItem,
    };
    const { rerender } = render(<PartyStashView {...props} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Magic Sword' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Rope' }));

    const updatedInventories = makeInventories();
    updatedInventories[0].items = updatedInventories[0].items.filter(item => item.id !== 'rope-1');
    rerender(<PartyStashView {...props} inventories={updatedInventories} />);
    fireEvent.change(screen.getByLabelText('Give selected items to character'), {
      target: { value: 'char-a' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Give' }));

    expect(onGiveItem).toHaveBeenCalledOnce();
    expect(onGiveItem).toHaveBeenCalledWith('party', 'sword-1', 'char-a');
  });

  it('resets the quick-assign select after use', () => {
    renderPartyStash();
    const select = screen.getByLabelText('Give Magic Sword to character');

    fireEvent.change(select, { target: { value: 'char-a' } });

    expect(select).toHaveValue('');
  });

  it('keeps the existing item Transfer button flow', () => {
    const onTransferStateChange = vi.fn();
    renderPartyStash({ onTransferStateChange });

    fireEvent.click(screen.getAllByText('Transfer')[0]);

    expect(onTransferStateChange).toHaveBeenCalledWith({
      type: 'item',
      itemId: 'sword-1',
      sourceInventoryId: 'party',
      targetInventoryId: '',
    });
  });

  it('renders the empty party-stash state', () => {
    renderPartyStash({ inventories: makeInventories().filter(inv => inv.ownerType === 'character') });

    expect(screen.getByText('No party stash found.')).toBeInTheDocument();
  });

  it('retags and logs a quick assignment through the router and real store', () => {
    const snapshots: CampaignStateSnapshot[] = [];
    render(
      <CampaignStoreProvider>
        <SeedStash />
        <StateProbe snapshots={snapshots} />
        <InventoryTab />
      </CampaignStoreProvider>
    );
    fireEvent.click(screen.getByText('Party Stash'));

    fireEvent.change(screen.getByLabelText('Give Magic Sword to character'), {
      target: { value: 'char-a' },
    });

    const latest = snapshots[snapshots.length - 1];
    expect(latest).toBeDefined();
    const inventories = latest?.entities.inventories as Record<string, Inventory>;
    expect(inventories.party.items.map(item => item.id)).not.toContain('sword-1');
    expect(inventories['inv-char-a'].items.map(item => item.id)).toContain('sword-1');
    expect(latest?.logs.entries[0]?.payload.message).toBe(
      `Transferred 1x "Magic Sword" from Party Stash to Alice's Pack`
    );
  });

  it('retags and logs every bulk assignment through the router and real store', () => {
    const snapshots: CampaignStateSnapshot[] = [];
    render(
      <CampaignStoreProvider>
        <SeedStash />
        <StateProbe snapshots={snapshots} />
        <InventoryTab />
      </CampaignStoreProvider>
    );
    fireEvent.click(screen.getByText('Party Stash'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Magic Sword' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Rope' }));
    fireEvent.change(screen.getByLabelText('Give selected items to character'), {
      target: { value: 'char-a' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Give' }));

    const latest = snapshots[snapshots.length - 1];
    const inventories = latest.entities.inventories as Record<string, Inventory>;
    expect(inventories.party.items).toEqual([]);
    expect(inventories['inv-char-a'].items.map(item => item.id)).toEqual(
      expect.arrayContaining(['sword-1', 'rope-1'])
    );
    expect(latest.logs.entries.map(entry => entry.payload.message)).toEqual(expect.arrayContaining([
      `Transferred 1x "Magic Sword" from Party Stash to Alice's Pack`,
      `Transferred 2x "Rope" from Party Stash to Alice's Pack`,
    ]));
  });
});

describe('TransferConsole', () => {
  it('renders its idle guidance', () => {
    render(<TransferConsole {...makeTransferConsoleProps()} />);

    expect(screen.getByText('Transfer Console')).toBeInTheDocument();
    expect(screen.getByText(/Select an item, tool, or currency/)).toBeInTheDocument();
  });

  it('renders transfer details and destination inventories', () => {
    render(<TransferConsole {...makeTransferConsoleProps({
      transferState: {
        type: 'item',
        itemId: 'sword-1',
        sourceInventoryId: 'party',
        targetInventoryId: '',
      },
    })} />);

    expect(screen.getByText('Source')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: "Alice's Pack" })).toBeInTheDocument();
  });

  it('sends target changes and confirm actions through callbacks', () => {
    const onTransferStateChange = vi.fn();
    const onConfirmTransfer = vi.fn();
    render(<TransferConsole {...makeTransferConsoleProps({
      transferState: {
        type: 'item',
        itemId: 'sword-1',
        sourceInventoryId: 'party',
        targetInventoryId: '',
      },
      onTransferStateChange,
      onConfirmTransfer,
    })} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'inv-char-a' } });
    fireEvent.click(screen.getByText('Confirm Transfer'));

    expect(onTransferStateChange).toHaveBeenCalledWith(expect.objectContaining({
      targetInventoryId: 'inv-char-a',
    }));
    expect(onConfirmTransfer).toHaveBeenCalledOnce();
  });
});

describe('InventoryOverviewView', () => {
  it('renders the extracted materials overview', () => {
    render(<InventoryOverviewView {...makeOverviewProps()} />);

    expect(screen.getByRole('heading', { name: 'Raw Materials' })).toBeInTheDocument();
    expect(screen.getByText('Iron')).toBeInTheDocument();
  });

  it('renders the extracted foods overview', () => {
    render(<InventoryOverviewView {...makeOverviewProps({ view: 'foods' })} />);

    expect(screen.getByRole('heading', { name: 'Food Supplies' })).toBeInTheDocument();
    expect(screen.getByText('Berries')).toBeInTheDocument();
  });
});
