import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Character } from '../../../types/campaign';
import { createDefaultGCSData } from '../../../types/characterSheet';

const campaignStoreMock = vi.hoisted(() => ({
  characters: {},
  addCharacter: vi.fn(),
  updateCharacter: vi.fn(),
  selectCharacter: vi.fn(),
}));

vi.mock('../../../state/campaignStore', () => ({
  useCampaignStore: () => ({
    state: { entities: { characters: campaignStoreMock.characters } },
    actions: {
      addCharacter: campaignStoreMock.addCharacter,
      updateCharacter: campaignStoreMock.updateCharacter,
      selectCharacter: campaignStoreMock.selectCharacter,
    },
  }),
}));

import { CharacterCreationModal } from '../CharacterCreationModal';

function existingCharacter(name: string): Character {
  return {
    id: `existing-${name}`,
    name,
    isPlayer: true,
    images: { portrait: 'portrait-data' },
    work: { enabled: true, skills: {} },
    st: 10,
    gcsData: createDefaultGCSData(),
  };
}

function renderImportModal() {
  const onClose = vi.fn();
  render(<CharacterCreationModal onClose={onClose} onCharacterCreated={vi.fn()} />);
  fireEvent.click(screen.getByText('Import Character'));
  return { onClose, input: screen.getByLabelText('Character import file') };
}

function chooseFile(input: HTMLElement, content: string, name = 'party.txt') {
  fireEvent.change(input, {
    target: { files: [new File([content], name, { type: 'text/plain' })] },
  });
}

beforeEach(() => {
  campaignStoreMock.addCharacter.mockReset();
  campaignStoreMock.selectCharacter.mockReset();
  campaignStoreMock.updateCharacter.mockReset();
  for (const key of Object.keys(campaignStoreMock.characters)) {
    delete campaignStoreMock.characters[key as keyof typeof campaignStoreMock.characters];
  }
});

describe('CharacterCreationModal import validation', () => {
  it('shows validation errors with line numbers and does not import', async () => {
    const { input } = renderImportModal();
    chooseFile(input, 'Name: Broken (10)\nSkills: not a real skill');

    expect(await screen.findByText('Import blocked')).toBeInTheDocument();
    expect(screen.getByText(/Line 2: Skills contains content/)).toBeInTheDocument();
    expect(campaignStoreMock.addCharacter).not.toHaveBeenCalled();
    expect(campaignStoreMock.updateCharacter).not.toHaveBeenCalled();
  });

  it('shows non-blocking warnings in a collapsed details panel', async () => {
    const { input } = renderImportModal();
    chooseFile(input, 'Name: Sparse Hero');

    const summary = await screen.findByText(/Warnings \(/);
    expect(summary.closest('details')).not.toHaveAttribute('open');
    expect(screen.getByRole('button', { name: 'Import character' })).toBeEnabled();
  });
});

describe('CharacterCreationModal matching import', () => {
  it('offers create-as-new and update-existing for a case-insensitive name match', async () => {
    Object.assign(campaignStoreMock.characters, { hero: existingCharacter('Hero') });
    const { input } = renderImportModal();
    chooseFile(input, 'Name: hero (100)');

    expect(await screen.findByRole('button', { name: 'Create as new' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update existing' })).toBeInTheDocument();
  });

  it('creates a matched import as a new character when chosen', async () => {
    Object.assign(campaignStoreMock.characters, { hero: existingCharacter('Hero') });
    const { input, onClose } = renderImportModal();
    chooseFile(input, 'Name: Hero (100)');
    fireEvent.click(await screen.findByRole('button', { name: 'Create as new' }));

    expect(campaignStoreMock.addCharacter).toHaveBeenCalledWith(expect.objectContaining({ name: 'Hero' }));
    expect(campaignStoreMock.updateCharacter).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('previews and confirms a safe existing-character update', async () => {
    const existing = existingCharacter('Hero');
    if (existing.gcsData) existing.gcsData.attributes.ST = 10;
    Object.assign(campaignStoreMock.characters, { hero: existing });
    const { input } = renderImportModal();
    chooseFile(input, 'Name: Hero (120)\nPrimary Attributes: ST 12 [20]; DX 10 [0]; IQ 10 [0]; HT 10 [0];');

    fireEvent.click(await screen.findByRole('button', { name: 'Update existing' }));
    expect(screen.getByText('Attributes')).toBeInTheDocument();
    expect(screen.getByText(/ST:/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm update' }));

    expect(campaignStoreMock.updateCharacter).toHaveBeenCalledWith(
      existing.id,
      expect.objectContaining({ name: 'Hero', st: 12 })
    );
    const changes = campaignStoreMock.updateCharacter.mock.calls[0]?.[1];
    expect(changes).not.toHaveProperty('id');
    expect(changes).not.toHaveProperty('images');
  });
});

describe('CharacterCreationModal batch import', () => {
  it('renders every text character selected and imports only checked rows', async () => {
    const { input } = renderImportModal();
    chooseFile(input, 'Name: Alpha (50)\nName: Beta (75)');

    const alpha = await screen.findByLabelText('Import Alpha');
    const beta = screen.getByLabelText('Import Beta');
    expect(alpha).toBeChecked();
    expect(beta).toBeChecked();
    fireEvent.click(beta);
    fireEvent.click(screen.getByRole('button', { name: 'Import selected (1)' }));

    expect(campaignStoreMock.addCharacter).toHaveBeenCalledTimes(1);
    expect(campaignStoreMock.addCharacter).toHaveBeenCalledWith(expect.objectContaining({ name: 'Alpha' }));
  });

  it('labels matched rows as updates and runs add/update per selected row', async () => {
    const existing = existingCharacter('Alpha');
    Object.assign(campaignStoreMock.characters, { alpha: existing });
    const { input } = renderImportModal();
    chooseFile(input, 'Name: alpha (60)\nName: Beta (75)');

    await screen.findByLabelText('Import alpha');
    expect(screen.getByText('update')).toBeInTheDocument();
    expect(screen.getByText('new')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Import selected (2)' }));

    expect(campaignStoreMock.updateCharacter).toHaveBeenCalledWith(existing.id, expect.objectContaining({ name: 'alpha' }));
    expect(campaignStoreMock.addCharacter).toHaveBeenCalledWith(expect.objectContaining({ name: 'Beta' }));
  });

  it('accepts a JSON array and shows the same batch preview', async () => {
    const { input } = renderImportModal();
    chooseFile(input, JSON.stringify([{ name: 'Json One' }, { name: 'Json Two' }]), 'party.json');

    expect(await screen.findByLabelText('Import Json One')).toBeChecked();
    expect(screen.getByLabelText('Import Json Two')).toBeChecked();
  });
});
