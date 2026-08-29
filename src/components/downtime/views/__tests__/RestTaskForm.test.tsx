import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { downtimeInitialState } from '../../../../state/downtime/downtimeInitialState';
import type { Character } from '../../../../types/campaign';
import type { CreateTaskPayload } from '../../../../state/downtime/downtimeActions';
import { RestTaskForm } from '../RestTaskForm';
import { createDefaultGCSData } from '../../../../types/characterSheet';

const characters = [
  { id: 'char-1', name: 'Aldric' },
  { id: 'char-2', name: 'Brina' },
] as Character[];

const defaultProps = {
  characters,
  state: downtimeInitialState,
  currentDayKey: 1,
  currentSlot: 0,
  onSubmit: vi.fn(),
  onCancel: vi.fn(),
};

describe('RestTaskForm', () => {
  it('creates a valid single rest task', () => {
    const onSubmit = vi.fn();
    render(<RestTaskForm {...defaultProps} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByTestId('leader-select'), { target: { value: 'char-1' } });
    fireEvent.change(screen.getByLabelText('Rest type'), { target: { value: 'meditation' } });
    fireEvent.change(screen.getByLabelText('Recovery bonus'), { target: { value: '2' } });
    fireEvent.click(screen.getByTestId('submit-button'));

    expect(onSubmit).toHaveBeenCalledWith({
      leaderId: 'char-1',
      helperIds: [],
      activityData: { type: 'rest', restType: 'meditation', recoveryBonus: 2, healerId: null },
    });
  });

  it('creates one rest payload for every selected batch leader', () => {
    const onSubmit = vi.fn();
    const submittedBatches: CreateTaskPayload[][] = [];
    const onSubmitBatch = vi.fn((payloads: CreateTaskPayload[]) => {
      submittedBatches.push(payloads);
      return [{ valid: true }, { valid: true }];
    });
    render(
      <RestTaskForm
        {...defaultProps}
        onSubmit={onSubmit}
        onSubmitBatch={onSubmitBatch}
      />
    );

    fireEvent.click(screen.getByTestId('batch-assign-toggle'));
    expect(screen.queryByTestId('leader-select')).not.toBeInTheDocument();
    const leaderSelect = screen.getByTestId('batch-leader-select') as HTMLSelectElement;
    Array.from(leaderSelect.options).forEach((option) => { option.selected = true; });
    fireEvent.change(leaderSelect);
    fireEvent.change(screen.getByLabelText('Rest type'), { target: { value: 'light_rest' } });
    fireEvent.click(screen.getByTestId('submit-button'));

    expect(onSubmit).not.toHaveBeenCalled();
    const payloads = submittedBatches[0];
    if (!payloads) throw new Error('Expected a submitted batch');
    expect(payloads).toHaveLength(2);
    expect(payloads.map((payload) => payload.leaderId)).toEqual(['char-1', 'char-2']);
    expect(payloads.every((payload) => payload.activityData.type === 'rest')).toBe(true);
    expect(payloads.every((payload) => payload.helperIds.length === 0)).toBe(true);
  });

  it('lists physicians, excludes non-physicians, and stores the selected healer', () => {
    const onSubmit = vi.fn();
    const physician: Character = {
      id: 'healer',
      name: 'Kara',
      work: { skills: { physician: 14 } },
      gcsData: createDefaultGCSData(),
    };
    const nonPhysician: Character = {
      id: 'scout',
      name: 'Nia',
      work: { skills: { FirstAid: 16 } },
    };
    const patient: Character = {
      id: 'patient',
      name: 'Aldric',
      work: { skills: {} },
    };
    render(
      <RestTaskForm
        {...defaultProps}
        characters={[patient, physician, nonPhysician]}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByTestId('leader-select'), { target: { value: 'patient' } });
    expect(screen.getByRole('option', { name: 'Kara (Physician-14)' })).toBeInTheDocument();
    const healerSelect = screen.getByTestId('healer-select');
    expect(within(healerSelect).queryByRole('option', { name: /Nia/ })).not.toBeInTheDocument();
    fireEvent.change(healerSelect, { target: { value: 'healer' } });
    fireEvent.click(screen.getByTestId('submit-button'));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      activityData: expect.objectContaining({ healerId: 'healer' }),
    }));
  });

  it('drops a stale healer selection when the leader becomes the healer', () => {
    const onSubmit = vi.fn();
    const physician: Character = {
      id: 'healer',
      name: 'Kara',
      work: { skills: { physician: 14 } },
      gcsData: createDefaultGCSData(),
    };
    const patient: Character = {
      id: 'patient',
      name: 'Aldric',
      work: { skills: {} },
    };
    render(
      <RestTaskForm
        {...defaultProps}
        characters={[patient, physician]}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByTestId('leader-select'), { target: { value: 'patient' } });
    fireEvent.change(screen.getByTestId('healer-select'), { target: { value: 'healer' } });
    fireEvent.change(screen.getByTestId('leader-select'), { target: { value: 'healer' } });
    fireEvent.click(screen.getByTestId('submit-button'));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      leaderId: 'healer',
      activityData: expect.objectContaining({ healerId: null }),
    }));
  });

  it('shows a fallback when no physician is in the party', () => {
    render(<RestTaskForm {...defaultProps} />);
    expect(screen.getByText('No physician in party')).toBeInTheDocument();
    expect(screen.queryByTestId('healer-select')).not.toBeInTheDocument();
  });
});
