import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import QuickManeuverBar from '../QuickManeuverBar';

// ---------------------------------------------------------------------------
// Test data — matches the 8 quick maneuver IDs in the component
// ---------------------------------------------------------------------------

function makeManeuver(id: string, label: string, opts?: { disabled?: boolean; reason?: string; notes?: string }) {
  return { id, label, ...opts };
}

const allQuickManeuvers = [
  makeManeuver('attack', 'Attack'),
  makeManeuver('all_out_attack_determined', 'All-Out Attack (Determined)'),
  makeManeuver('all_out_attack_strong', 'All-Out Attack (Strong)'),
  makeManeuver('all_out_defense_increased', 'All-Out Defense (Increased)'),
  makeManeuver('move', 'Move'),
  makeManeuver('aim', 'Aim'),
  makeManeuver('wait', 'Wait'),
  makeManeuver('do_nothing', 'Do Nothing'),
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('QuickManeuverBar', () => {
  it('renders all 8 quick maneuver buttons when all are available', () => {
    render(
      <QuickManeuverBar maneuvers={allQuickManeuvers} selectedId={null} onSelect={vi.fn()} />
    );

    expect(screen.getByText('Attack')).toBeInTheDocument();
    expect(screen.getByText('AoA (Det.)')).toBeInTheDocument();
    expect(screen.getByText('AoA (Str.)')).toBeInTheDocument();
    expect(screen.getByText('AoD (+2)')).toBeInTheDocument();
    expect(screen.getByText('Move')).toBeInTheDocument();
    expect(screen.getByText('Aim')).toBeInTheDocument();
    expect(screen.getByText('Wait')).toBeInTheDocument();
    expect(screen.getByText('Do Nothing')).toBeInTheDocument();
  });

  it('hides maneuvers not in the filtered list', () => {
    const subset = [
      makeManeuver('attack', 'Attack'),
      makeManeuver('move', 'Move'),
      makeManeuver('do_nothing', 'Do Nothing'),
    ];

    render(
      <QuickManeuverBar maneuvers={subset} selectedId={null} onSelect={vi.fn()} />
    );

    expect(screen.getByText('Attack')).toBeInTheDocument();
    expect(screen.getByText('Move')).toBeInTheDocument();
    expect(screen.getByText('Do Nothing')).toBeInTheDocument();
    expect(screen.queryByText('Aim')).not.toBeInTheDocument();
    expect(screen.queryByText('Wait')).not.toBeInTheDocument();
    expect(screen.queryByText('AoA (Det.)')).not.toBeInTheDocument();
  });

  it('calls onSelect with the maneuver id when a button is clicked', () => {
    const onSelect = vi.fn();
    render(
      <QuickManeuverBar maneuvers={allQuickManeuvers} selectedId={null} onSelect={onSelect} />
    );

    fireEvent.click(screen.getByText('Attack'));
    expect(onSelect).toHaveBeenCalledWith('attack');
  });

  it('calls onSelect with null when clicking the already-selected maneuver (toggle off)', () => {
    const onSelect = vi.fn();
    render(
      <QuickManeuverBar maneuvers={allQuickManeuvers} selectedId="attack" onSelect={onSelect} />
    );

    fireEvent.click(screen.getByText('Attack'));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('calls onSelect with the new id when a different maneuver is clicked', () => {
    const onSelect = vi.fn();
    render(
      <QuickManeuverBar maneuvers={allQuickManeuvers} selectedId="attack" onSelect={onSelect} />
    );

    fireEvent.click(screen.getByText('Move'));
    expect(onSelect).toHaveBeenCalledWith('move');
  });

  it('renders disabled buttons that cannot be clicked', () => {
    const onSelect = vi.fn();
    const maneuversWithDisabled = allQuickManeuvers.map(m =>
      m.id === 'attack' ? { ...m, disabled: true, reason: 'Stunned' } : m
    );

    render(
      <QuickManeuverBar maneuvers={maneuversWithDisabled} selectedId={null} onSelect={onSelect} />
    );

    const attackBtn = screen.getByText('Attack').closest('button')!;
    expect(attackBtn).toBeDisabled();

    fireEvent.click(attackBtn);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('shows disabled reason in tooltip', () => {
    const maneuversWithDisabled = allQuickManeuvers.map(m =>
      m.id === 'attack' ? { ...m, disabled: true, reason: 'Stunned' } : m
    );

    render(
      <QuickManeuverBar maneuvers={maneuversWithDisabled} selectedId={null} onSelect={vi.fn()} />
    );

    const attackBtn = screen.getByText('Attack').closest('button')!;
    expect(attackBtn).toHaveAttribute('title', 'Stunned');
  });

  it('shows hint text in tooltip when available', () => {
    render(
      <QuickManeuverBar maneuvers={allQuickManeuvers} selectedId={null} onSelect={vi.fn()} />
    );

    const aoaDet = screen.getByText('AoA (Det.)').closest('button')!;
    expect(aoaDet).toHaveAttribute('title', '+4 to hit, no defense');
  });

  it('shows notes in tooltip when no hint is defined', () => {
    const maneuversWithNotes = allQuickManeuvers.map(m =>
      m.id === 'move' ? { ...m, notes: 'Full movement available' } : m
    );

    render(
      <QuickManeuverBar maneuvers={maneuversWithNotes} selectedId={null} onSelect={vi.fn()} />
    );

    const moveBtn = screen.getByText('Move').closest('button')!;
    // Move has no hint in QUICK_MANEUVERS, so it should show the notes
    expect(moveBtn).toHaveAttribute('title', 'Full movement available');
  });

  it('renders nothing when no maneuvers match', () => {
    const { container } = render(
      <QuickManeuverBar maneuvers={[]} selectedId={null} onSelect={vi.fn()} />
    );

    // The wrapper div should exist but be empty
    const buttons = container.querySelectorAll('button');
    expect(buttons).toHaveLength(0);
  });

  it('renders icons for each button', () => {
    render(
      <QuickManeuverBar maneuvers={allQuickManeuvers} selectedId={null} onSelect={vi.fn()} />
    );

    // Check that icon spans are rendered (aria-hidden)
    const icons = screen.getAllByText(
      (_, el) => el?.getAttribute('aria-hidden') === 'true'
    );
    expect(icons.length).toBe(8);
  });
});
