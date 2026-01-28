import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TileGrid } from '../TileGrid';

describe('TileGrid', () => {
  it('renders all four activity tiles', () => {
    render(<TileGrid onNavigate={vi.fn()} />);

    expect(screen.getByText('Fishing')).toBeInTheDocument();
    expect(screen.getByText('Foraging')).toBeInTheDocument();
    expect(screen.getByText('Alchemy')).toBeInTheDocument();
    expect(screen.getByText('Crafting')).toBeInTheDocument();
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
  });

  it('tiles have accessible labels', () => {
    render(<TileGrid onNavigate={vi.fn()} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(4);
    buttons.forEach((button) => {
      expect(button).toHaveAttribute('aria-label');
    });
  });
});
