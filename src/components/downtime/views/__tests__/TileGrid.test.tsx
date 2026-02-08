import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TileGrid, ACTIVITY_SKILL_REQUIREMENTS } from '../TileGrid';

describe('TileGrid', () => {
  it('renders all five activity tiles', () => {
    render(<TileGrid onNavigate={vi.fn()} />);

    expect(screen.getByText('Fishing')).toBeInTheDocument();
    expect(screen.getByText('Foraging')).toBeInTheDocument();
    expect(screen.getByText('Alchemy')).toBeInTheDocument();
    expect(screen.getByText('Crafting')).toBeInTheDocument();
    expect(screen.getByText('Cooking')).toBeInTheDocument();
  });

  it('calls onNavigate with fishing when fishing tile clicked', () => {
    const onNavigate = vi.fn();
    render(<TileGrid onNavigate={onNavigate} />);

    fireEvent.click(screen.getByLabelText('Open Fishing activity'));
    expect(onNavigate).toHaveBeenCalledWith('fishing');
  });

  it('calls onNavigate with foraging when foraging tile clicked', () => {
    const onNavigate = vi.fn();
    render(<TileGrid onNavigate={onNavigate} />);

    fireEvent.click(screen.getByLabelText('Open Foraging activity'));
    expect(onNavigate).toHaveBeenCalledWith('foraging');
  });

  it('calls onNavigate with alchemy when alchemy tile clicked', () => {
    const onNavigate = vi.fn();
    render(<TileGrid onNavigate={onNavigate} />);

    fireEvent.click(screen.getByLabelText('Open Alchemy activity'));
    expect(onNavigate).toHaveBeenCalledWith('alchemy');
  });

  it('calls onNavigate with crafting when crafting tile clicked', () => {
    const onNavigate = vi.fn();
    render(<TileGrid onNavigate={onNavigate} />);

    fireEvent.click(screen.getByLabelText('Open Crafting activity'));
    expect(onNavigate).toHaveBeenCalledWith('crafting');
  });

  it('displays descriptions for each tile', () => {
    render(<TileGrid onNavigate={vi.fn()} />);

    expect(screen.getByText('Fish & Seafood')).toBeInTheDocument();
    expect(screen.getByText('Herbs & Materials')).toBeInTheDocument();
    expect(screen.getByText('Potions & Reagents')).toBeInTheDocument();
    expect(screen.getByText('Gear & Projects')).toBeInTheDocument();
    expect(screen.getByText('Recipes & Meals')).toBeInTheDocument();
  });

  it('tiles have accessible labels', () => {
    render(<TileGrid onNavigate={vi.fn()} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(5);
    buttons.forEach((button) => {
      expect(button).toHaveAttribute('aria-label');
    });
  });

  describe('disabled activities', () => {
    it('disables tiles in the disabledActivities set', () => {
      const disabled = new Set<'fishing' | 'foraging' | 'alchemy' | 'crafting' | 'cooking'>(['alchemy', 'cooking']);
      render(<TileGrid onNavigate={vi.fn()} disabledActivities={disabled} />);

      const alchemyBtn = screen.getByLabelText('Open Alchemy activity');
      const cookingBtn = screen.getByLabelText('Open Cooking activity');

      expect(alchemyBtn).toBeDisabled();
      expect(cookingBtn).toBeDisabled();
    });

    it('keeps non-disabled tiles enabled', () => {
      const disabled = new Set<'fishing' | 'foraging' | 'alchemy' | 'crafting' | 'cooking'>(['alchemy']);
      render(<TileGrid onNavigate={vi.fn()} disabledActivities={disabled} />);

      expect(screen.getByLabelText('Open Fishing activity')).toBeEnabled();
      expect(screen.getByLabelText('Open Foraging activity')).toBeEnabled();
      expect(screen.getByLabelText('Open Crafting activity')).toBeEnabled();
      expect(screen.getByLabelText('Open Cooking activity')).toBeEnabled();
    });

    it('does not call onNavigate when a disabled tile is clicked', () => {
      const onNavigate = vi.fn();
      const disabled = new Set<'fishing' | 'foraging' | 'alchemy' | 'crafting' | 'cooking'>(['fishing']);
      render(<TileGrid onNavigate={onNavigate} disabledActivities={disabled} />);

      fireEvent.click(screen.getByLabelText('Open Fishing activity'));
      expect(onNavigate).not.toHaveBeenCalled();
    });

    it('shows tooltip on disabled tiles', () => {
      const disabled = new Set<'fishing' | 'foraging' | 'alchemy' | 'crafting' | 'cooking'>(['foraging']);
      render(<TileGrid onNavigate={vi.fn()} disabledActivities={disabled} />);

      const foragingBtn = screen.getByLabelText('Open Foraging activity');
      expect(foragingBtn).toHaveAttribute('title', 'No characters have foraging skills');
    });

    it('does not show tooltip on enabled tiles', () => {
      const disabled = new Set<'fishing' | 'foraging' | 'alchemy' | 'crafting' | 'cooking'>(['foraging']);
      render(<TileGrid onNavigate={vi.fn()} disabledActivities={disabled} />);

      const fishingBtn = screen.getByLabelText('Open Fishing activity');
      expect(fishingBtn).not.toHaveAttribute('title');
    });

    it('all tiles enabled when disabledActivities is empty', () => {
      render(<TileGrid onNavigate={vi.fn()} disabledActivities={new Set()} />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toBeEnabled();
      });
    });

    it('all tiles enabled when disabledActivities is not provided', () => {
      render(<TileGrid onNavigate={vi.fn()} />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toBeEnabled();
      });
    });
  });

  describe('ACTIVITY_SKILL_REQUIREMENTS', () => {
    it('exports skill requirements for all activities', () => {
      expect(ACTIVITY_SKILL_REQUIREMENTS).toBeDefined();
      expect(ACTIVITY_SKILL_REQUIREMENTS.fishing).toEqual(['fishing', 'spear']);
      expect(ACTIVITY_SKILL_REQUIREMENTS.foraging).toEqual(['survival', 'naturalist', 'herbLore']);
      expect(ACTIVITY_SKILL_REQUIREMENTS.alchemy).toEqual(['alchemy']);
      expect(ACTIVITY_SKILL_REQUIREMENTS.crafting).toEqual(['crafting', 'designing']);
      expect(ACTIVITY_SKILL_REQUIREMENTS.cooking).toEqual(['cooking']);
    });
  });
});
