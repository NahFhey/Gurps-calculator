import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StudyTaskForm } from '../StudyTaskForm';
import { createDefaultGCSData } from '../../../../types/characterSheet';
import type { Character } from '../../../../types/campaign';
import type { DowntimeState } from '../../../../types/downtime';

const state: DowntimeState = { tasksById: {}, taskOrder: [], pendingDayLedger: null };

function makeCharacters(): Character[] {
  const studentData = createDefaultGCSData();
  studentData.skills = [{ id: 'research', name: 'Research', attribute: 'IQ', difficulty: 'H', points: 2, level: 11, relativeLevel: -1 }];
  const strongTeacherData = createDefaultGCSData();
  strongTeacherData.skills = [{ id: 'teacher-research', name: 'Research', attribute: 'IQ', difficulty: 'H', points: 8, level: 13, relativeLevel: 1 }];
  const weakTeacherData = createDefaultGCSData();
  weakTeacherData.skills = [{ id: 'weak-research', name: 'Research', attribute: 'IQ', difficulty: 'H', points: 2, level: 11, relativeLevel: -1 }];
  return [
    { id: 'student', name: 'Rina', work: { skills: {} }, gcsData: studentData },
    { id: 'strong', name: 'Soren', work: { skills: {} }, gcsData: strongTeacherData },
    { id: 'weak', name: 'Mira', work: { skills: {} }, gcsData: weakTeacherData },
  ];
}

function renderForm(onSubmit = vi.fn()) {
  render(<StudyTaskForm characters={makeCharacters()} state={state} currentDayKey={1} currentSlot={0} onSubmit={onSubmit} onCancel={vi.fn()} />);
  fireEvent.change(screen.getByTestId('leader-select'), { target: { value: 'student' } });
  return onSubmit;
}

describe('StudyTaskForm', () => {
  it('prefills attribute and difficulty from an existing skill', async () => {
    renderForm();
    fireEvent.change(screen.getByTestId('skill-select'), { target: { value: 'research' } });
    await waitFor(() => {
      expect(screen.getByTestId('attribute-select')).toHaveValue('IQ');
      expect(screen.getByTestId('difficulty-select')).toHaveValue('H');
    });
  });

  it('reveals editable fields for a new skill with IQ/A defaults', () => {
    renderForm();
    fireEvent.change(screen.getByTestId('skill-select'), { target: { value: '__new__' } });
    expect(screen.getByTestId('new-skill-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('attribute-select')).toHaveValue('IQ');
    expect(screen.getByTestId('difficulty-select')).toHaveValue('A');
  });

  it('lists an ineligible teacher disabled', async () => {
    renderForm();
    fireEvent.change(screen.getByTestId('skill-select'), { target: { value: 'research' } });
    const option = await screen.findByRole('option', { name: /Mira.*can't teach/ });
    expect(option).toBeDisabled();
  });

  it('submits the teacher as a real helper with the Study payload', async () => {
    const onSubmit = renderForm();
    fireEvent.change(screen.getByTestId('skill-select'), { target: { value: 'research' } });
    await waitFor(() => expect(screen.getByTestId('teacher-select')).toContainHTML('Soren'));
    fireEvent.change(screen.getByTestId('teacher-select'), { target: { value: 'strong' } });
    fireEvent.click(screen.getByTestId('submit-button'));
    expect(onSubmit).toHaveBeenCalledWith({
      leaderId: 'student',
      helperIds: ['strong'],
      activityData: {
        type: 'study', skillName: 'Research', attribute: 'IQ', difficulty: 'H', goodMaterials: false, projectId: '',
      },
    });
  });
});
