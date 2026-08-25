/**
 * InventoryTab Party Stash transfer tests (Phase 12a.5)
 *
 * Verifies user story #4 of the Inventory Integration Bus: hand-retagging
 * items from the party stash to a character works through the Transfer
 * Console — the destination list must include character-owned inventories
 * (not just party stashes), and a confirmed party→character item transfer
 * must move the ItemInstance through the real reducer path.
 */
import { useEffect } from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InventoryTab } from '../InventoryTab';
import { CampaignStoreProvider, useCampaignStore } from '../../state/campaignStore';
import type { Character, Inventory } from '../../types/campaign';

type CampaignStateSnapshot = ReturnType<typeof useCampaignStore>['state'];

const characters: Record<string, Character> = {
  'char-1': { id: 'char-1', name: 'Alice', work: { skills: {} } },
};

function makeInventories(): Record<string, Inventory> {
  return {
    party: {
      id: 'party',
      ownerType: 'party',
      ownerId: null,
      currency: {},
      items: [{ id: 'sword-1', name: 'Magic Sword', quantity: 1 }],
      tools: [],
      materials: [],
      food: [],
    },
    'inv-char-1': {
      id: 'inv-char-1',
      ownerType: 'character',
      ownerId: 'char-1',
      currency: {},
      items: [],
      tools: [],
      materials: [],
      food: [],
    },
  };
}

function SeedStash({ inventories }: { inventories: Record<string, Inventory> }) {
  const { actions } = useCampaignStore();
  useEffect(() => {
    actions.setCharacters(characters);
    actions.setInventories(inventories);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function StateProbe({ capture }: { capture: (state: CampaignStateSnapshot) => void }) {
  const { state } = useCampaignStore();
  capture(state);
  return null;
}

function renderPartyStash(capture: (state: CampaignStateSnapshot) => void = () => {}) {
  render(
    <CampaignStoreProvider>
      <SeedStash inventories={makeInventories()} />
      <StateProbe capture={capture} />
      <InventoryTab />
    </CampaignStoreProvider>
  );
  // Switch from the default Raw Materials view to the Party Stash view
  fireEvent.click(screen.getByText('Party Stash'));
}

describe('InventoryTab Party Stash transfers', () => {
  it('lists character-owned inventories as transfer destinations', () => {
    renderPartyStash();

    // Open the Transfer Console for the party stash item
    fireEvent.click(screen.getByText('Transfer'));

    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toContain("Alice's Pack");
    // The source (party stash) must not be offered as a destination
    expect(options).not.toContain('Party Stash');
  });

  it('moves an item from the party stash to a character inventory on confirm', () => {
    let latest: CampaignStateSnapshot | null = null;
    renderPartyStash((state) => {
      latest = state;
    });

    fireEvent.click(screen.getByText('Transfer'));
    fireEvent.change(screen.getByRole('combobox', { name: /target inventory/i }), {
      target: { value: 'inv-char-1' },
    });
    fireEvent.click(screen.getByText('Confirm Transfer'));

    const inventories = (latest as unknown as CampaignStateSnapshot).entities
      .inventories as Record<string, Inventory>;
    expect(inventories['party'].items).toHaveLength(0);
    expect(inventories['inv-char-1'].items).toEqual([
      { id: 'sword-1', name: 'Magic Sword', quantity: 1, attuned: false },
    ]);
  });
});
