import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SkillsView } from '../views/SkillsView';

interface CookingSkill {
  id: string;
  name: string;
}

describe('SkillsView', () => {
  const mockSaveCookingSkills = vi.fn();
  const mockOnDelete = vi.fn();

  const defaultProps = {
    cookingSkills: [] as CookingSkill[],
    saveCookingSkills: mockSaveCookingSkills,
    gmMode: true,
    onDelete: mockOnDelete
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Cooking Skills Table heading', () => {
    render(<SkillsView {...defaultProps} />);
    expect(screen.getByText('Cooking Skills Table')).toBeInTheDocument();
  });

  describe('when GM mode is enabled', () => {
    it('shows Add Skill button', () => {
      render(<SkillsView {...defaultProps} gmMode={true} />);
      expect(screen.getByRole('button', { name: /add skill/i })).toBeInTheDocument();
    });

    it('does not show GM mode warning', () => {
      render(<SkillsView {...defaultProps} gmMode={true} />);
      expect(screen.queryByText(/GM Mode required/i)).not.toBeInTheDocument();
    });

    it('shows add form when Add Skill button is clicked', () => {
      render(<SkillsView {...defaultProps} gmMode={true} />);

      fireEvent.click(screen.getByRole('button', { name: /add skill/i }));

      expect(screen.getByPlaceholderText(/cooking, baking/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });

    it('shows delete button for each skill', () => {
      const cookingSkills: CookingSkill[] = [
        { id: '1', name: 'Cooking' },
        { id: '2', name: 'Baking' }
      ];

      render(<SkillsView {...defaultProps} cookingSkills={cookingSkills} gmMode={true} />);

      // Find all buttons with red delete styling
      const deleteButtons = document.querySelectorAll('button.text-red-400');
      expect(deleteButtons.length).toBe(2);
    });
  });

  describe('when GM mode is disabled', () => {
    it('does not show Add Skill button', () => {
      render(<SkillsView {...defaultProps} gmMode={false} />);
      expect(screen.queryByRole('button', { name: /add skill/i })).not.toBeInTheDocument();
    });

    it('shows GM mode warning', () => {
      render(<SkillsView {...defaultProps} gmMode={false} />);
      expect(screen.getByText(/GM Mode required/i)).toBeInTheDocument();
    });

    it('does not show delete buttons', () => {
      const cookingSkills: CookingSkill[] = [
        { id: '1', name: 'Cooking' }
      ];

      render(<SkillsView {...defaultProps} cookingSkills={cookingSkills} gmMode={false} />);

      // Should have no delete buttons when GM mode is disabled
      const deleteButtons = document.querySelectorAll('button.text-red-400');
      expect(deleteButtons.length).toBe(0);
    });
  });

  it('renders existing skills', () => {
    const cookingSkills: CookingSkill[] = [
      { id: '1', name: 'Cooking' },
      { id: '2', name: 'Baking' },
      { id: '3', name: 'Brewing' }
    ];

    render(<SkillsView {...defaultProps} cookingSkills={cookingSkills} />);

    expect(screen.getByText('Cooking')).toBeInTheDocument();
    expect(screen.getByText('Baking')).toBeInTheDocument();
    expect(screen.getByText('Brewing')).toBeInTheDocument();
  });

  it('shows empty state when no skills', () => {
    render(<SkillsView {...defaultProps} cookingSkills={[]} />);
    expect(screen.getByText(/no cooking skills defined/i)).toBeInTheDocument();
  });

  it('shows player-friendly empty message when not GM', () => {
    render(<SkillsView {...defaultProps} cookingSkills={[]} gmMode={false} />);
    expect(screen.getByText(/ask gm to add skills/i)).toBeInTheDocument();
  });

  it('calls saveCookingSkills when adding a new skill', () => {
    render(<SkillsView {...defaultProps} cookingSkills={[]} />);

    fireEvent.click(screen.getByRole('button', { name: /add skill/i }));
    fireEvent.change(screen.getByPlaceholderText(/cooking, baking/i), {
      target: { value: 'Grilling' }
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(mockSaveCookingSkills).toHaveBeenCalledTimes(1);
    const savedSkills = mockSaveCookingSkills.mock.calls[0][0];
    expect(savedSkills).toHaveLength(1);
    expect(savedSkills[0].name).toBe('Grilling');
    expect(savedSkills[0].id).toBeDefined();
  });

  it('alerts when trying to add empty skill name', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<SkillsView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add skill/i }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(alertSpy).toHaveBeenCalledWith('Enter a skill name');
    expect(mockSaveCookingSkills).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('alerts when trying to add duplicate skill (case insensitive)', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const cookingSkills: CookingSkill[] = [{ id: '1', name: 'Cooking' }];

    render(<SkillsView {...defaultProps} cookingSkills={cookingSkills} />);

    fireEvent.click(screen.getByRole('button', { name: /add skill/i }));
    fireEvent.change(screen.getByPlaceholderText(/cooking, baking/i), {
      target: { value: 'COOKING' }
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(alertSpy).toHaveBeenCalledWith('Skill already exists');
    expect(mockSaveCookingSkills).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('calls onDelete with correct arguments when delete clicked', () => {
    const cookingSkills: CookingSkill[] = [{ id: 'test-id', name: 'Cooking' }];

    render(<SkillsView {...defaultProps} cookingSkills={cookingSkills} gmMode={true} />);

    const deleteButtons = document.querySelectorAll('button.text-red-400');
    expect(deleteButtons.length).toBe(1);

    fireEvent.click(deleteButtons[0]);

    expect(mockOnDelete).toHaveBeenCalledWith('cookingSkill', 'Cooking', { id: 'test-id' });
  });

  it('hides add form and clears input when X clicked', () => {
    render(<SkillsView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add skill/i }));
    fireEvent.change(screen.getByPlaceholderText(/cooking, baking/i), {
      target: { value: 'Test Skill' }
    });

    // Find X button
    const buttons = screen.getAllByRole('button');
    const closeButton = buttons.find(btn => btn.querySelector('svg.lucide-x'));
    if (closeButton) fireEvent.click(closeButton);

    expect(screen.queryByPlaceholderText(/cooking, baking/i)).not.toBeInTheDocument();
  });
});
