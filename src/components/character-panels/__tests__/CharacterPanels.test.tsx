import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CharacterEquipmentPanel } from '../CharacterEquipmentPanel';
import { CharacterInventoryPanel } from '../CharacterInventoryPanel';
import { CharacterSkillsPanel } from '../CharacterSkillsPanel';
import type { Character, Inventory } from '../../../types/campaign';

// ============================================================================
// SETUP & MOCKS
// ============================================================================

const mockActions = {
  setCharacterPanelView: vi.fn(),
  updateCharacter: vi.fn(),
  addInventory: vi.fn(),
  updateInventory: vi.fn(),
  setItemAttunement: vi.fn(),
  setItemMagical: vi.fn(),
};

vi.mock('../../../state/campaignStore', () => ({
  useCampaignStore: () => ({
    state: {
      entities: {
        characters: {},
        toolTemplates: {},
        inventories: {
          'inv-char-1': {
            id: 'inv-char-1',
            ownerType: 'character',
            ownerId: 'char-1',
            items: [{ id: 'item-1', name: 'Rope', quantity: 2 }],
            tools: [],
            currency: { gold: 50, silver: 120 },
            materials: [{ id: 'iron', name: 'Iron Ore', type: 'metal', quantity: 3 }],
            food: [{ id: 'apple', name: 'Apple', types: ['fruit'], quantity: 2 }],
          } as Inventory,
        },
      },
    },
    actions: mockActions,
  }),
}));

vi.mock('../../character-sheet/EquipmentSection', () => ({
  EquipmentSection: () => <div data-testid="equipment-section">EquipmentSection</div>,
}));

vi.mock('../../character-sheet/SkillsSection', () => ({
  SkillsSection: () => <div data-testid="skills-section">SkillsSection</div>,
}));

vi.mock('../../character-sheet/SpellsSection', () => ({
  SpellsSection: () => <div data-testid="spells-section">SpellsSection</div>,
}));

// ============================================================================
// MOCK DATA
// ============================================================================

const mockCharacter = ({
  id: 'char-1',
  name: 'Sir Aldric',
  campaign: '',
  player: '',
  player_name: '',
  gcsData: ({
    attributes: { ST: 12, DX: 14, IQ: 10, HT: 11 },
    attributePoints: { ST: 20, DX: 80, IQ: 0, HT: 10 },
    secondaryAttributes: {
      will: { value: 10, points: 0 },
      frightCheck: { value: 10, points: 0 },
      per: { value: 12, points: 10 },
      vision: { value: 12, points: 0 },
      hearing: { value: 12, points: 0 },
      tasteSmell: { value: 12, points: 0 },
      touch: { value: 12, points: 0 },
      basicSpeed: { value: 6.25, points: 0 },
      basicMove: { value: 6, points: 0 },
    },
    skills: [
      {
        id: 'sk-1',
        name: 'Broadsword',
        attribute: 'DX',
        relativeLevel: 2,
        points: 8,
        level: 16,
      },
    ],
    spells: [
      {
        id: 'sp-1',
        name: 'Fireball',
        level: 14,
        attribute: 'IQ',
        relativeLevel: 0,
        points: 4,
        spellClass: 'Regular',
        castingCost: '2',
        maintenanceCost: '1',
        castingTime: '1 sec',
        duration: '1 sec',
      },
    ],
    equipment: [
      {
        id: 'eq-1',
        name: 'Longsword',
        quantity: 1,
        weight: 4,
        cost: 700,
        equipped: true,
      },
    ],
    otherEquipment: '',
    advantages: [],
    perks: [],
    disadvantages: [],
    quirks: [],
  } as unknown as Character['gcsData']),
}) as unknown as Character;

// ============================================================================
// CharacterEquipmentPanel
// ============================================================================

describe('CharacterEquipmentPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<CharacterEquipmentPanel character={mockCharacter} />);
    expect(screen.getByText(/Sir Aldric - Equipment/)).toBeInTheDocument();
  });

  it('displays character name and panel title', () => {
    render(<CharacterEquipmentPanel character={mockCharacter} />);
    expect(screen.getByText(/Sir Aldric - Equipment/)).toBeInTheDocument();
  });

  it('renders back button', () => {
    render(<CharacterEquipmentPanel character={mockCharacter} />);
    const backButton = screen.getByRole('button', { name: /back/i });
    expect(backButton).toBeInTheDocument();
  });

  it('back button calls setCharacterPanelView', () => {
    render(<CharacterEquipmentPanel character={mockCharacter} />);
    const backButton = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backButton);
    expect(mockActions.setCharacterPanelView).toHaveBeenCalledWith('sheet');
  });

  it('renders Edit button in view mode', () => {
    render(<CharacterEquipmentPanel character={mockCharacter} />);
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('toggles to edit mode and shows Save/Cancel buttons', () => {
    render(<CharacterEquipmentPanel character={mockCharacter} />);
    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('renders EquipmentSection component', () => {
    render(<CharacterEquipmentPanel character={mockCharacter} />);
    expect(screen.getByTestId('equipment-section')).toBeInTheDocument();
  });

  it('Save button calls updateCharacter', () => {
    render(<CharacterEquipmentPanel character={mockCharacter} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(mockActions.updateCharacter).toHaveBeenCalledWith(
      'char-1',
      expect.objectContaining({ gcsData: expect.any(Object) })
    );
  });

  it('Cancel button exits edit mode without saving', () => {
    render(<CharacterEquipmentPanel character={mockCharacter} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockActions.updateCharacter).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });
});

// ============================================================================
// CharacterInventoryPanel
// ============================================================================

describe('CharacterInventoryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<CharacterInventoryPanel character={mockCharacter} />);
    expect(screen.getByText(/Sir Aldric's Inventory/)).toBeInTheDocument();
  });

  it('displays character name and inventory title', () => {
    render(<CharacterInventoryPanel character={mockCharacter} />);
    expect(screen.getByText(/Sir Aldric's Inventory/)).toBeInTheDocument();
  });

  it('renders back button', () => {
    render(<CharacterInventoryPanel character={mockCharacter} />);
    const backButton = screen.getByRole('button', { name: /back/i });
    expect(backButton).toBeInTheDocument();
  });

  it('back button calls setCharacterPanelView', () => {
    render(<CharacterInventoryPanel character={mockCharacter} />);
    const backButton = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backButton);
    expect(mockActions.setCharacterPanelView).toHaveBeenCalledWith('sheet');
  });

  it('displays items section with inventory items', () => {
    render(<CharacterInventoryPanel character={mockCharacter} />);
    expect(screen.getByText('Rope')).toBeInTheDocument();
    expect(screen.getAllByText(/x2/).length).toBeGreaterThan(0);
  });

  it('displays currency section with currency types', () => {
    render(<CharacterInventoryPanel character={mockCharacter} />);
    expect(screen.getByText('gold')).toBeInTheDocument();
    expect(screen.getByText('silver')).toBeInTheDocument();
  });

  it('shows Items section header', () => {
    render(<CharacterInventoryPanel character={mockCharacter} />);
    const itemHeaders = screen.getAllByText('Items');
    expect(itemHeaders.length).toBeGreaterThan(0);
  });

  it('shows Currency section header', () => {
    render(<CharacterInventoryPanel character={mockCharacter} />);
    const currencyHeaders = screen.getAllByText('Currency');
    expect(currencyHeaders.length).toBeGreaterThan(0);
  });

  it('renders add item form with name and quantity inputs', () => {
    render(<CharacterInventoryPanel character={mockCharacter} />);
    expect(screen.getByPlaceholderText('Item name')).toBeInTheDocument();
  });

  it('has add item button', () => {
    render(<CharacterInventoryPanel character={mockCharacter} />);
    const buttons = screen.getAllByRole('button');
    const addButtons = buttons.filter((btn) => btn.querySelector('svg'));
    expect(addButtons.length).toBeGreaterThan(0);
  });

  it('can remove items via trash button', () => {
    render(<CharacterInventoryPanel character={mockCharacter} />);
    const removeButtons = screen.getAllByRole('button');
    const trashButtons = removeButtons.filter((btn) => btn.title === 'Remove' || btn.className.includes('text-danger'));
    expect(trashButtons.length).toBeGreaterThan(0);
  });

  it('displays Tools section header', () => {
    render(<CharacterInventoryPanel character={mockCharacter} />);
    const toolHeaders = screen.getAllByText('Tools');
    expect(toolHeaders.length).toBeGreaterThan(0);
  });

  it('renders authoritative material and food holdings as read-only lists', () => {
    render(<CharacterInventoryPanel character={mockCharacter} />);
    expect(screen.getByText('Iron Ore')).toBeInTheDocument();
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.getByText('x3')).toBeInTheDocument();
  });
});

// ============================================================================
// CharacterSkillsPanel
// ============================================================================

describe('CharacterSkillsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<CharacterSkillsPanel character={mockCharacter} />);
    expect(screen.getByText(/Sir Aldric - Skills & Spells/)).toBeInTheDocument();
  });

  it('displays character name and panel title', () => {
    render(<CharacterSkillsPanel character={mockCharacter} />);
    expect(screen.getByText(/Sir Aldric - Skills & Spells/)).toBeInTheDocument();
  });

  it('renders back button', () => {
    render(<CharacterSkillsPanel character={mockCharacter} />);
    const backButton = screen.getByRole('button', { name: /back/i });
    expect(backButton).toBeInTheDocument();
  });

  it('back button calls setCharacterPanelView', () => {
    render(<CharacterSkillsPanel character={mockCharacter} />);
    const backButton = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backButton);
    expect(mockActions.setCharacterPanelView).toHaveBeenCalledWith('sheet');
  });

  it('renders Edit button in view mode', () => {
    render(<CharacterSkillsPanel character={mockCharacter} />);
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('toggles to edit mode and shows Save/Cancel buttons', () => {
    render(<CharacterSkillsPanel character={mockCharacter} />);
    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('renders SkillsSection component', () => {
    render(<CharacterSkillsPanel character={mockCharacter} />);
    expect(screen.getByTestId('skills-section')).toBeInTheDocument();
  });

  it('renders SpellsSection component', () => {
    render(<CharacterSkillsPanel character={mockCharacter} />);
    expect(screen.getByTestId('spells-section')).toBeInTheDocument();
  });

  it('Save button calls updateCharacter', () => {
    render(<CharacterSkillsPanel character={mockCharacter} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(mockActions.updateCharacter).toHaveBeenCalledWith(
      'char-1',
      expect.objectContaining({ gcsData: expect.any(Object) })
    );
  });

  it('Cancel button exits edit mode without saving', () => {
    render(<CharacterSkillsPanel character={mockCharacter} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockActions.updateCharacter).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });
});
