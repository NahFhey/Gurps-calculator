import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { WorkersView } from '../views/WorkersView';

interface Worker {
  id: string;
  name: string;
  skills?: {
    cooking?: number;
    designing?: number;
    crafting?: number;
    alchemy?: number;
  };
}

describe('WorkersView', () => {
  const mockSaveWorkers = vi.fn();
  const mockOnDelete = vi.fn();

  const defaultProps = {
    workers: [] as Worker[],
    saveWorkers: mockSaveWorkers,
    onDelete: mockOnDelete
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Workers heading', () => {
    render(<WorkersView {...defaultProps} />);
    expect(screen.getByText('Workers')).toBeInTheDocument();
  });

  it('renders Add button', () => {
    render(<WorkersView {...defaultProps} />);
    expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();
  });

  it('shows add form when Add button is clicked', () => {
    render(<WorkersView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    expect(screen.getByPlaceholderText(/worker name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('shows skill inputs in add form', () => {
    render(<WorkersView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    expect(screen.getByText('Cooking')).toBeInTheDocument();
    expect(screen.getByText('Designing')).toBeInTheDocument();
    expect(screen.getByText('Crafting')).toBeInTheDocument();
    expect(screen.getByText('Alchemy')).toBeInTheDocument();
  });

  it('renders existing workers', () => {
    const workers: Worker[] = [
      { id: '1', name: 'Bob the Cook', skills: { cooking: 14, designing: 10, crafting: 10, alchemy: 8 } },
      { id: '2', name: 'Alice the Alchemist', skills: { cooking: 8, designing: 12, crafting: 10, alchemy: 16 } }
    ];

    render(<WorkersView {...defaultProps} workers={workers} />);

    expect(screen.getByText('Bob the Cook')).toBeInTheDocument();
    expect(screen.getByText('Alice the Alchemist')).toBeInTheDocument();
  });

  it('calls saveWorkers when adding a new worker with default skills', () => {
    render(<WorkersView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    fireEvent.change(screen.getByPlaceholderText(/worker name/i), {
      target: { value: 'New Worker' }
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(mockSaveWorkers).toHaveBeenCalledTimes(1);
    const savedWorkers = mockSaveWorkers.mock.calls[0][0];
    expect(savedWorkers).toHaveLength(1);
    expect(savedWorkers[0].name).toBe('New Worker');
    expect(savedWorkers[0].skills.cooking).toBe(10);
    expect(savedWorkers[0].skills.designing).toBe(10);
    expect(savedWorkers[0].skills.crafting).toBe(10);
    expect(savedWorkers[0].skills.alchemy).toBe(10);
  });

  it('calls saveWorkers with custom skill values', () => {
    render(<WorkersView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    fireEvent.change(screen.getByPlaceholderText(/worker name/i), {
      target: { value: 'Skilled Worker' }
    });

    // Find skill inputs by their labels
    const numberInputs = document.querySelectorAll('input[type="number"]');
    fireEvent.change(numberInputs[0], { target: { value: '15' } }); // Cooking
    fireEvent.change(numberInputs[1], { target: { value: '12' } }); // Designing
    fireEvent.change(numberInputs[2], { target: { value: '14' } }); // Crafting
    fireEvent.change(numberInputs[3], { target: { value: '11' } }); // Alchemy

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    const savedWorkers = mockSaveWorkers.mock.calls[0][0];
    expect(savedWorkers[0].skills.cooking).toBe(15);
    expect(savedWorkers[0].skills.designing).toBe(12);
    expect(savedWorkers[0].skills.crafting).toBe(14);
    expect(savedWorkers[0].skills.alchemy).toBe(11);
  });

  it('alerts when trying to add worker with empty name', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<WorkersView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(alertSpy).toHaveBeenCalledWith('Enter a name');
    expect(mockSaveWorkers).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('alerts when trying to add worker with duplicate name', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const workers: Worker[] = [{ id: '1', name: 'Bob', skills: { cooking: 10 } }];

    render(<WorkersView {...defaultProps} workers={workers} />);

    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    fireEvent.change(screen.getByPlaceholderText(/worker name/i), {
      target: { value: 'Bob' }
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(alertSpy).toHaveBeenCalledWith('Duplicate name');
    expect(mockSaveWorkers).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('expands worker details when clicked', () => {
    const workers: Worker[] = [
      { id: '1', name: 'Test Worker', skills: { cooking: 12, designing: 10, crafting: 11, alchemy: 9 } }
    ];

    render(<WorkersView {...defaultProps} workers={workers} />);

    fireEvent.click(screen.getByText('Test Worker'));

    // Should show skill inputs and delete button after expansion
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('calls onDelete when delete button is clicked', () => {
    const workers: Worker[] = [
      { id: 'worker-789', name: 'Test Worker', skills: { cooking: 10 } }
    ];

    render(<WorkersView {...defaultProps} workers={workers} />);

    fireEvent.click(screen.getByText('Test Worker'));
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));

    expect(mockOnDelete).toHaveBeenCalledWith('worker', 'Test Worker', { id: 'worker-789' });
  });

  it('displays skill values for each worker', () => {
    const workers: Worker[] = [
      { id: '1', name: 'Chef', skills: { cooking: 16, designing: 8, crafting: 10, alchemy: 6 } }
    ];

    render(<WorkersView {...defaultProps} workers={workers} />);

    // Skills should be displayed in the collapsed view with abbreviated labels
    expect(screen.getByText(/cook.*16/i)).toBeInTheDocument();
    expect(screen.getByText(/design.*8/i)).toBeInTheDocument();
    expect(screen.getByText(/craft.*10/i)).toBeInTheDocument();
    expect(screen.getByText(/alch.*6/i)).toBeInTheDocument();
  });

  it('hides add form when X button is clicked', () => {
    render(<WorkersView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    expect(screen.getByPlaceholderText(/worker name/i)).toBeInTheDocument();

    // Find and click X button
    const buttons = screen.getAllByRole('button');
    const closeButton = buttons.find(btn => btn.querySelector('svg.lucide-x'));
    if (closeButton) fireEvent.click(closeButton);

    expect(screen.queryByPlaceholderText(/worker name/i)).not.toBeInTheDocument();
  });
});
