import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AttributesSection } from '../AttributesSection';
import { IdentitySection } from '../IdentitySection';
import { SkillsSection } from '../SkillsSection';
import { TraitsSection } from '../TraitsSection';
import type {
  PrimaryAttributes,
  PrimaryAttributePoints,
  SecondaryAttributes,
  Skill,
  Advantage,
  Perk,
  Disadvantage,
  Quirk,
} from '../../../types/characterSheet';

// ============================================================================
// MOCK DATA
// ============================================================================

const mockAttributes: PrimaryAttributes = { ST: 12, DX: 14, IQ: 10, HT: 11 };
const mockPoints: PrimaryAttributePoints = { ST: 20, DX: 80, IQ: 0, HT: 10 };

const mockSecondaryAttributes: SecondaryAttributes = {
  will: { value: 10, points: 0 },
  frightCheck: { value: 10, points: 0 },
  per: { value: 12, points: 10 },
  vision: { value: 12, points: 0 },
  hearing: { value: 12, points: 0 },
  tasteSmell: { value: 12, points: 0 },
  touch: { value: 12, points: 0 },
  basicSpeed: { value: 6.25, points: 0 },
  basicMove: { value: 6, points: 0 },
};

const mockSkills: Skill[] = [
  { id: 'sk-1', name: 'Broadsword', attribute: 'DX', relativeLevel: 2, points: 8, level: 16 },
  { id: 'sk-2', name: 'Shield', attribute: 'DX', relativeLevel: 1, points: 2, level: 15 },
  { id: 'sk-3', name: 'First Aid', attribute: 'IQ', relativeLevel: 0, points: 1, level: 10 },
];

const mockAdvantages: Advantage[] = [
  { id: 'adv-1', type: 'advantage', name: 'Combat Reflexes', points: 15 },
  { id: 'adv-2', type: 'advantage', name: 'High Pain Threshold', points: 10 },
];

const mockPerks: Perk[] = [
  { id: 'perk-1', type: 'perk', name: 'Sure-Footed', points: 1 },
];

const mockDisadvantages: Disadvantage[] = [
  { id: 'dis-1', type: 'disadvantage', name: 'Bad Temper', points: -10 },
];

const mockQuirks: Quirk[] = [
  { id: 'quirk-1', type: 'quirk', name: 'Always sharpening blade', points: -1 },
];

// ============================================================================
// AttributesSection
// ============================================================================

describe('AttributesSection', () => {
  const defaultProps = {
    attributes: mockAttributes,
    attributePoints: mockPoints,
    editMode: false,
    onChange: vi.fn(),
  };

  it('renders all four primary attributes', () => {
    render(<AttributesSection {...defaultProps} />);
    expect(screen.getByText('Strength')).toBeInTheDocument();
    expect(screen.getByText('Dexterity')).toBeInTheDocument();
    expect(screen.getByText('Intelligence')).toBeInTheDocument();
    expect(screen.getByText('Health')).toBeInTheDocument();
  });

  it('displays attribute values', () => {
    render(<AttributesSection {...defaultProps} />);
    expect(screen.getByText('12')).toBeInTheDocument(); // ST
    expect(screen.getByText('14')).toBeInTheDocument(); // DX
  });

  it('renders inputs in edit mode', () => {
    render(<AttributesSection {...defaultProps} editMode />);
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(4);
  });

  it('calls onChange when attribute edited', () => {
    const onChange = vi.fn();
    render(<AttributesSection {...defaultProps} editMode onChange={onChange} />);
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '13' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('renders section heading', () => {
    render(<AttributesSection {...defaultProps} />);
    expect(screen.getByText('Primary Attributes')).toBeInTheDocument();
  });
});

// ============================================================================
// IdentitySection
// ============================================================================

describe('IdentitySection', () => {
  const defaultProps = {
    name: 'Sir Aldric',
    totalPoints: 150,
    editMode: false,
    onNameChange: vi.fn(),
  };

  it('renders character name and points', () => {
    render(<IdentitySection {...defaultProps} />);
    expect(screen.getByText('Sir Aldric')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('shows Player badge when isPlayer is true', () => {
    render(<IdentitySection {...defaultProps} isPlayer />);
    expect(screen.getByText('Player')).toBeInTheDocument();
  });

  it('does not show Player badge by default', () => {
    render(<IdentitySection {...defaultProps} />);
    expect(screen.queryByText('Player')).not.toBeInTheDocument();
  });

  it('renders name input in edit mode', () => {
    render(<IdentitySection {...defaultProps} editMode />);
    const input = screen.getByPlaceholderText('Character Name');
    expect(input).toHaveValue('Sir Aldric');
  });

  it('calls onNameChange when name edited', () => {
    const onNameChange = vi.fn();
    render(<IdentitySection {...defaultProps} editMode onNameChange={onNameChange} />);
    fireEvent.change(screen.getByPlaceholderText('Character Name'), { target: { value: 'Lord Aldric' } });
    expect(onNameChange).toHaveBeenCalledWith('Lord Aldric');
  });

  it('displays name as heading when not in edit mode', () => {
    render(<IdentitySection {...defaultProps} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Sir Aldric');
  });
});

// ============================================================================
// SkillsSection
// ============================================================================

describe('SkillsSection', () => {
  const defaultProps = {
    skills: mockSkills,
    primaryAttributes: mockAttributes,
    secondaryAttributes: mockSecondaryAttributes,
    editMode: false,
    onChange: vi.fn(),
  };

  it('renders all skills', () => {
    render(<SkillsSection {...defaultProps} />);
    expect(screen.getByText('Broadsword')).toBeInTheDocument();
    expect(screen.getByText('Shield')).toBeInTheDocument();
    expect(screen.getByText('First Aid')).toBeInTheDocument();
  });

  it('displays skill levels', () => {
    render(<SkillsSection {...defaultProps} />);
    expect(screen.getByText('16')).toBeInTheDocument(); // Broadsword
    expect(screen.getByText('15')).toBeInTheDocument(); // Shield
  });

  it('handles empty skills array', () => {
    render(<SkillsSection {...defaultProps} skills={[]} />);
    // Should render but with no skill rows
    expect(screen.queryByText('Broadsword')).not.toBeInTheDocument();
  });
});

// ============================================================================
// TraitsSection
// ============================================================================

describe('TraitsSection', () => {
  const defaultProps = {
    advantages: mockAdvantages,
    perks: mockPerks,
    disadvantages: mockDisadvantages,
    quirks: mockQuirks,
    editMode: false,
    onAdvantagesChange: vi.fn(),
    onPerksChange: vi.fn(),
    onDisadvantagesChange: vi.fn(),
    onQuirksChange: vi.fn(),
  };

  it('renders all trait categories', () => {
    render(<TraitsSection {...defaultProps} />);
    expect(screen.getByText('Combat Reflexes')).toBeInTheDocument();
    expect(screen.getByText('Sure-Footed')).toBeInTheDocument();
    expect(screen.getByText('Bad Temper')).toBeInTheDocument();
    expect(screen.getByText('Always sharpening blade')).toBeInTheDocument();
  });

  it('renders with empty trait lists', () => {
    render(
      <TraitsSection
        {...defaultProps}
        advantages={[]}
        perks={[]}
        disadvantages={[]}
        quirks={[]}
      />
    );
    // Should render headings but no trait items
    expect(screen.queryByText('Combat Reflexes')).not.toBeInTheDocument();
  });

  it('displays total point costs per category', () => {
    render(<TraitsSection {...defaultProps} />);
    // Advantages total: 15 + 10 = 25
    expect(screen.getByText(/\[?\+25\]?/)).toBeInTheDocument();
  });
});
