import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StudyTaskCard } from '../StudyTaskCard';
import type { Character } from '../../../../types/campaign';
import type { StudyTask } from '../StudyTaskCard';

const leader: Character = { id: 'student', name: 'Rina', work: { skills: { Research: 11 } } };
const teacher: Character = { id: 'teacher', name: 'Soren', work: { skills: { Research: 13 } } };
const task: StudyTask = {
  id: 'study-task-1', activityType: 'study', dayKey: 1, slot: 0, leaderId: leader.id, helperIds: [teacher.id], status: 'pending',
  activityData: { type: 'study', skillName: 'Research', attribute: 'IQ', difficulty: 'A', goodMaterials: false, projectId: 'project-1' },
  createdAt: 1, updatedAt: 1,
};

describe('StudyTaskCard', () => {
  it('renders pending controls and the slot hours', () => {
    render(<StudyTaskCard task={task} leader={leader} teacher={teacher} onComplete={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByTestId('complete-button')).toBeInTheDocument();
    expect(screen.getByText('4h')).toBeInTheDocument();
  });

  it('renders a resolved result without controls', () => {
    render(<StudyTaskCard task={{ ...task, status: 'resolved', results: { success: true, message: 'Studied Research 4h (4/200h)' } }} leader={leader} teacher={teacher} readonly />);
    expect(screen.getByText('Studied Research 4h (4/200h)')).toBeInTheDocument();
    expect(screen.queryByTestId('complete-button')).not.toBeInTheDocument();
  });

  it('shows the teacher and level tag', () => {
    render(<StudyTaskCard task={task} leader={leader} teacher={teacher} />);
    expect(screen.getByText('Soren')).toBeInTheDocument();
    expect(screen.getByText('Research-13')).toBeInTheDocument();
  });
});
