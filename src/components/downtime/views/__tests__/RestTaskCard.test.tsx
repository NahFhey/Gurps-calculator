import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RestTaskCard } from '../RestTaskCard';
import type { Character } from '../../../../types/campaign';
import type { RestTask } from '../RestTaskCard';

const leader: Character = { id: 'patient', name: 'Aldric', work: { skills: {} } };
const healer: Character = { id: 'healer', name: 'Kara', work: { skills: { physician: 14 } } };

const task: RestTask = {
  id: 'rest-1',
  activityType: 'rest',
  dayKey: 1,
  slot: 0,
  leaderId: leader.id,
  helperIds: [],
  status: 'pending',
  activityData: { type: 'rest', restType: 'sleep', recoveryBonus: 1, healerId: healer.id },
  createdAt: 1,
  updatedAt: 1,
};

describe('RestTaskCard', () => {
  it('renders a resolve button for a pending task', () => {
    render(<RestTaskCard task={task} leader={leader} healer={healer} onResolve={vi.fn()} />);
    expect(screen.getByTestId('resolve-button')).toBeInTheDocument();
  });

  it('renders the result message for a resolved task', () => {
    render(<RestTaskCard
      task={{ ...task, status: 'resolved', results: { success: true, message: 'Slept: recovered 1 HP.' } }}
      leader={leader}
      healer={healer}
      readonly
    />);
    expect(screen.getByText('Slept: recovered 1 HP.')).toBeInTheDocument();
    expect(screen.queryByTestId('resolve-button')).not.toBeInTheDocument();
  });

  it('shows the physician tag for a qualified healer', () => {
    render(<RestTaskCard task={task} leader={leader} healer={healer} />);
    expect(screen.getByText('Physician-14')).toBeInTheDocument();
  });
});
