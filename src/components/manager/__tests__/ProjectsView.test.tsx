import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ProjectsView } from '../views/ProjectsView';
import type { ProjectsViewProps } from '../../../types/views';

type Craft = ProjectsViewProps['crafts'][number];
type CraftFixture = Partial<Craft> & { id: string; template: string; currentQuality: string; phase: string };
const asCrafts = (xs: CraftFixture[]): Craft[] => xs as unknown as Craft[];

describe('ProjectsView', () => {
  const mockOnDelete = vi.fn();

  const defaultProps: ProjectsViewProps = {
    crafts: [],
    onDelete: mockOnDelete
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Project Manager heading', () => {
    render(<ProjectsView {...defaultProps} />);
    expect(screen.getByText('Project Manager')).toBeInTheDocument();
  });

  it('renders In-Progress and Completed section headings', () => {
    render(<ProjectsView {...defaultProps} />);
    expect(screen.getByText(/In-Progress Projects/)).toBeInTheDocument();
    expect(screen.getByText(/Completed Projects/)).toBeInTheDocument();
  });

  it('shows empty state messages when no projects', () => {
    render(<ProjectsView {...defaultProps} />);
    expect(screen.getByText('No in-progress projects')).toBeInTheDocument();
    expect(screen.getByText('No completed projects')).toBeInTheDocument();
  });

  it('displays in-progress project count', () => {
    const crafts: CraftFixture[] = [
      { id: '1', template: 'Sword', currentQuality: 'good', phase: 'design', completed: false },
      { id: '2', template: 'Shield', currentQuality: 'fine', phase: 'craft', completed: false }
    ];

    render(<ProjectsView {...defaultProps} crafts={asCrafts(crafts)} />);
    expect(screen.getByText(/In-Progress Projects \(2\)/)).toBeInTheDocument();
  });

  it('displays completed project count', () => {
    const crafts: CraftFixture[] = [
      { id: '1', template: 'Sword', currentQuality: 'good', phase: 'complete', completed: true },
      { id: '2', template: 'Shield', currentQuality: 'fine', phase: 'complete', completed: true },
      { id: '3', template: 'Axe', currentQuality: 'good', phase: 'design', completed: false }
    ];

    render(<ProjectsView {...defaultProps} crafts={asCrafts(crafts)} />);
    expect(screen.getByText(/Completed Projects \(2\)/)).toBeInTheDocument();
    expect(screen.getByText(/In-Progress Projects \(1\)/)).toBeInTheDocument();
  });

  it('renders in-progress projects with quality and template name', () => {
    const crafts: CraftFixture[] = [
      { id: '1', template: 'Sword', currentQuality: 'fine', phase: 'design', startDate: '2026-01-15' }
    ];

    render(<ProjectsView {...defaultProps} crafts={asCrafts(crafts)} />);
    expect(screen.getByText('fine Sword')).toBeInTheDocument();
    expect(screen.getByText(/Phase: design/)).toBeInTheDocument();
    expect(screen.getByText(/Started: 2026-01-15/)).toBeInTheDocument();
  });

  it('renders completed projects with completion date', () => {
    const crafts: CraftFixture[] = [
      { id: '1', template: 'Sword', currentQuality: 'fine', phase: 'complete', completed: true, completedDate: '2026-01-20' }
    ];

    render(<ProjectsView {...defaultProps} crafts={asCrafts(crafts)} />);
    expect(screen.getByText('fine Sword')).toBeInTheDocument();
    expect(screen.getByText(/Completed: 2026-01-20/)).toBeInTheDocument();
  });

  it('uses custom name when provided', () => {
    const crafts: CraftFixture[] = [
      { id: '1', name: 'Excalibur', template: 'Sword', currentQuality: 'legendary', phase: 'design' }
    ];

    render(<ProjectsView {...defaultProps} crafts={asCrafts(crafts)} />);
    expect(screen.getByText('Excalibur')).toBeInTheDocument();
    expect(screen.queryByText('legendary Sword')).not.toBeInTheDocument();
  });

  it('calls onDelete with correct arguments for in-progress project', () => {
    const crafts: CraftFixture[] = [
      { id: 'proj-123', template: 'Sword', currentQuality: 'fine', phase: 'design' }
    ];

    render(<ProjectsView {...defaultProps} crafts={asCrafts(crafts)} />);

    const deleteButtons = document.querySelectorAll('button.text-danger-400');
    expect(deleteButtons.length).toBe(1);

    fireEvent.click(deleteButtons[0]);

    expect(mockOnDelete).toHaveBeenCalledWith('project', 'fine Sword', { id: 'proj-123' });
  });

  it('calls onDelete with custom name when provided', () => {
    const crafts: CraftFixture[] = [
      { id: 'proj-456', name: 'My Sword', template: 'Sword', currentQuality: 'fine', phase: 'design' }
    ];

    render(<ProjectsView {...defaultProps} crafts={asCrafts(crafts)} />);

    const deleteButtons = document.querySelectorAll('button.text-danger-400');
    fireEvent.click(deleteButtons[0]);

    expect(mockOnDelete).toHaveBeenCalledWith('project', 'My Sword', { id: 'proj-456' });
  });

  it('calls onDelete for completed project', () => {
    const crafts: CraftFixture[] = [
      { id: 'proj-789', template: 'Shield', currentQuality: 'good', phase: 'complete', completed: true }
    ];

    render(<ProjectsView {...defaultProps} crafts={asCrafts(crafts)} />);

    const deleteButtons = document.querySelectorAll('button.text-danger-400');
    expect(deleteButtons.length).toBe(1);

    fireEvent.click(deleteButtons[0]);

    expect(mockOnDelete).toHaveBeenCalledWith('project', 'good Shield', { id: 'proj-789' });
  });

  it('shows unknown for missing dates', () => {
    const crafts: CraftFixture[] = [
      { id: '1', template: 'Sword', currentQuality: 'good', phase: 'design' },
      { id: '2', template: 'Shield', currentQuality: 'fine', phase: 'complete', completed: true }
    ];

    render(<ProjectsView {...defaultProps} crafts={asCrafts(crafts)} />);
    expect(screen.getByText(/Started: unknown/)).toBeInTheDocument();
    expect(screen.getByText(/Completed: unknown/)).toBeInTheDocument();
  });

  it('separates in-progress and completed projects correctly', () => {
    const crafts: CraftFixture[] = [
      { id: '1', template: 'Sword', currentQuality: 'good', phase: 'design', completed: false },
      { id: '2', template: 'Shield', currentQuality: 'fine', phase: 'complete', completed: true },
      { id: '3', template: 'Axe', currentQuality: 'good', phase: 'craft', completed: false }
    ];

    render(<ProjectsView {...defaultProps} crafts={asCrafts(crafts)} />);

    // Should have 3 delete buttons total
    const deleteButtons = document.querySelectorAll('button.text-danger-400');
    expect(deleteButtons.length).toBe(3);

    // Check counts
    expect(screen.getByText(/In-Progress Projects \(2\)/)).toBeInTheDocument();
    expect(screen.getByText(/Completed Projects \(1\)/)).toBeInTheDocument();
  });
});
