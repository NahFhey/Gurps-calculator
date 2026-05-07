import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MiningTaskCard } from '../MiningTaskCard';
import type { DowntimeTask, MiningData, MiningSite } from '../../../../types/downtime';
import type { Character } from '../../../../types/campaign';

// ============================================================================
// MOCK DATA
// ============================================================================

const mockCharacters: Character[] = [
  { id: 'char-1', name: 'Aldric', st: 12, work: { skills: {} } },
  { id: 'char-2', name: 'Brina', st: 14, work: { skills: {} } },
];

const mockMiningSites: MiningSite[] = [
  {
    id: 'site-1',
    name: 'Iron Vein Alpha',
    zoneId: 'zone-1',
    materials: ['iron'],
    depositSize: 'Medium',
    totalUnits: 20,
    remainingUnits: 15,
    mapped: true,
    depleted: false,
    quality: 'normal',
    discoveredAt: Date.now(),
  },
];

const mockMiningData: MiningData = {
  type: 'mining',
  method: 'Surface Prospecting',
  zoneId: 'zone-1',
  locateSkill: 'prospecting',
  extractionSkill: 'mining',
  leaderLocateSkill: 14,
  leaderExtractionSkill: 12,
  toolIds: [],
  skillModifier: 2,
  dangerMode: 'lite',
  contextFlags: {
    hasDetailedMaps: true,
    knownRichDeposit: false,
    randomUnexplored: false,
    hasSupervisor: false,
    hasProperTools: true,
    isImprovisedTools: false,
  },
};

const mockTask: DowntimeTask = {
  id: 'task-1',
  activityType: 'mining',
  leaderId: 'char-1',
  helperIds: ['char-2'],
  status: 'pending',
  dayKey: 5,
  slot: 0,
  activityData: mockMiningData,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

// ============================================================================
// TESTS
// ============================================================================

describe('MiningTaskCard', () => {
  const defaultProps = {
    task: mockTask,
    characters: mockCharacters,
    miningSites: mockMiningSites,
  };

  it('renders mining method', () => {
    render(<MiningTaskCard {...defaultProps} />);
    expect(screen.getByText('Surface Prospecting')).toBeInTheDocument();
  });

  it('renders leader name', () => {
    render(<MiningTaskCard {...defaultProps} />);
    expect(screen.getByText('Aldric')).toBeInTheDocument();
  });

  it('renders helper names', () => {
    render(<MiningTaskCard {...defaultProps} />);
    expect(screen.getByText('Brina')).toBeInTheDocument();
  });

  it('renders skill info', () => {
    render(<MiningTaskCard {...defaultProps} />);
    expect(screen.getByText(/Prospecting \(IQ\)/)).toBeInTheDocument();
    expect(screen.getByText(/Mining \(IQ\)/)).toBeInTheDocument();
    // Skill levels rendered inline with label
    expect(screen.getByText(/14/)).toBeInTheDocument();
    expect(screen.getByText(/12/)).toBeInTheDocument();
  });

  it('renders positive modifier in green', () => {
    render(<MiningTaskCard {...defaultProps} />);
    const modText = screen.getByText('+2');
    expect(modText.className).toContain('green');
  });

  it('renders negative modifier in red', () => {
    const negData = { ...mockMiningData, skillModifier: -3 };
    const negTask = { ...mockTask, activityData: negData };
    render(<MiningTaskCard {...defaultProps} task={negTask} />);
    const modText = screen.getByText('-3');
    expect(modText.className).toContain('red');
  });

  it('shows context flag badges', () => {
    render(<MiningTaskCard {...defaultProps} />);
    expect(screen.getByText(/Maps/)).toBeInTheDocument();
    expect(screen.getByText(/Proper Tools/)).toBeInTheDocument();
  });

  it('shows site info for Deep Mining tasks with site', () => {
    const deepData: MiningData = { ...mockMiningData, method: 'Deep Mining', siteId: 'site-1' };
    const deepTask = { ...mockTask, activityData: deepData };
    render(<MiningTaskCard {...defaultProps} task={deepTask} />);
    expect(screen.getByText('Deep Mining')).toBeInTheDocument();
    expect(screen.getByText(/Iron Vein Alpha/)).toBeInTheDocument();
    expect(screen.getByText(/15\/20 units/)).toBeInTheDocument();
  });

  it('renders status badge', () => {
    render(<MiningTaskCard {...defaultProps} />);
    const badge = screen.getByTestId('status-badge');
    expect(badge).toHaveAttribute('data-status', 'pending');
  });

  it('shows resolve controls for pending tasks', () => {
    render(<MiningTaskCard {...defaultProps} />);
    // Should show Auto/Manual resolution toggle
    expect(screen.getByText('Auto')).toBeInTheDocument();
    expect(screen.getByText('Manual')).toBeInTheDocument();
  });

  it('calls onResolve with selected mode', () => {
    const onResolve = vi.fn();
    render(<MiningTaskCard {...defaultProps} onResolve={onResolve} />);
    // Default mode is 'manual'
    const resolveBtn = screen.getByText(/Resolve \(Manual\)/);
    fireEvent.click(resolveBtn);
    expect(onResolve).toHaveBeenCalledWith('manual');
  });

  it('calls onCancel when cancel clicked', () => {
    const onCancel = vi.fn();
    render(<MiningTaskCard {...defaultProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('hides action buttons when readonly', () => {
    render(<MiningTaskCard {...defaultProps} readonly />);
    expect(screen.queryByText(/Resolve \(/)).not.toBeInTheDocument();
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
  });

  it('hides action buttons for resolved tasks', () => {
    const resolvedTask = {
      ...mockTask,
      status: 'resolved' as const,
      results: {
        success: true,
        message: 'Found iron ore!',
        inventoryChanges: [{ itemName: 'Iron Ore', quantity: 5, itemId: 'iron-ore' }],
      },
    };
    render(<MiningTaskCard {...defaultProps} task={resolvedTask} />);
    expect(screen.queryByText(/Resolve \(/)).not.toBeInTheDocument();
    expect(screen.getByTestId('task-results')).toHaveTextContent('Found iron ore!');
    expect(screen.getByText('+5')).toBeInTheDocument();
    expect(screen.getByText('Iron Ore')).toBeInTheDocument();
  });

  it('falls back to ID when character not found', () => {
    const unknownTask = { ...mockTask, leaderId: 'unknown-id', helperIds: [] };
    render(<MiningTaskCard {...defaultProps} task={unknownTask} />);
    expect(screen.getByText('unknown-id')).toBeInTheDocument();
  });

  it('switches resolution mode when Auto clicked', () => {
    const onResolve = vi.fn();
    render(<MiningTaskCard {...defaultProps} onResolve={onResolve} />);
    fireEvent.click(screen.getByText('Auto'));
    fireEvent.click(screen.getByText(/Resolve \(Auto\)/));
    expect(onResolve).toHaveBeenCalledWith('auto');
  });
});
